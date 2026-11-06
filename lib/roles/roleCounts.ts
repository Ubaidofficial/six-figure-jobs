// lib/roles/roleCounts.ts
// Live-job counts per base role, for the search suggestions. One grouped query, cached for ten minutes and shared by
// every visitor's keystrokes; the filter is the one every listing page uses, so a count is what a click would show.

import { memoAsync } from '../cache/memo'
import { buildWhere } from '../jobs/queryJobs'
import { prisma } from '../prisma'
import { aggregateRoleCounts, type RoleCount } from './roleSuggestions'

const TTL_MS = 10 * 60 * 1000

export function loadRoleCounts(): Promise<RoleCount[]> {
  return memoAsync('suggest:role-counts', TTL_MS, async () => {
    const rows = await prisma.job.groupBy({
      by: ['roleSlug'],
      where: buildWhere({ page: 1, pageSize: 1 }),
      _count: { _all: true },
    })
    return aggregateRoleCounts(rows.map((r) => ({ roleSlug: r.roleSlug, count: r._count._all })))
  })
}
