// lib/jobs/remoteCompanies.ts
//
// The companies hiring remotely for six-figure roles, for /remote/companies: every company with a company page in the
// index (MIN_COMPANY_INDEXABLE_JOBS or more public jobs, the /companies rule) that has at least one open remote job,
// with its number of remote jobs. "Remote" is the remote-only filter the /remote hub uses (structured fields only).
import { cache } from 'react'

import { DEFAULT_TTL_MS, memoAsync } from '@/lib/cache/memo'
import { prisma } from '@/lib/prisma'
import { buildWhere } from './queryJobs'
import { loadPublicSiteStats, type PublicCompanyDirectoryEntry } from './publicStats'

type Group = { companyId: string | null; _count: { _all: number } }
type CompanyRow = Omit<PublicCompanyDirectoryEntry, '_count'>

/** Pure: groups and company rows to directory entries (the count is remote jobs), most remote jobs first, then by name. */
export function shapeRemoteCompanies(groups: ReadonlyArray<Group>, companies: ReadonlyArray<CompanyRow>): PublicCompanyDirectoryEntry[] {
  const remoteJobs = new Map(groups.filter((g) => g.companyId).map((g) => [g.companyId as string, g._count._all]))
  return companies
    .filter((c) => c.slug && c.name && (remoteJobs.get(c.id) ?? 0) > 0)
    .map((c) => ({ ...c, _count: { jobs: remoteJobs.get(c.id) ?? 0 } }))
    .sort((a, b) => b._count.jobs - a._count.jobs || String(a.name).localeCompare(String(b.name)))
}

export const loadRemoteCompaniesDirectory = cache(() =>
  memoAsync('remote-companies-directory', DEFAULT_TTL_MS, async () => {
    const { eligibleCompanyIds } = await loadPublicSiteStats()
    if (eligibleCompanyIds.length === 0) return { companies: [], totalRemoteJobs: 0 }
    const where = buildWhere({ remoteOnly: true, excludeInternships: true })
    const groups = await prisma.job.groupBy({
      by: ['companyId'],
      where: { ...where, companyId: { in: eligibleCompanyIds } },
      _count: { _all: true },
    })
    const companies = await prisma.company.findMany({
      where: { id: { in: groups.map((g) => g.companyId).filter((id): id is string => Boolean(id)) } },
      select: { id: true, name: true, slug: true, logoUrl: true, website: true },
    })
    const shaped = shapeRemoteCompanies(groups, companies)
    return { companies: shaped, totalRemoteJobs: shaped.reduce((n, c) => n + c._count.jobs, 0) }
  }),
)
