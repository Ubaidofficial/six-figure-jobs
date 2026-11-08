// lib/roles/topRolePages.ts
// "Top roles" link row in listing headers (salary tiers, countries, cities, levels, categories, skills, remote, /jobs):
// the role pages with the most jobs among the page's own listings. Links carry no count, because a role page lists
// all of that role's jobs, not just this page's slice.
import { DEFAULT_TTL_MS, memoAsync, stableKey } from '@/lib/cache/memo'
import { buildWhere, type JobQueryInput } from '@/lib/jobs/queryJobs'
import { prisma } from '@/lib/prisma'

import { isCanonicalSlug } from './canonicalSlugs'
import { roleLabelFor } from './relatedRoles'

const SENIORITY_PREFIX = /^(senior|staff|principal|lead|junior|associate)-/

export type TopRolePage = { slug: string; label: string; count: number }

/**
 * Stored roleSlug counts -> role pages, biggest first. Seniority variants fold into their base role page when it
 * exists ("senior-software-engineer" counts toward Software Engineer); slugs with no canonical page are dropped.
 */
export function rankTopRolePages(
  rows: Array<{ roleSlug: string | null; count: number }>,
  { limit = 8, minJobs = 2, exclude = [] as string[] } = {},
): TopRolePage[] {
  const bySlug = new Map<string, number>()
  for (const { roleSlug, count } of rows) {
    if (!roleSlug) continue
    const base = roleSlug.replace(SENIORITY_PREFIX, '')
    const page = isCanonicalSlug(base) ? base : isCanonicalSlug(roleSlug) ? roleSlug : null
    if (!page || exclude.includes(page)) continue
    bySlug.set(page, (bySlug.get(page) ?? 0) + count)
  }
  return [...bySlug.entries()]
    .filter(([, count]) => count >= minJobs)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([slug, count]) => ({ slug, label: roleLabelFor(slug), count }))
}

/** Top role pages among the jobs a listing shows (its filters, no paging). Cached; on failure, no links. */
export async function loadTopRolePages(
  input: Omit<JobQueryInput, 'page' | 'pageSize'>,
  options?: { limit?: number; minJobs?: number; exclude?: string[] },
): Promise<TopRolePage[]> {
  try {
    const rows = await memoAsync(stableKey('top-role-pages', input), DEFAULT_TTL_MS, async () => {
      const groups = await prisma.job.groupBy({
        by: ['roleSlug'],
        where: { AND: [buildWhere({ ...input, page: 1, pageSize: 1 }), { roleSlug: { not: null } }] },
        _count: { _all: true },
        orderBy: { _count: { roleSlug: 'desc' } },
        take: 60,
      })
      return groups.map((g) => ({ roleSlug: g.roleSlug, count: g._count._all }))
    })
    return rankTopRolePages(rows, options)
  } catch {
    return []
  }
}

/** The header's `related` row: role-page links (`/jobs/<role>`, or `/remote/<role>` on remote pages), or undefined. */
export function topRolesRow(label: string, roles: TopRolePage[], basePath: '/jobs' | '/remote' = '/jobs') {
  return roles.length ? { label, items: roles.map((r) => ({ label: r.label, href: `${basePath}/${r.slug}` })) } : undefined
}
