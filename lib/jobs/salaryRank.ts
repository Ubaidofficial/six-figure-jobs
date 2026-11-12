// lib/jobs/salaryRank.ts
//
// Where one listing's pay sits among comparable listings (same role, same currency): the share of peers it pays
// more than, and the peer median. Pure maths here; the peers come from the database in loadPeerSalaries.

import { prisma } from '../prisma'
import { memoAsync } from '../cache/memo'
import { buildWhere } from './queryJobs'
import { percentile, salaryMidpoint } from './salarySnapshot'

/** `p5`..`p95`: percentiles of the peers' midpoints, for drawing where a job's range sits among them. */
export type SalaryRank = { percent: number; peers: number; median: number; p5: number; p25: number; p75: number; p95: number }

const MIN_PEERS = 15 // fewer comparable listings than this and a percentile would be noise

/** Share of peers paid less than `value` (ties count half), rounded to a whole percent, plus the peer median. */
export function rankSalary(value: number, peers: number[]): SalaryRank | null {
  const clean = peers.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b)
  if (!Number.isFinite(value) || value <= 0 || clean.length < MIN_PEERS) return null
  let below = 0
  let equal = 0
  for (const v of clean) {
    if (v < value) below++
    else if (v === value) equal++
  }
  return {
    percent: Math.round(((below + equal / 2) / clean.length) * 100),
    peers: clean.length,
    // The same percentile as the homepage salary snapshot, so the two "typical" figures always agree.
    median: percentile(clean, 0.5),
    p5: percentile(clean, 0.05),
    p25: percentile(clean, 0.25),
    p75: percentile(clean, 0.75),
    p95: percentile(clean, 0.95),
  }
}

/**
 * Midpoints of ALL live listings for a role (or every listing when `roleSlug` is null) in one currency, sorted, cached
 * 10 minutes. Same filter as the homepage salary snapshot (buildWhere), so with `roleSlug` null in USD it is exactly
 * the snapshot's population. It used to read only 3,000 rows in no particular order: job pages said "of 3,000 listings"
 * and their typical figure ($238k) disagreed with the homepage's median of all 20,765 ($195k), 2026-11-12.
 */
export function loadPeerSalaries(roleSlug: string | null, currency: string): Promise<number[]> {
  return memoAsync(`peer-salaries:${roleSlug ?? '*'}:${currency}`, 10 * 60 * 1000, async () => {
    const rows = await prisma.job.findMany({
      where: { AND: [buildWhere({ roleSlugs: roleSlug ? [roleSlug] : undefined, page: 1, pageSize: 1 }), { currency }] },
      select: { minAnnual: true, maxAnnual: true },
    })
    return rows
      .map((r) => salaryMidpoint(r.minAnnual, r.maxAnnual))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)
  })
}
