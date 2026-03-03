import { getTier1Slugs } from '@/lib/roles/canonicalSlugs'

import { buildWhere } from '../jobs/queryJobs'
import { prisma } from '../prisma'
import { isRemoteRolePageIndexable } from './indexabilityGates'

export type RemoteRoleSitemapRow = {
  roleSlug: string
  total: number
  lastmod: string
}

export async function collectRemoteRoleRows(): Promise<RemoteRoleSitemapRow[]> {
  const rows = await Promise.all(
    getTier1Slugs().map(async (roleSlug) => {
      // Keep sitemap inclusion aligned with /remote/[role] page query logic.
      const where = buildWhere({
        roleSlugs: [roleSlug],
        remoteOnly: true,
      })

      const agg = await prisma.job.aggregate({
        where,
        _count: { _all: true },
        _max: { updatedAt: true },
      })

      const total = Number(agg._count?._all ?? 0)
      if (!isRemoteRolePageIndexable(total)) return null

      return {
        roleSlug,
        total,
        lastmod: (agg._max.updatedAt ?? new Date()).toISOString(),
      }
    }),
  )

  return rows
    .filter((row): row is RemoteRoleSitemapRow => Boolean(row))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return b.lastmod.localeCompare(a.lastmod)
    })
}

export async function hasRemoteRoleSitemapEntries(): Promise<boolean> {
  for (const roleSlug of getTier1Slugs()) {
    const where = buildWhere({
      roleSlugs: [roleSlug],
      remoteOnly: true,
    })
    const total = await prisma.job.count({ where })
    if (isRemoteRolePageIndexable(total)) return true
  }

  return false
}
