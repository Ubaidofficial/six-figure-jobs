// GET /api/company/<slug>/jobs?page=2
// The next ten live $100k+ jobs of a company, for the "Show more jobs" button on /company/<slug>. Same filter and
// order as the page itself (lib/companies/companyJobs.ts); the page size is fixed at 10 and cannot be raised.
// Without JavaScript the button is a plain link to /company/<slug>/page/2, so this endpoint is only an enhancement.

import { NextResponse } from 'next/server'

import { memoAsync, stableKey } from '@/lib/cache/memo'
import { getCompanyJobsChunk } from '@/lib/companies/companyJobs'
import { COMPANY_JOBS_PAGE_SIZE, companyJobsTotalPages, parseCompanyJobsPage } from '@/lib/companies/jobsPaging'
import { toPublicJob } from '@/lib/jobs/publicJob'

const TTL_MS = 5 * 60 * 1000
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,149}$/

const toNumber = (value: bigint | number | null | undefined) => (value == null ? null : Number(value))

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pageParam = new URL(request.url).searchParams.get('page')
  const page = parseCompanyJobsPage(pageParam ?? '1')
  if (!SLUG_PATTERN.test(slug) || page === null) {
    return NextResponse.json({ error: 'Invalid company or page.' }, { status: 400 })
  }

  try {
    const { total, jobs } = await memoAsync(stableKey('company-jobs', slug, page), TTL_MS, () => getCompanyJobsChunk(slug, page))
    // The salary columns are BigInt, which JSON cannot carry. They go out as numbers, not strings: buildSalaryText (used
    // by JobCard) only reads number | bigint, so a string would make the appended cards lose their salary.
    const body = {
      jobs: jobs.map(toPublicJob).map((job) => ({
        ...job,
        minAnnual: toNumber(job.minAnnual),
        maxAnnual: toNumber(job.maxAnnual),
        salaryMin: toNumber(job.salaryMin),
        salaryMax: toNumber(job.salaryMax),
      })),
      total,
      page,
      pageSize: COMPANY_JOBS_PAGE_SIZE,
      totalPages: companyJobsTotalPages(total),
    }
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('[company-jobs] lookup failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Could not load jobs.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
