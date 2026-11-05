// lib/jobs/salaryRank.ts
//
// Where one listing's pay sits among comparable listings (same role, same currency): the share of peers it pays
// more than, and the peer median. Pure maths here; the peers come from the database in loadPeerSalaries.

import { prisma } from '../prisma'
import { memoAsync } from '../cache/memo'
import { buildWhere } from './queryJobs'
import { salaryMidpoint } from './salarySnapshot'

export type SalaryRank = { percent: number; peers: number; median: number }

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
  const mid = clean.length / 2
  const median = clean.length % 2 ? clean[Math.floor(mid)] : (clean[mid - 1] + clean[mid]) / 2
  return { percent: Math.round(((below + equal / 2) / clean.length) * 100), peers: clean.length, median }
}

/** Midpoints of the live listings for a role (or every listing when `roleSlug` is null) in one currency, cached 10 minutes. */
export function loadPeerSalaries(roleSlug: string | null, currency: string): Promise<number[]> {
  return memoAsync(`peer-salaries:${roleSlug ?? '*'}:${currency}`, 10 * 60 * 1000, async () => {
    const rows = await prisma.job.findMany({
      where: { AND: [buildWhere({ roleSlugs: roleSlug ? [roleSlug] : undefined, page: 1, pageSize: 1 }), { currency }] },
      select: { minAnnual: true, maxAnnual: true },
      take: 3000,
    })
    return rows.map((r) => salaryMidpoint(r.minAnnual, r.maxAnnual)).filter((v): v is number => v !== null)
  })
}
