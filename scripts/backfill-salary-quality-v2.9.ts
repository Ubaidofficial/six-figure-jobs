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
      },
    })

    if (!jobs.length) break
    cursor = jobs[jobs.length - 1]!.id

    for (const job of jobs) {
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
        now: new Date(),
      })

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
          isHighSalary: validation.salaryValidated,
        },
      })

      updated++
    }

    console.log(`[backfill v2.9] processed=${updated}`)
  }

  console.log(`[backfill v2.9] done updated=${updated}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

