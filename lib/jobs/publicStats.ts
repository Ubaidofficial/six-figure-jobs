import { cache } from 'react'

import { prisma } from '../prisma'
import { buildWhere } from './queryJobs'
import { MIN_COMPANY_INDEXABLE_JOBS } from '../seo/indexabilityGates'
import { newThisWeekClause } from './postedRecently'
import { DEFAULT_TTL_MS, memoAsync } from '../cache/memo'

export type PublicCompanyDirectoryEntry = {
  id: string
  name: string | null
  slug: string | null
  logoUrl: string | null
  website: string | null
  _count: { jobs: number }
}

function addAndClause(where: any, clause: any): any {
  return {
    ...where,
    AND: [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), clause],
  }
}

export const getPublicJobWhere = cache(() => buildWhere({}))

// Both loaders are cached per request (react cache) and across requests (memoAsync): /companies is rendered per request,
// and the groupBy over every public job plus the directory's per-company counts ran on each visit.
export const loadPublicSiteStats = cache(() => memoAsync('public-site-stats', DEFAULT_TTL_MS, loadPublicSiteStatsUncached))

async function loadPublicSiteStatsUncached() {
  const publicJobWhere = getPublicJobWhere()

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
    prisma.job.count({ where: addAndClause(publicJobWhere, newThisWeekClause()) }),
  ])

  const eligibleCompanyRows = companyRows.filter(
    (row) => row.companyId && Number(row._count?._all ?? 0) >= MIN_COMPANY_INDEXABLE_JOBS,
  )

  return {
    totalJobs,
    newThisWeek,
    /** Every company with at least one public job: the number to quote next to the total job count. */
    totalCompaniesHiring: companyRows.length,
    /** Only companies with MIN_COMPANY_INDEXABLE_JOBS or more jobs: the /companies directory. */
    totalCompanies: eligibleCompanyRows.length,
    totalCompanyDirectoryJobs: eligibleCompanyRows.reduce(
      (sum, row) => sum + Number(row._count?._all ?? 0),
      0,
    ),
    eligibleCompanyIds: eligibleCompanyRows.map((row) => row.companyId as string),
    publicJobWhere,
  }
}

export const loadEligibleCompaniesDirectory = cache(() => memoAsync('companies-directory', DEFAULT_TTL_MS, loadEligibleCompaniesDirectoryUncached))

async function loadEligibleCompaniesDirectoryUncached() {
  const {
    eligibleCompanyIds,
    totalCompanies,
    totalCompanyDirectoryJobs,
    totalCompaniesHiring,
    totalJobs,
    publicJobWhere,
  } = await loadPublicSiteStats()

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
            website: true,
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
    totalCompaniesHiring,
    totalJobs,
  }
}
