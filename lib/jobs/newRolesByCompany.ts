// lib/jobs/newRolesByCompany.ts
//
// "Added in the last 24 hours": the companies that got the most new public jobs on 6figjobs in the last day, for the
// homepage strip. "Added" is when we first saw the job (createdAt), the same clock as the live feed, not the employer's
// posting date. Only companies with a company page that is allowed in the index (MIN_COMPANY_INDEXABLE_JOBS or more
// jobs, `eligibleCompanyIds`) are listed, so every chip links to a page we want Google to see.

import type { Prisma } from '@prisma/client'

import { memoAsync } from '@/lib/cache/memo'
import { prisma } from '@/lib/prisma'

export const NEW_ROLES_WINDOW_MS = 24 * 60 * 60 * 1000
export const NEW_ROLES_TTL_MS = 5 * 60 * 1000
export const NEW_ROLES_LIMIT = 24
/** Busiest companies read before the eligibility filter, so filtered-out ones do not leave the strip short. */
const GROUPS_READ = 80

export type NewRolesCompany = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  website: string | null
  newJobs: number
}

type Group = { companyId: string | null; _count: { _all: number } }
type CompanyRow = {
  id: string
  name: string | null
  slug: string | null
  logoUrl: string | null
  website: string | null
}

/** Pure: groups and company rows to strip entries, most new jobs first (ties by name), eligible companies only. */
export function shapeNewRolesCompanies(
  groups: ReadonlyArray<Group>,
  companies: ReadonlyArray<CompanyRow>,
  eligibleIds: ReadonlySet<string>,
  limit: number = NEW_ROLES_LIMIT,
): NewRolesCompany[] {
  const byId = new Map(companies.map((c) => [c.id, c]))
  const out: NewRolesCompany[] = []
  for (const group of groups) {
    const id = group.companyId
    const company = id ? byId.get(id) : undefined
    if (!id || !company || !eligibleIds.has(id)) continue
    const name = company.name?.trim()
    const slug = company.slug?.trim()
    if (!name || !slug) continue
    out.push({ id, name, slug, logoUrl: company.logoUrl, website: company.website, newJobs: group._count._all })
  }
  return out.sort((a, b) => b.newJobs - a.newJobs || a.name.localeCompare(b.name)).slice(0, limit)
}

export function loadNewRolesByCompany(
  publicJobWhere: Prisma.JobWhereInput,
  eligibleCompanyIds: ReadonlyArray<string>,
): Promise<NewRolesCompany[]> {
  return memoAsync('home:new-roles-by-company', NEW_ROLES_TTL_MS, async () => {
    const since = new Date(Date.now() - NEW_ROLES_WINDOW_MS)
    const groups = await prisma.job.groupBy({
      by: ['companyId'],
      where: { AND: [publicJobWhere, { companyId: { not: null }, createdAt: { gte: since } }] },
      _count: { _all: true },
      orderBy: { _count: { companyId: 'desc' } },
      take: GROUPS_READ,
    })
    const ids = groups.map((g) => g.companyId).filter((id): id is string => Boolean(id))
    if (ids.length === 0) return []
    const companies = await prisma.company.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true, logoUrl: true, website: true },
    })
    return shapeNewRolesCompanies(groups, companies, new Set(eligibleCompanyIds))
  })
}
