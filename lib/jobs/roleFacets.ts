// lib/jobs/roleFacets.ts
//
// The Role options of the listing filter, counted the way the role filter matches. buildWhere (lib/jobs/queryJobs.ts)
// matches a role slug and every slug that contains it, so ?role=software-engineer also shows senior-, staff- and
// principal-software-engineer jobs; the counts were exact per slug, so "software-engineer 546" opened 1,361 jobs
// (2026-11-19 audit). The rows are one groupBy over every role slug.

type RoleRow = { roleSlug: string | null; _count?: { _all?: number } }

export function roleFacetsFromRows(rows: RoleRow[], limit = 20): Array<{ value: string; count: number }> {
  const exact = rows
    .map((r) => ({ slug: r.roleSlug ?? '', n: Number(r._count?._all ?? 0) }))
    .filter((r) => r.slug)
  return exact
    .map(({ slug }) => ({ value: slug, count: exact.reduce((sum, o) => sum + (o.slug.includes(slug) ? o.n : 0), 0) }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit)
}
