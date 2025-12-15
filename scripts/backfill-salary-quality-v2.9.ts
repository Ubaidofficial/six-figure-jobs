import { PrismaClient } from '@prisma/client'
import {
  validateHighSalaryEligibility,
  type NormalizedSalary,
  type SalarySource,
  isBannedTitleForSixFigureBoard,
} from '../lib/normalizers/salary'

const prisma = new PrismaClient()

function inferSource(job: any): SalarySource {
  if ((job.salaryMin != null || job.salaryMax != null) && job.salaryCurrency) return 'ats'
  if (job.salaryRaw) return 'salaryRaw'
  return 'none'
}

function isCurrencyAmbiguous(job: any): boolean {
  // We treat "$" as ambiguous (USD vs CAD vs AUD etc). Do not validate.
  return String(job.salaryCurrency ?? '').trim() === '$'
}

async function main() {
  const batchSize = 1000
  let cursor: string | null = null

  let batches = 0
  let processed = 0
  let updated = 0

  for (;;) {
    const jobs = await prisma.job.findMany({
      where: { isExpired: false },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      take: batchSize,
      select: {
        id: true,
        title: true,
        minAnnual: true,
        maxAnnual: true,
        currency: true,

        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryRaw: true,

        salaryValidated: true,
        salaryConfidence: true,
        salarySource: true,
        salaryParseReason: true,
        salaryNormalizedAt: true,
        salaryRejectedAt: true,
        salaryRejectedReason: true,
      },
    })

    if (!jobs.length) break

    batches++
    cursor = jobs[jobs.length - 1]!.id

    let batchOps = 0
    const now = new Date()

    for (const job of jobs) {
      processed++

      // Hard ban list for a six-figure board (never validate these)
      if (isBannedTitleForSixFigureBoard(job.title)) {
        // Only write if it needs changing (keeps the script fast/idempotent)
        if (job.salaryValidated === true || job.isHighSalary === true) {
          await prisma.job.update({
            where: { id: job.id },
            data: {
              salaryValidated: false,
              isHighSalary: false,
              salarySource: inferSource(job),
              salaryConfidence: job.salaryConfidence ?? 0,
              salaryParseReason: 'below_threshold',
              salaryNormalizedAt: now,
              salaryRejectedAt: now,
              salaryRejectedReason: 'banned-title:intern-junior-entry',
            },
          })
          updated++
          batchOps++
        }
        continue
      }

      const normalized: NormalizedSalary = {
        minAnnual: job.minAnnual ?? null,
        maxAnnual: job.maxAnnual ?? null,
        currency: job.currency ?? null,
        interval: 'year',
        isHighSalary: false,
      }

      const source = inferSource(job)
      const validation = validateHighSalaryEligibility({
        normalized,
        source,
        currencyAmbiguous: isCurrencyAmbiguous(job),
        now,
      })

      // Only write when something would actually change (speed + less DB load)
      const willChange =
        job.salaryValidated !== validation.salaryValidated ||
        (job.salaryConfidence ?? 0) !== validation.salaryConfidence ||
        (job.salarySource ?? null) !== validation.salarySource ||
        (job.salaryParseReason ?? null) !== validation.salaryParseReason ||
        (job.salaryRejectedReason ?? null) !== (validation.salaryRejectedReason ?? null) ||
        (job.salaryRejectedAt ?? null) !== (validation.salaryRejectedAt ?? null)

      if (!willChange) continue

      await prisma.job.update({
        where: { id: job.id },
        data: {
          salaryValidated: validation.salaryValidated,
          salaryConfidence: validation.salaryConfidence,
          salarySource: validation.salarySource,
          salaryParseReason: validation.salaryParseReason,
          salaryNormalizedAt: validation.salaryNormalizedAt,
          salaryRejectedAt: validation.salaryRejectedAt ?? null,
          salaryRejectedReason: validation.salaryRejectedReason ?? null,

          // For your app logic: isHighSalary should mirror deterministic validation
          isHighSalary: validation.salaryValidated,
        },
      })

      updated++
      batchOps++
    }

    console.log(
      `[backfill v2.9] batches=${batches} processed=${processed} updated=${updated} batchOps=${batchOps}`,
    )
  }

  console.log(`[backfill v2.9] done processed=${processed} updated=${updated}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
