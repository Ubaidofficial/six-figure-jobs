import { PrismaClient } from '@prisma/client'
import {
  validateHighSalaryEligibility,
  type NormalizedSalary,
  type SalarySource,
} from '../lib/normalizers/salary'

const prisma = new PrismaClient()

function inferSource(job: any): SalarySource {
  if ((job.salaryMin != null || job.salaryMax != null) && job.salaryCurrency) return 'ats'
  if (job.salaryRaw) return 'salaryRaw'
  return 'none'
}

function isCurrencyAmbiguous(job: any): boolean {
  return String(job.salaryCurrency ?? '').trim() === '$'
}

async function main() {
  const batchSize = 1000
  let cursor: string | null = null

  let processed = 0
  let updated = 0
  let batches = 0

  for (;;) {
    const jobs = await prisma.job.findMany({
      where: { isExpired: false },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      take: batchSize,
      select: {
        id: true,

        // inputs for validation
        minAnnual: true,
        maxAnnual: true,
        currency: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryRaw: true,

        // existing quality fields (must be selected if referenced)
        salaryValidated: true,
        salaryConfidence: true,
        salarySource: true,
        salaryParseReason: true,
        salaryRejectedReason: true,
      },
    })

    if (!jobs.length) break
    cursor = jobs[jobs.length - 1]!.id
    batches++

    const now = new Date()
    const ops: any[] = []

    for (const job of jobs) {
      const normalized: NormalizedSalary = {
        minAnnual: job.minAnnual ?? null,
        maxAnnual: job.maxAnnual ?? null,
        currency: job.currency ?? null,
        interval: 'year',
        isHighSalary: false,
      }

      const source: SalarySource = inferSource(job)
      const validation = validateHighSalaryEligibility({
        normalized,
        source,
        currencyAmbiguous: isCurrencyAmbiguous(job),
        now,
      })

      const same =
        job.salaryValidated === validation.salaryValidated &&
        (job.salaryConfidence ?? 0) === validation.salaryConfidence &&
        (job.salarySource ?? null) === (validation.salarySource ?? null) &&
        (job.salaryParseReason ?? null) === (validation.salaryParseReason ?? null) &&
        (job.salaryRejectedReason ?? null) === (validation.salaryRejectedReason ?? null)

      if (same) continue

      ops.push(
        prisma.job.update({
          where: { id: job.id },
          data: {
            salaryValidated: validation.salaryValidated,
            salaryConfidence: validation.salaryConfidence,
            salarySource: validation.salarySource,
            salaryParseReason: validation.salaryParseReason,
            salaryNormalizedAt: validation.salaryNormalizedAt,
            salaryRejectedAt: validation.salaryRejectedAt ?? null,
            salaryRejectedReason: validation.salaryRejectedReason ?? null,

            // keep behavior consistent with strict gating
            isHighSalary: validation.salaryValidated,
          },
        })
      )
    }

    if (ops.length) {
      await prisma.$transaction(ops)
      updated += ops.length
    }

    processed += jobs.length
    console.log(
      `[backfill v2.9] batches=${batches} processed=${processed} updated=${updated} batchOps=${ops.length}`
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
