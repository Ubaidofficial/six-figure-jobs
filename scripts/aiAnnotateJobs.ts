// scripts/aiAnnotateJobs.ts
// ---------------------------------------------------------------------
// AI enrichment script:
//  - Generates short summaries + bullets
//  - Extracts tech stack + keywords
//  - Infers experience level, work arrangement, visa sponsorship
//
// Usage:
//   OPENAI_API_KEY=... npx tsx scripts/aiAnnotateJobs.ts --limit=10 --dry-run
//
// Flags:
//   --limit=<n>      Limit number of jobs processed (default 10)
//   --dry-run        Do not write to DB; just log proposed updates
//   --company=<slug> Only process jobs for a specific company slug
// ---------------------------------------------------------------------

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { annotateJobWithAI } from '../lib/ai/jobAnnotator'

const prisma = new PrismaClient()

type CliOptions = {
  limit: number
  dryRun: boolean
  company?: string | null
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const limitFlag = args.find((a) => a.startsWith('--limit='))
  const companyFlag = args.find((a) => a.startsWith('--company='))

  const limit = limitFlag ? Number(limitFlag.split('=')[1]) : 10
  const company = companyFlag ? companyFlag.split('=')[1] : null
  const dryRun = args.includes('--dry-run')

  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 10,
    dryRun,
    company,
  }
}

function safeParseJson(raw: string | null | undefined): any {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function main() {
  const options = parseArgs()
  console.log(
    `🔎 Running AI annotation (limit=${options.limit}, dryRun=${options.dryRun}, company=${options.company ?? 'any'})`,
  )

  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      descriptionHtml: { not: null },
      ...(options.company
        ? {
            companyRef: {
              slug: options.company,
            },
          }
        : {}),
      OR: [
        { techStack: null },
        { experienceLevel: null },
        { workArrangement: null },
        { requirementsJson: null },
      ],
    },
    take: options.limit,
    orderBy: { createdAt: 'desc' },
    include: { companyRef: true },
  })

  if (!jobs.length) {
    console.log('No jobs found that need annotation.')
    return
  }

  let updated = 0

  for (const job of jobs) {
    const description =
      (job.descriptionHtml ?? '').replace(/<[^>]+>/g, ' ').slice(0, 7000)

    try {
      const annotation = await annotateJobWithAI({
        title: job.title,
        description,
      })

      const requirements = safeParseJson(job.requirementsJson)
      const requirementsUpdated = {
        ...requirements,
        summary: annotation.summary ?? requirements.summary ?? null,
        bullets:
          annotation.bullets?.length > 0
            ? annotation.bullets
            : requirements.bullets ?? [],
      }

      const data: any = {}

      if (annotation.techStack?.length) {
        const stack = Array.from(new Set(annotation.techStack.map((s) => s.toLowerCase())))
        data.techStack = JSON.stringify(stack)
        data.skillsJson = JSON.stringify(stack)
      }

      if (annotation.keywords?.length) {
        data.skillsJson = JSON.stringify(annotation.keywords)
      }

      if (annotation.experienceLevel) {
        data.experienceLevel = annotation.experienceLevel
      }

      if (annotation.workArrangement) {
        data.workArrangement = annotation.workArrangement
      }

      if (typeof annotation.visaSponsorship === 'boolean') {
        data.visaSponsorship = annotation.visaSponsorship
      }

      data.requirementsJson = JSON.stringify(requirementsUpdated)

      const logContext = `${job.title} @ ${job.companyRef?.slug ?? job.company ?? 'unknown'}`

      if (options.dryRun) {
        console.log(`➡️  [DRY RUN] Would update ${logContext}`, data)
        updated++
        continue
      }

      await prisma.job.update({
        where: { id: job.id },
        data,
      })

      console.log(`✅ Annotated ${logContext}`)
      updated++
    } catch (err: any) {
      console.error(
        `❌ Failed to annotate job ${job.id} (${job.title}):`,
        err?.message || err,
      )
    }
  }

  console.log(`\nDone. Annotated ${updated} job(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
