// lib/jobs/companyHiringStats.ts
//
// Two facts about each company's open jobs for the /companies directory: how many were posted in the last week, and the
// typical pay. Read from the same public-job filter as the counts beside them, so the numbers agree. Pay is the median of
// each job's midpoint (the bottom and top of its range, or the one figure it has), in the one currency most of the
// company's salaried jobs use: amounts in different currencies are never mixed. With fewer than MIN_JOBS_FOR_MEDIAN
// salaried jobs there is no median, because two or three jobs say little about a company.
import { memoAsync, stableKey, DEFAULT_TTL_MS } from '../cache/memo'
import { getAnnualSalaryCapForCurrency } from '../normalizers/salary'
import { prisma } from '../prisma'
import { NEW_THIS_WEEK_DAYS } from './postedRecently'
import { getPublicJobWhere } from './publicStats'

export const MIN_JOBS_FOR_MEDIAN = 3

export type CompanyHiringStats = {
  /** Open jobs posted in the last NEW_THIS_WEEK_DAYS days (the employer's posting date; else the day we first saw the job, for a company tracked before the window). */
  newThisWeek: number
  /** The same count for the 7 days before that (7 to 14 days ago), by the same rule: the company page's pace line. */
  newPreviousWeek: number
  /** Median yearly pay of the company's salaried jobs in their main currency; null when there are too few to say. */
  medianPay: { amount: number; currency: string } | null
}

export type CompanyJobRow = {
  companyId: string | null
  currency: string | null
  minAnnual: bigint | number | null
  maxAnnual: bigint | number | null
  postedAt: Date | null
  createdAt: Date
}

const toNumber = (v: bigint | number | null): number | null => {
  if (v == null) return null
  const n = typeof v === 'bigint' ? Number(v) : v
  return Number.isFinite(n) && n > 0 ? n : null
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Pure: job rows to stats per company id. A company with no rows has no entry. */
export function summarizeCompanyJobs(rows: CompanyJobRow[], now: Date = new Date()): Map<string, CompanyHiringStats> {
  const since = new Date(now)
  since.setDate(since.getDate() - NEW_THIS_WEEK_DAYS)
  const before = new Date(since)
  before.setDate(before.getDate() - NEW_THIS_WEEK_DAYS)

  // The day we first stored a job of each company. A job with no posting date counts as new by the day WE first saw it, but only for a
  // company we were already tracking before the window: for one whose jobs were all stored this week (a board we just started
  // scraping), "first seen this week" says nothing about when the employer posted, and every dateless job would read as new
  // (the production audit of 2026-11-15: 1,334 of Workday's 5,374 jobs have no posting date, all stored this week, so 61% of the
  // 2,188 Workday jobs shown as new were only that).
  const firstStored = new Map<string, number>()
  for (const row of rows) {
    if (!row.companyId) continue
    const t = row.createdAt.getTime()
    if (t < (firstStored.get(row.companyId) ?? Infinity)) firstStored.set(row.companyId, t)
  }

  const byCompany = new Map<string, { newThisWeek: number; newPreviousWeek: number; pay: Map<string, number[]> }>()
  for (const row of rows) {
    if (!row.companyId) continue
    let entry = byCompany.get(row.companyId)
    if (!entry) byCompany.set(row.companyId, (entry = { newThisWeek: 0, newPreviousWeek: 0, pay: new Map() }))

    // When the job counts from: the employer's date, else the day we stored it, which only counts for a company tracked before
    // the period in question (see above).
    const first = firstStored.get(row.companyId) ?? Infinity
    const from = row.postedAt ?? (first < since.getTime() ? row.createdAt : null)
    const fromPrevious = row.postedAt ?? (first < before.getTime() ? row.createdAt : null)
    if (from && from.getTime() >= since.getTime()) entry.newThisWeek += 1
    else if (fromPrevious && fromPrevious.getTime() >= before.getTime() && fromPrevious.getTime() < since.getTime()) entry.newPreviousWeek += 1

    const currency = row.currency?.trim().toUpperCase()
    const min = toNumber(row.minAnnual)
    const max = toNumber(row.maxAnnual)
    if (!currency || (min == null && max == null)) continue
    const midpoint = ((min ?? max) as number) / 2 + ((max ?? min) as number) / 2
    // A figure beyond the sanity cap is a parsing slip (cents, or a monthly figure read as yearly), not a salary.
    if (midpoint > getAnnualSalaryCapForCurrency(currency)) continue
    const list = entry.pay.get(currency) ?? []
    list.push(midpoint)
    entry.pay.set(currency, list)
  }

  const out = new Map<string, CompanyHiringStats>()
  for (const [companyId, { newThisWeek, newPreviousWeek, pay }] of byCompany) {
    // The currency with the most salaried jobs; ties go to the one listed first (a stable choice).
    let main: [string, number[]] | null = null
    for (const entry of pay) if (!main || entry[1].length > main[1].length) main = entry
    out.set(companyId, {
      newThisWeek,
      newPreviousWeek,
      medianPay:
        main && main[1].length >= MIN_JOBS_FOR_MEDIAN
          ? { amount: Math.round(median(main[1])), currency: main[0] }
          : null,
    })
  }
  return out
}

/** Stats for the given companies as a plain object (safe to pass to a client component), cached like the directory. */
export function loadCompanyHiringStats(companyIds: string[]): Promise<Record<string, CompanyHiringStats>> {
  if (companyIds.length === 0) return Promise.resolve({})
  const ids = [...companyIds].sort()
  return memoAsync(stableKey('company-hiring-stats', ids), DEFAULT_TTL_MS, async () => {
    const rows = await prisma.job.findMany({
      where: { ...getPublicJobWhere(), companyId: { in: ids } },
      select: { companyId: true, currency: true, minAnnual: true, maxAnnual: true, postedAt: true, createdAt: true },
    })
    return Object.fromEntries(summarizeCompanyJobs(rows))
  })
}
