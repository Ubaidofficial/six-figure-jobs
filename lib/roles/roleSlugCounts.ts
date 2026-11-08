// lib/roles/roleSlugCounts.ts
// Live job counts per stored roleSlug (all time and last 30 days). One cached query shared by the role pages'
// "Trending in <field>" chips and the search box's role suggestions; on failure callers get [] and show no chips.
import { DEFAULT_TTL_MS, memoAsync } from '@/lib/cache/memo'
import { buildWhere } from '@/lib/jobs/queryJobs'
import { prisma } from '@/lib/prisma'

import type { RoleSlugCount } from './relatedRoles'

export async function loadRoleSlugCounts(): Promise<RoleSlugCount[]> {
  try {
    return await memoAsync('role-slug-counts', DEFAULT_TTL_MS, async () => {
      const base = buildWhere({ page: 1, pageSize: 1 })
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const [totals, recent] = await Promise.all([
        prisma.job.groupBy({
          by: ['roleSlug'],
          where: { AND: [base, { roleSlug: { not: null } }] },
          _count: { _all: true },
        }),
        prisma.job.groupBy({
          by: ['roleSlug'],
          where: { AND: [base, { roleSlug: { not: null } }, { postedAt: { gte: since } }] },
          _count: { _all: true },
        }),
      ])
      const recentBySlug = new Map(recent.map((r) => [r.roleSlug, r._count._all]))
      return totals
        .filter((r): r is typeof r & { roleSlug: string } => Boolean(r.roleSlug))
        .map((r) => ({ roleSlug: r.roleSlug, total: r._count._all, recent: recentBySlug.get(r.roleSlug) ?? 0 }))
    })
  } catch {
    return []
  }
}
