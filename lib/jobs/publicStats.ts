import { cache } from 'react'

import { prisma } from '../prisma'
import { buildWhere } from './queryJobs'
import { MIN_COMPANY_INDEXABLE_JOBS } from '../seo/indexabilityGates'

export type PublicCompanyDirectoryEntry = {
  id: string
  name: string | null
  slug: string | null
  logoUrl: string | null
  _count: { jobs: number }
}

function addAndClause(where: any, clause: any): any {
  return {
    ...where,
    AND: [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), clause],
  }
}

export const getPublicJobWhere = cache(() => buildWhere({}))

export const loadPublicSiteStats = cache(async () => {
  const publicJobWhere = getPublicJobWhere()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [totalJobs, companyRows, newThisWeek] = await Promise.all([
    prisma.job.count({ where: publicJobWhere }),
    prisma.job.groupBy({
      by: ['companyId'],
      where: {
        ...publicJobWhere,
        companyId: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.job.count({
      where: addAndClause(publicJobWhere, {
        OR: [
          { lastSeenAt: { gte: weekAgo } },
          { postedAt: { gte: weekAgo } },
          { createdAt: { gte: weekAgo } },
        ],
      }),
    }),
  ])

  const eligibleCompanyRows = companyRows.filter(
    (row) => row.companyId && Number(row._count?._all ?? 0) >= MIN_COMPANY_INDEXABLE_JOBS,
  )

  return {
    totalJobs,
    newThisWeek,
    totalCompanies: eligibleCompanyRows.length,
    totalCompanyDirectoryJobs: eligibleCompanyRows.reduce(
      (sum, row) => sum + Number(row._count?._all ?? 0),
      0,
    ),
    eligibleCompanyIds: eligibleCompanyRows.map((row) => row.companyId as string),
    publicJobWhere,
  }
})

export const loadEligibleCompaniesDirectory = cache(async () => {
  const { eligibleCompanyIds, totalCompanies, totalCompanyDirectoryJobs, publicJobWhere } =
    await loadPublicSiteStats()

  const companies: PublicCompanyDirectoryEntry[] =
    eligibleCompanyIds.length === 0
      ? []
      : await prisma.company.findMany({
          where: {
            id: { in: eligibleCompanyIds },
          },
          orderBy: { name: 'asc' },
          take: 500,
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            _count: {
              select: {
                jobs: {
                  where: publicJobWhere,
                },
              },
            },
          },
        })

  return {
    companies,
    totalCompanies,
    totalEligibleJobs: totalCompanyDirectoryJobs,
  }
})
