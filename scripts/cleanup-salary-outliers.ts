/**
 * Cleanup invalid salary outliers + flag high-but-plausible salaries for manual review.
 *
 * Goals (based on audit):
 *  - Null salaries when `salaryParseReason='too_high'` OR USD-equivalent annual pay > $2M.
 *  - Preserve `salaryRaw` for audit trail.
 *  - Set `needsReview=true` when $600k < USD-equivalent annual pay < $2M AND `salaryValidated=true`.
 *
 * Usage:
 *   npx tsx scripts/cleanup-salary-outliers.ts            # dry-run (default)
 *   npx tsx scripts/cleanup-salary-outliers.ts --apply    # writes to DB
 *   npx tsx scripts/cleanup-salary-outliers.ts --limit 200
 *   npx tsx scripts/cleanup-salary-outliers.ts --include-expired
 */

import { format as __format } from 'node:util'
import { PrismaClient, Prisma } from '@prisma/client'
import { estimateUsdAnnual, normalizeSalary } from '../lib/normalizers/salary'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()

const USD_REVIEW_MIN = 600_000
const USD_HARD_CAP = 2_000_000

type CliOptions = {
  apply: boolean
  includeExpired: boolean
  limit: number | null
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const includeExpired = args.includes('--include-expired')

  const limitIdx = args.indexOf('--limit')
  const limitRaw = limitIdx >= 0 ? args[limitIdx + 1] : null
  const limit = limitRaw ? Number(limitRaw) || null : null

  return { apply, includeExpired, limit }
}

function bigintToNumberSafe(v: bigint | null | undefined): number | null {
  if (v == null) return null
  const max = BigInt(Number.MAX_SAFE_INTEGER)
  if (v > max || v < -max) return null
  return Number(v)
}

function getAnnualLocalForUsdCheck(job: {
  salaryMin: bigint | null
  salaryMax: bigint | null
  minAnnual: bigint | null
  maxAnnual: bigint | null
  salaryCurrency: string | null
  salaryPeriod: string | null
  currency: string | null
}): { annualLocal: number | null; currency: string | null } {
  const currency = job.currency ?? job.salaryCurrency ?? null

  const annualBig =
    job.maxAnnual ??
    job.minAnnual ??
    (() => {
      const min = bigintToNumberSafe(job.salaryMin)
      const max = bigintToNumberSafe(job.salaryMax)
      if (min == null && max == null) return null

      const normalized = normalizeSalary({
        min,
        max,
        currency,
        interval: job.salaryPeriod ?? null,
      })
      return normalized.maxAnnual ?? normalized.minAnnual
    })()

  if (typeof annualBig === 'bigint') return { annualLocal: bigintToNumberSafe(annualBig), currency }
  return { annualLocal: annualBig, currency }
}

