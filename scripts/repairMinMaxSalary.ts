/**
 * Repairs minAnnual / maxAnnual + currency from raw salary fields.
 *
 * Logic:
 *  - If salaryMin/Max + salaryPeriod exist but minAnnual/maxAnnual are null,
 *    convert to annual using period.
 *  - Copy salaryCurrency → currency if missing.
 *  - Set isHundredKLocal when annual >= 100k.
 *
 * Run with:
 *   npx ts-node scripts/repairMinMaxSalary.ts
 */

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

function toAnnual(amount: number, period: string | null): number {
  if (!period) return amount
  const p = period.toLowerCase()

  if (p.includes('year') || p.includes('yr') || p === 'annual') return amount
  if (p.includes('month')) return amount * 12
  if (p.includes('week')) return amount * 52
  if (p.includes('day')) return amount * 260
  if (p.includes('hour')) return amount * 2080

  return amount // Unknown → assume annual
}

async function main() {
  __slog('🚀 Repairing min/max annual salary…')

  // ⭐ FIXED: no more  isHundredKLocal: null  (invalid type)
  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { minAnnual: null },
        { maxAnnual: null },
        { currency: null },
        { isHundredKLocal: false }, // not null
      ],
    },
  })

  __slog(`Found ${jobs.length} jobs to inspect…`)

  let updated = 0

  for (const job of jobs) {
    const data: any = {}

    const salaryMinNum = job.salaryMin != null ? Number(job.salaryMin) : null
    const salaryMaxNum = job.salaryMax != null ? Number(job.salaryMax) : null

    let minAnnualNum = job.minAnnual != null ? Number(job.minAnnual) : null
    let maxAnnualNum = job.maxAnnual != null ? Number(job.maxAnnual) : null

    // ➤ Derive annual values when missing
    if (
      (minAnnualNum == null || maxAnnualNum == null) &&
      (salaryMinNum != null || salaryMaxNum != null)
    ) {
      const period = job.salaryPeriod ?? null

      if (salaryMinNum != null && minAnnualNum == null) {
        minAnnualNum = toAnnual(salaryMinNum, period)
        data.minAnnual = BigInt(Math.round(minAnnualNum))
      }

      if (salaryMaxNum != null && maxAnnualNum == null) {
        maxAnnualNum = toAnnual(salaryMaxNum, period)
        data.maxAnnual = BigInt(Math.round(maxAnnualNum))
      }
    }

    // ➤ Set currency if not already set
    if (!job.currency && job.salaryCurrency) {
      data.currency = job.salaryCurrency
    }

    // ➤ Compute 100k+ flag
    const annualForCheck =
      maxAnnualNum ??
      minAnnualNum ??
      (job.maxAnnual != null ? Number(job.maxAnnual) : null) ??
      (job.minAnnual != null ? Number(job.minAnnual) : null)

    if (annualForCheck != null && annualForCheck >= 100_000) {
      if (job.isHundredKLocal !== true) {
        data.isHundredKLocal = true
      }
    }

    // No updates needed
    if (Object.keys(data).length === 0) continue

    await prisma.job.update({
      where: { id: job.id },
      data,
    })

    updated++
  }

  __slog(`✅ Updated ${updated} salary records.`)
}

main()
  .catch((e) => {
    __serr(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
