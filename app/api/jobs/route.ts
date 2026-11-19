import { NextResponse } from 'next/server'
import { queryJobs } from '@/lib/jobs/queryJobs'
import { parseJobsListing } from '@/lib/jobs/jobsListQuery'
import { toPublicJob } from '@/lib/jobs/publicJob'
import { guardUiApi } from '@/lib/security/scrapeGuard'
const PAGE_SIZE = 24
// "Load more" reaches a few hundred jobs at most; walking a whole filter by page number is bulk copying.
const MAX_PAGE = 60
export async function GET(request: Request) {
  const blocked = guardUiApi(request)
  if (blocked) return blocked
  const { searchParams } = new URL(request.url)
  // A whole page number from 1; "abc" made this NaN and the query threw (500, found 2026-11-08), "-5" read as page 1.
  const page = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(searchParams.get('page'))) || 1))
  // The page's own parameters, read exactly as the /jobs page reads them (lib/jobs/jobsListQuery.ts).
  const { queryInput } = parseJobsListing(
    { get: (k) => searchParams.get(k) ?? undefined, getAll: (k) => searchParams.getAll(k) },
    page,
    PAGE_SIZE,
  )

  const data = await queryJobs(queryInput)

  // Public ids and precomputed links, no source fields (lib/jobs/publicJob.ts); BigInt becomes a string for JSON.
  const serializedData = JSON.parse(
    JSON.stringify({ ...data, jobs: data.jobs.map(toPublicJob) }, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  )

  return NextResponse.json(serializedData)
}