async function main() {
  const { apply, includeExpired, limit } = parseCliArgs()

  __slog('🧹 Salary outlier cleanup')
  __slog(`   Mode          : ${apply ? 'APPLY (writes)' : 'dry-run'}`)
  __slog(`   Include expired: ${includeExpired ? 'YES' : 'no'}`)
  __slog(`   Limit         : ${limit ?? 'none'}`)
  __slog('')

  const baseWhere: Prisma.JobWhereInput = includeExpired ? {} : { isExpired: false }

  // Pass 1: null invalid outliers
  const outlierCandidates = await prisma.job.findMany({
    where: {
      AND: [
        baseWhere,
        {
          OR: [
            { salaryParseReason: 'too_high' },
            { minAnnual: { gt: BigInt(2_000_000) } },
            { maxAnnual: { gt: BigInt(2_000_000) } },
            { salaryMin: { gt: BigInt(2_000_000) } },
            { salaryMax: { gt: BigInt(2_000_000) } },
          ],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      source: true,
      url: true,
      salaryRaw: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      salaryPeriod: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      salaryValidated: true,
      salaryParseReason: true,
      salaryRejectedReason: true,
      needsReview: true,
    },
    take: limit ?? undefined,
  })

  __slog(`🔎 Outlier candidates: ${outlierCandidates.length}`)

  let outliersNulled = 0
  let outliersHardCap = 0
  let outliersParseReasonTooHigh = 0

  for (const job of outlierCandidates) {
    const { annualLocal, currency } = getAnnualLocalForUsdCheck(job)
    const usdAnnual =
      annualLocal == null
        ? null
        : estimateUsdAnnual(annualLocal, currency) ??
          // If FX is unknown but the annual number is enormous, treat it as a hard outlier anyway.
          (annualLocal > 10_000_000 ? annualLocal : null)

    const isParseReasonTooHigh = job.salaryParseReason === 'too_high'
    const isUsdHardOutlier = usdAnnual != null && usdAnnual > USD_HARD_CAP

    if (!isParseReasonTooHigh && !isUsdHardOutlier) continue

    const rejectedReason = isParseReasonTooHigh
      ? job.salaryRejectedReason ?? `cleanup:salaryParseReason=too_high`
      : `cleanup:annual-over-usd-cap:${USD_HARD_CAP}`

    if (!apply) {
      __slog(
        `[dry-run] null salary: ${job.id} | ${job.source} | ${job.salaryCurrency ?? job.currency ?? 'n/a'} | usd≈${usdAnnual ?? 'n/a'} | ${job.title}`
      )
      outliersNulled++
      if (isParseReasonTooHigh) outliersParseReasonTooHigh++
      if (isUsdHardOutlier) outliersHardCap++
      continue
    }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: null,
        minAnnual: null,
        maxAnnual: null,
        currency: null,
        isHighSalary: false,
        isHundredKLocal: false,
        salaryValidated: false,
        salaryConfidence: 0,
        salaryParseReason: isParseReasonTooHigh ? job.salaryParseReason : 'too_high',
        salaryRejectedAt: new Date(),
        salaryRejectedReason: rejectedReason,
        needsReview: false,
      },
    })

    outliersNulled++
    if (isParseReasonTooHigh) outliersParseReasonTooHigh++
    if (isUsdHardOutlier) outliersHardCap++
  }

  __slog('')
  __slog(`✅ Outliers nulled: ${outliersNulled}`)
  __slog(`   - parseReason=too_high: ${outliersParseReasonTooHigh}`)
  __slog(`   - usd>${USD_HARD_CAP}: ${outliersHardCap}`)

  // Pass 2: needsReview flag for high-but-plausible salaries
  const reviewCandidates = await prisma.job.findMany({
    where: {
      AND: [
        baseWhere,
        { salaryValidated: true },
        { needsReview: false },
        {
          OR: [{ minAnnual: { not: null } }, { maxAnnual: { not: null } }],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      source: true,
      salaryCurrency: true,
      currency: true,
      minAnnual: true,
      maxAnnual: true,
    },
    take: limit ?? undefined,
  })

  __slog('')
  __slog(`🔎 Review candidates: ${reviewCandidates.length}`)

  let flaggedForReview = 0

  for (const job of reviewCandidates) {
    const annual = bigintToNumberSafe(job.maxAnnual ?? job.minAnnual)
    if (annual == null) continue
    const usd = estimateUsdAnnual(annual, job.currency ?? job.salaryCurrency)
    if (usd == null) continue

    if (usd <= USD_REVIEW_MIN || usd >= USD_HARD_CAP) continue

    if (!apply) {
      __slog(
        `[dry-run] needsReview=true: ${job.id} | ${job.source} | ${job.currency ?? job.salaryCurrency ?? 'n/a'} | usd≈${Math.round(usd)} | ${job.title}`
      )
      flaggedForReview++
      continue
    }

    await prisma.job.update({
      where: { id: job.id },
      data: { needsReview: true },
    })
    flaggedForReview++
  }

  __slog('')
  __slog(`🏁 needsReview flagged: ${flaggedForReview}`)
}

main()
  .catch((e) => {
    __serr(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

