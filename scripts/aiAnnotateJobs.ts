// scripts/aiAnnotateJobs.ts
import 'dotenv/config'
import { PrismaClient, type Prisma, type Job } from '@prisma/client'
import { annotateJobWithAI } from '../lib/ai/jobAnnotator'
import { getHighSalaryThresholdAnnual } from '../lib/currency/thresholds'
import { HIGH_SALARY_MIN_CONFIDENCE } from '../lib/jobs/queryJobs'

const prisma = new PrismaClient()

const LIMIT_DEFAULT = 10

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function safeToNumber(v: any): number | null {
  if (v == null) return null
  if (typeof v === 'bigint') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * v2.9: Only enrich jobs we actually publish (numeric + validated only)
 * - salaryValidated=true
 * - salaryConfidence>=HIGH_SALARY_MIN_CONFIDENCE
 * - per-currency threshold via getHighSalaryThresholdAnnual(currency)
 * - descriptionHtml required
 */
function qualifiesForDisplay(job: Job): boolean {
  if (job.isExpired) return false
  if (!job.descriptionHtml) return false

  // v2.9 hard gate
  if (job.salaryValidated !== true) return false
  if ((job.salaryConfidence ?? 0) < HIGH_SALARY_MIN_CONFIDENCE) return false

  const threshold = getHighSalaryThresholdAnnual(job.currency)
  if (!threshold) return false

  const minAnnual = safeToNumber(job.minAnnual)
  const maxAnnual = safeToNumber(job.maxAnnual)

  // If either side qualifies, we consider it eligible
  if (minAnnual != null && minAnnual >= threshold) return true
  if (maxAnnual != null && maxAnnual >= threshold) return true

  return false
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

  // Pull only jobs that are likely eligible; final gate enforced in qualifiesForDisplay()
  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      descriptionHtml: { not: null },
      salaryValidated: true,
      salaryConfidence: { gte: HIGH_SALARY_MIN_CONFIDENCE },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  if (!jobs.length) {
    console.log('No jobs found for enrichment query.')
    return
  }

  let updated = 0
  let skippedLowQuality = 0
  let skippedNotEligible = 0
  let failed = 0

  for (const job of jobs) {
    if (!qualifiesForDisplay(job)) {
      skippedNotEligible++
      continue
    }

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
        ((ai.bullets?.length ?? 0) >= 2 ? 1 : 0) +
        ((ai.techStack?.length ?? 0) >= 2 ? 1 : 0)

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

  console.log(
    `\nDone. Updated ${updated} jobs. SkippedNotEligible=${skippedNotEligible}. SkippedLowQuality=${skippedLowQuality}. Failed=${failed}.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
