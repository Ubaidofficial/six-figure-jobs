// The jobs shown on /company/[slug]. The page and GET /api/company/[slug]/jobs both read them through here, so the
// list a visitor sees and the "Show more jobs" chunks come from one filter and one order.

import type { Prisma } from '@prisma/client'

import { prisma } from '../prisma'
import { rankTime } from '../jobs/liveList'
import { buildWhere, jobListingSelect, type JobWithCompany } from '../jobs/queryJobs'
import { COMPANY_JOBS_PAGE_SIZE } from './jobsPaging'

/** Live $100k+ jobs of one company: the same public-job rules as every listing (fresh, not expired, salary gate). */
export function buildCompanyJobsWhere(slug: string): Prisma.JobWhereInput {
  return buildWhere({ companySlug: slug })
}

type Dated = { id: string; postedAt?: Date | string | null; createdAt?: Date | string | null }

/**
 * Newest first, by the date each row shows ("7h ago": the posting date, else when we added the job; rankTime), then id,
 * so the page and its "Show more jobs" chunks keep one fixed order (owner's report, 2026-11-25: "why latest jobs are not
 * at the top"; the list was by highest pay, so a job posted 7 hours ago sat among ones posted a week ago).
 */
export function newestFirst<T extends Dated>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => rankTime(b) - rankTime(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * One chunk (page N of 10) of a company's jobs, and the total over all chunks. Prisma cannot order by
 * COALESCE(postedAt, createdAt), so the company's job ids and dates are read (a company has hundreds of live jobs at
 * most), ordered with newestFirst, and only the chunk's rows are fetched.
 */
export async function getCompanyJobsChunk(slug: string, page: number) {
  const where = buildCompanyJobsWhere(slug)
  const all = await prisma.job.findMany({ where, select: { id: true, postedAt: true, createdAt: true } })
  const ids = newestFirst(all)
    .slice((page - 1) * COMPANY_JOBS_PAGE_SIZE, page * COMPANY_JOBS_PAGE_SIZE)
    .map((j) => j.id)
  const rows = ids.length ? await prisma.job.findMany({ where: { id: { in: ids } }, select: jobListingSelect }) : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  const jobs = ids.map((id) => byId.get(id)).filter(Boolean)
  return { total: all.length, jobs: jobs as unknown as JobWithCompany[] }
}
