import { NextResponse } from 'next/server'
import { memoAsync, stableKey } from '@/lib/cache/memo'
import { queryJobs } from '@/lib/jobs/queryJobs'
import { parseJobsListing } from '@/lib/jobs/jobsListQuery'
import { toPublicJob } from '@/lib/jobs/publicJob'
import { guardUiApi } from '@/lib/security/scrapeGuard'
const PAGE_SIZE = 24
// "Load more" reaches a few hundred jobs at most; walking a whole filter by page number is bulk copying.
const MAX_PAGE = 60
// The "live" poll (page 1 again, to find jobs added since the page loaded) is the same for everyone with the same filters.
const LIVE_TTL_MS = 15_000
// A role page (/jobs/<role>) reads fewer parameters than /jobs: not q, tech, visa or exact, and one role, set by the path.
const ROLE_PAGE_IGNORES = new Set(['q', 'tech', 'visa', 'exact'])
export async function GET(request: Request) {
  const blocked = guardUiApi(request)
  if (blocked) return blocked
  const { searchParams } = new URL(request.url)
  // A whole page number from 1; "abc" made this NaN and the query threw (500, found 2026-11-08), "-5" read as page 1.
  const page = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(searchParams.get('page'))) || 1))
  // The page's own parameters, read exactly as the /jobs page reads them (lib/jobs/jobsListQuery.ts). A role page sends
  // scope=role, role=<its slug> and its own skill filters, and is read the way RoleTemplate reads them.
  const scopeRole = searchParams.get('scope') === 'role'
  const { queryInput } = parseJobsListing(
    {
      get: (k) => (scopeRole && ROLE_PAGE_IGNORES.has(k) ? undefined : searchParams.get(k) ?? undefined),
      getAll: (k) => (scopeRole && ROLE_PAGE_IGNORES.has(k) ? [] : scopeRole && k === 'role' ? searchParams.getAll(k).slice(0, 1) : searchParams.getAll(k)),
    },
    page,
    PAGE_SIZE,
  )
  const skillSlugs = scopeRole ? searchParams.getAll('skill') : []
  if (skillSlugs.length) queryInput.skillSlugs = skillSlugs

  const live = page === 1 && searchParams.get('live') === '1'
  const data = live
    ? await memoAsync(stableKey('jobs-api-live', queryInput), LIVE_TTL_MS, () => queryJobs(queryInput))
    : await queryJobs(queryInput)

  // Public ids and precomputed links, no source fields (lib/jobs/publicJob.ts); BigInt becomes a string for JSON.
  const serializedData = JSON.parse(
    JSON.stringify({ ...data, jobs: data.jobs.map(toPublicJob) }, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  )

  return NextResponse.json(serializedData)
}
