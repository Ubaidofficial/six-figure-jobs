// scripts/aiAnnotateJobs.ts
import 'dotenv/config'
import { PrismaClient, type Prisma, type Job } from '@prisma/client'
import { annotateJobWithAI } from '../lib/ai/jobAnnotator'

const prisma = new PrismaClient()

const LIMIT_DEFAULT = 10

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * We only enrich jobs we actually show (salary-qualified)
 * => avoids wasting spend on low-quality / low-signal jobs.
 */
function qualifiesForDisplay(job: Job): boolean {
  const min = job.minAnnual ?? job.salaryMin
  if (!min) return false
  const n = Number(min)
  if (!Number.isFinite(n)) return false
  return n >= 100_000 && Boolean(job.descriptionHtml)
}

function safeSnippet(s: string | null): string | null {
  const t = (s || '').trim()
  if (!t) return null
  if (t.length <= 160) return t
  return t.slice(0, 157).trimEnd() + '...'
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? Math.min(Number(limitArg.split('=')[1]), 50) : LIMIT_DEFAULT
  const dryRun = process.argv.includes('--dry-run')
  const minQuality = Number(process.env.AI_MIN_QUALITY ?? 2) || 2

  console.log(`🤖 AI annotate (limit=${limit}, dryRun=${dryRun})`)

  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      descriptionHtml: { not: null },
      OR: [{ minAnnual: { gte: 100_000 } }, { salaryMin: { gte: 100_000 } }, { isHighSalary: true }],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  if (!jobs.length) {
    console.log('No salary-qualified jobs found.')
    return
  }

  let updated = 0
  let skippedLowQuality = 0
  let failed = 0

  for (const job of jobs) {
    if (!qualifiesForDisplay(job)) continue

    const description = stripHtml(job.descriptionHtml!).slice(0, 7000)

    try {
      const ai = await annotateJobWithAI({
        title: job.title,
        description,
      })

      // Quality gate:
      // - summary present
      // - >=2 bullets
      // - >=2 real tech terms (after filtering in annotator)
      const qualityScore =
        (ai.summary ? 1 : 0) +
        (ai.bullets?.length >= 2 ? 1 : 0) +
        (ai.techStack?.length >= 2 ? 1 : 0)

      if (qualityScore < minQuality) {
        console.log(`⏭️ Skipped low quality (${qualityScore}/${minQuality}): ${job.title}`)
        skippedLowQuality++
        continue
      }

      const aiSummaryJson: Prisma.JsonObject = {
        summary: ai.summary,
        bullets: ai.bullets,
        techStack: ai.techStack,
        keywords: ai.keywords,
      }

      const data: Prisma.JobUpdateInput = {
        aiModel: process.env.AI_MODEL ?? 'deepseek-chat',
        aiVersion: process.env.AI_VERSION ?? 'v1',
        lastAiEnrichedAt: new Date(),
        aiQualityScore: qualityScore,
        aiSnippet: safeSnippet(ai.summary),
        aiSummaryJson,
      }

      if (dryRun) {
        console.log(`➡️ [DRY RUN] ${job.title}`, data)
        updated++
        continue
      }

      await prisma.job.update({
        where: { id: job.id },
        data,
      })

      console.log(`✅ Enriched ${job.title}`)
      updated++
    } catch (err: any) {
      failed++
      console.error(`❌ ${job.title}:`, err?.message || err)
    }
  }

  console.log(`\nDone. Updated ${updated} jobs. SkippedLowQuality=${skippedLowQuality}. Failed=${failed}.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
