// lib/jobs/listingSalaryStats.ts
//
// Typical-salary figures for a listing page, computed from the SAME filters as the list beside it, so the card and
// the list always agree. One currency per page: the country's currency when the page is for one country, USD
// otherwise. Cached 10 minutes per distinct filter set.

import { memoAsync, stableKey } from '../cache/memo'
import { prisma } from '../prisma'
import { HIGH_SALARY_THRESHOLDS } from '../currency/thresholds'
import { getCurrencyForCountry } from './salaryThresholds'
import { buildWhere, type JobQueryInput } from './queryJobs'
import { formatCurrencyShort } from '../seo/salaryLabels'
import { salaryMidpoint, summarizeSalaries, type SalarySnapshot } from './salarySnapshot'

export type ListingSalaryStats = { snapshot: SalarySnapshot; currency: string }

export function currencyForInput(input: JobQueryInput): string {
  const code = input.countryCode ? getCurrencyForCountry(input.countryCode) : null
  return code && code in HIGH_SALARY_THRESHOLDS ? code : 'USD'
}

/**
 * Where the salary bands start: the currency's six-figure floor, or the page's own minimum when it is higher. A
 * $200k+ page then reads $200k-$300k, $300k-$400k, ... instead of showing the generic $100k-$150k band as empty.
 */
export function bandFloorFor(input: JobQueryInput, currency: string): number {
  const floor = Number(HIGH_SALARY_THRESHOLDS[currency as keyof typeof HIGH_SALARY_THRESHOLDS])
  return typeof input.minAnnual === 'number' && input.minAnnual > floor ? input.minAnnual : floor
}

/** One sentence placing a segment's median against the whole market's, or null when they are too close to call. */
export function describeVsMarket(median: number, marketMedian: number, currency: string): string | null {
  if (!(median > 0) || !(marketMedian > 0)) return null
  const pct = Math.round(((median - marketMedian) / marketMedian) * 100)
  const market = formatCurrencyShort(Math.round(marketMedian / 1000) * 1000, currency)
  if (Math.abs(pct) < 3) return `In line with all listings (${market} median).`
  return `${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} all listings (${market} median).`
}

export function loadListingSalaryStats(input: JobQueryInput): Promise<ListingSalaryStats | null> {
  const currency = currencyForInput(input)
  const key = stableKey('listing-salary', { ...input, page: undefined, pageSize: undefined, sortBy: undefined }, currency)
  return memoAsync(key, 10 * 60 * 1000, async () => {
    const rows = await prisma.job.findMany({
      where: { AND: [buildWhere({ ...input, page: 1, pageSize: 1 }), { currency }] },
      select: { minAnnual: true, maxAnnual: true },
      take: 5000,
    })
    const values = rows.map((r) => salaryMidpoint(r.minAnnual, r.maxAnnual)).filter((v): v is number => v !== null)
    const snapshot = summarizeSalaries(values, { floor: bandFloorFor(input, currency), currency })
    return snapshot ? { snapshot, currency } : null
  })
}
