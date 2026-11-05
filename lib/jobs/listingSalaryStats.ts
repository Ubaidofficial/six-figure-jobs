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
import { salaryMidpoint, summarizeSalaries, type SalarySnapshot } from './salarySnapshot'

export type ListingSalaryStats = { snapshot: SalarySnapshot; currency: string }

export function currencyForInput(input: JobQueryInput): string {
  const code = input.countryCode ? getCurrencyForCountry(input.countryCode) : null
  return code && code in HIGH_SALARY_THRESHOLDS ? code : 'USD'
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
    const floor = Number(HIGH_SALARY_THRESHOLDS[currency as keyof typeof HIGH_SALARY_THRESHOLDS])
    const snapshot = summarizeSalaries(values, { floor, currency })
    return snapshot ? { snapshot, currency } : null
  })
}
