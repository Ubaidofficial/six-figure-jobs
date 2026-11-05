// lib/jobs/salarySnapshot.ts
//
// "Typical salary" numbers for the homepage: the median, the middle half of the range, and how many listings fall in
// each salary band. USD listings only, so the figures are in one currency; each job counts once at the midpoint of
// its range (or its single figure). Computed from the same public-job filter as the rest of the homepage.

import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { memoAsync } from '../cache/memo'

export type SalaryBand = { label: string; count: number }

export type SalarySnapshot = {
  count: number
  median: number
  p25: number
  p75: number
  bands: SalaryBand[]
}

const BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: '$100k–$150k', min: 100_000, max: 150_000 },
  { label: '$150k–$200k', min: 150_000, max: 200_000 },
  { label: '$200k–$300k', min: 200_000, max: 300_000 },
  { label: '$300k+', min: 300_000, max: Number.POSITIVE_INFINITY },
]

const MIN_LISTINGS = 20 // below this a "typical" figure would be noise

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/** Pure: salaries (annual, one currency) to the snapshot, or null when there are too few to say anything. */
export function summarizeSalaries(values: number[]): SalarySnapshot | null {
  const clean = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b)
  if (clean.length < MIN_LISTINGS) return null
  return {
    count: clean.length,
    median: percentile(clean, 0.5),
    p25: percentile(clean, 0.25),
    p75: percentile(clean, 0.75),
    bands: BANDS.map((b) => ({ label: b.label, count: clean.filter((v) => v >= b.min && v < b.max).length })),
  }
}

/** Midpoint of a range, or whichever end exists. */
export function salaryMidpoint(min: unknown, max: unknown): number | null {
  const lo = min == null ? null : Number(min)
  const hi = max == null ? null : Number(max)
  if (lo != null && hi != null && Number.isFinite(lo) && Number.isFinite(hi)) return (lo + hi) / 2
  const one = lo ?? hi
  return one != null && Number.isFinite(one) ? one : null
}

export function loadSalarySnapshot(publicJobWhere: Prisma.JobWhereInput): Promise<SalarySnapshot | null> {
  return memoAsync('home:salary-snapshot', 10 * 60 * 1000, async () => {
    const rows = await prisma.job.findMany({
      where: { AND: [publicJobWhere, { currency: 'USD' }] },
      select: { minAnnual: true, maxAnnual: true },
    })
    const values = rows.map((r) => salaryMidpoint(r.minAnnual, r.maxAnnual)).filter((v): v is number => v !== null)
    return summarizeSalaries(values)
  })
}
