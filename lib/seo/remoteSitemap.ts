import { getTier1Slugs } from '@/lib/roles/canonicalSlugs'

import { buildWhere } from '../jobs/queryJobs'
import { prisma } from '../prisma'
import { isRemoteRolePageIndexable } from './indexabilityGates'

export type RemoteRoleSitemapRow = {
  roleSlug: string
  total: number
  lastmod: string
}

type RemoteRoleFilters = {
  remoteRegion?: string | null
}

function buildRemoteRoleWhere(filters?: RemoteRoleFilters) {
  return buildWhere({
    remoteOnly: true,
    remoteRegion: filters?.remoteRegion || undefined,
    excludeInternships: true,
  })
}

export async function collectRemoteRoleRows(
  filters?: RemoteRoleFilters,
): Promise<RemoteRoleSitemapRow[]> {
  const canonicalSlugs = [...getTier1Slugs()]
  if (canonicalSlugs.length === 0) return []

  const rows = await prisma.job.groupBy({
    by: ['roleSlug'],
    where: {
      ...buildRemoteRoleWhere(filters),
      roleSlug: { in: canonicalSlugs },
    },
    _count: { _all: true },
    _max: { updatedAt: true },
    orderBy: { _count: { roleSlug: 'desc' } },
  })

  return rows
    .map((row) => {
      const roleSlug = String(row.roleSlug || '').trim()
      const total = Number((row as any)._count?._all ?? 0)
      if (!roleSlug || !isRemoteRolePageIndexable(total)) return null

      return {
        roleSlug,
        total,
        lastmod: (((row as any)._max?.updatedAt as Date | undefined) ?? new Date()).toISOString(),
      }
    })
    .filter((row): row is RemoteRoleSitemapRow => Boolean(row))
}

export async function hasRemoteRoleSitemapEntries(filters?: RemoteRoleFilters): Promise<boolean> {
  return (await collectRemoteRoleRows(filters)).length > 0
}
