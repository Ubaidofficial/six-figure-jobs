// The jobs shown on /company/[slug]. The page and GET /api/company/[slug]/jobs both read them through here, so the
// list a visitor sees and the "Show more jobs" chunks come from one filter and one order.

import type { Prisma } from '@prisma/client'

import { prisma } from '../prisma'
import { buildWhere, jobListingSelect, type JobWithCompany } from '../jobs/queryJobs'
import { COMPANY_JOBS_PAGE_SIZE } from './jobsPaging'

/** Live $100k+ jobs of one company: the same public-job rules as every listing (fresh, not expired, salary gate). */
export function buildCompanyJobsWhere(slug: string): Prisma.JobWhereInput {
  return buildWhere({ companySlug: slug })
}

/** `id` last so jobs with equal pay and date keep one fixed order, otherwise a job can repeat or vanish between chunks. */
export const COMPANY_JOBS_ORDER_BY: Prisma.JobOrderByWithRelationInput[] = [
  { maxAnnual: 'desc' },
  { minAnnual: 'desc' },
  { createdAt: 'desc' },
  { id: 'asc' },
]

/** One chunk (page N of 10) of a company's jobs, and the total over all chunks. */
export async function getCompanyJobsChunk(slug: string, page: number) {
  const where = buildCompanyJobsWhere(slug)
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      select: jobListingSelect,
      orderBy: COMPANY_JOBS_ORDER_BY,
      skip: (page - 1) * COMPANY_JOBS_PAGE_SIZE,
      take: COMPANY_JOBS_PAGE_SIZE,
    }),
  ])
  return { total, jobs: jobs as unknown as JobWithCompany[] }
}
