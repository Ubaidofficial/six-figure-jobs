// scripts/backfill-tech-stack.ts
//
// Backfill Job.techStack + Job.skillsJson from existing title/descriptionHtml.
// Uses deterministic extraction (no AI calls).

import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'
import { extractTechStackFromText } from '../lib/tech/extractTechStack'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

function envInt(name: string, def: number) {
  const v = process.env[name]
  if (!v) return def
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

async function main() {
  const limit = envInt('BACKFILL_TECHSTACK_LIMIT', 500)
  const dryRun = process.argv.includes('--dry-run')

  __slog(`[backfill-tech] starting limit=${limit} dryRun=${dryRun}`)

  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      descriptionHtml: { not: null },
      OR: [{ techStack: null }, { techStack: '' }, { skillsJson: null }, { skillsJson: '' }],
    },
    select: {
      id: true,
      title: true,
      descriptionHtml: true,
      techStack: true,
      skillsJson: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  if (!jobs.length) {
    __slog('[backfill-tech] no jobs matched')
    return
  }

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const job of jobs) {
    try {
      const fullText = `${job.title || ''}\n${job.descriptionHtml || ''}`
      const tech = extractTechStackFromText(fullText)
      if (!tech.display.length) {
        skipped++
        continue
      }

      const nextTechStack = JSON.stringify(tech.display)
      const nextSkills = JSON.stringify(tech.slugs)

      if (dryRun) {
        __slog(`[backfill-tech] [DRY RUN] ${job.id}`, {
          techStack: tech.display,
          skillsJson: tech.slugs,
        })
        updated++
        continue
      }

      await prisma.job.update({
        where: { id: job.id },
        data: {
          techStack: nextTechStack,
          skillsJson: nextSkills,
        },
      })

      updated++
    } catch (e: any) {
      failed++
      __serr(`[backfill-tech] failed job=${job.id}`, e?.message || e)
    }
  }

  __slog(`[backfill-tech] done updated=${updated} skipped=${skipped} failed=${failed}`)
}

main()
  .catch((e) => {
    __serr(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
