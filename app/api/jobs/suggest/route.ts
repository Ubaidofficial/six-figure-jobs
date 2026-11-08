// GET /api/jobs/suggest?q=seo&minSalary=100000&remoteMode=remote
// Instant results for the search boxes: role pages whose name matches what has been typed, the jobs that best match,
// and how many jobs match in all. It runs the same keyword search as /jobs?q= (typo correction, aliases, relevance),
// with the salary and work-arrangement choices the visitor has made in the form, so the total is what the Search
// button would show. With no query, `roles` holds the roles with the most jobs (shown when the empty box is focused).
// Never an error to the page: if a lookup fails that part is empty and the search still works.

import { NextResponse } from 'next/server'

import { memoAsync, stableKey } from '@/lib/cache/memo'
import { buildLogoUrl } from '@/lib/companies/logo'
import { buildJobSlugHref } from '@/lib/jobs/jobSlug'
import { queryJobs } from '@/lib/jobs/queryJobs'
import { buildSalaryText } from '@/lib/jobs/salary'
import { matchRolePages } from '@/lib/roles/relatedRoles'
import { loadRoleSlugCounts } from '@/lib/roles/roleSlugCounts'

const MAX_QUERY_LENGTH = 60
const MIN_QUERY_LENGTH = 2
const SHOWN = 5
const POPULAR_ROLES = 6
const TTL_MS = 5 * 60 * 1000
const REMOTE_MODES = ['remote', 'hybrid', 'onsite'] as const

export type SuggestResult = {
  total: number
  jobs: Array<{ title: string; company: string; pay: string | null; href: string; logo: string | null }>
  roles: Array<{ label: string; href: string; count: number }>
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const q = (params.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH)
  const salary = Number(params.get('minSalary'))
  const minAnnual = Number.isFinite(salary) && salary >= 50_000 && salary <= 1_000_000 ? salary : undefined
  const remoteMode = REMOTE_MODES.find((m) => m === params.get('remoteMode'))

  const result: SuggestResult = { total: 0, jobs: [], roles: [] }

  // Roles for an empty box (the biggest) or a real query; a single character matches too much to be useful.
  if (q === '' || q.length >= MIN_QUERY_LENGTH) {
    const counts = await loadRoleSlugCounts()
    result.roles = matchRolePages(q, counts, q ? 3 : POPULAR_ROLES).map((r) => ({
      label: r.label,
      href: `/jobs/${r.slug}`,
      count: r.total,
    }))
  }

  if (q.length >= MIN_QUERY_LENGTH) {
    try {
      const found = await memoAsync(stableKey('suggest', q.toLowerCase(), minAnnual, remoteMode), TTL_MS, async () => {
        const data = await queryJobs({
          keyword: q,
          sortBy: 'relevant',
          page: 1,
          pageSize: SHOWN,
          ...(minAnnual ? { minAnnual } : {}),
          ...(remoteMode ? { remoteMode } : {}),
        })
        return {
          total: data.total,
          jobs: data.jobs.map((job) => ({
            title: job.title,
            company: job.company,
            pay: buildSalaryText(job),
            href: buildJobSlugHref(job as any),
            logo: buildLogoUrl(job.companyRef?.logoUrl ?? null, job.companyRef?.website ?? null, job.company),
          })),
        }
      })
      result.total = found.total
      result.jobs = found.jobs
    } catch (error) {
      console.error('[suggest] search failed:', error instanceof Error ? error.message : error)
    }
  }
  return NextResponse.json(
    result,
    // Counts move slowly; let the CDN and browser reuse an answer for a few minutes.
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  )
}
