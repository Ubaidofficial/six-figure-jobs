// lib/salary/indexMedians.ts
//
// Per-role medians for the /salary index cards. Same method as the role guides (lib/salary/roleGuide.ts): each USD
// listing counts once at the midpoint of its range (salaryMidpoint), and summarizeSalaries decides whether there are
// enough listings to quote a median at all. Fewer than that and the median is null, so the page says so in words
// instead of showing a number that is two or three postings talking.

import { salaryMidpoint, summarizeSalaries } from '../jobs/salarySnapshot'

export type RoleMedian = {
  /** USD listings with a salary for this role. */
  listings: number
  /** null when there are too few listings to call it a median. */
  median: number | null
  /** Bottom and top of the middle half of the listings (25th and 75th percentile); null with the median. */
  p25: number | null
  p75: number | null
}

type Row = { roleSlug: string | null; minAnnual: unknown; maxAnnual: unknown }

/** Pure: USD listings to a median per role slug. Every slug asked for gets an entry. */
export function summarizeRoleMedians(rows: Row[], slugs: string[]): Map<string, RoleMedian> {
  const byRole = new Map<string, number[]>(slugs.map((slug) => [slug, []]))
  for (const row of rows) {
    const bucket = row.roleSlug ? byRole.get(row.roleSlug) : undefined
    const mid = salaryMidpoint(row.minAnnual, row.maxAnnual)
    if (bucket && mid !== null && mid > 0) bucket.push(mid)
  }
  const result = new Map<string, RoleMedian>()
  for (const [slug, values] of byRole) {
    const snapshot = summarizeSalaries(values)
    result.set(slug, {
      listings: values.length,
      median: snapshot?.median ?? null,
      p25: snapshot?.p25 ?? null,
      p75: snapshot?.p75 ?? null,
    })
  }
  return result
}
