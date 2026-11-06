// GET /api/jobs/suggest?q=seo&minSalary=100000&remoteMode=remote
// Instant results for the homepage search box: the jobs that best match what has been typed, and how many match in all.
// It runs the same keyword search as /jobs?q= (typo correction, aliases, relevance), with the salary and work-arrangement
// choices the visitor has made in the form, so the total is what the Search button would show. Never an error to the
// page: if the lookup fails the box simply has no results and the search still works.

import { NextResponse } from 'next/server'

import { memoAsync, stableKey } from '@/lib/cache/memo'
import { buildJobSlugHref } from '@/lib/jobs/jobSlug'
import { queryJobs } from '@/lib/jobs/queryJobs'
import { buildSalaryText } from '@/lib/jobs/salary'

const MAX_QUERY_LENGTH = 60
const MIN_QUERY_LENGTH = 2
const SHOWN = 5
const TTL_MS = 5 * 60 * 1000
const REMOTE_MODES = ['remote', 'hybrid', 'onsite'] as const

export type SuggestResult = {
  total: number
  jobs: Array<{ title: string; company: string; pay: string | null; href: string }>
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const q = (params.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH)
  const salary = Number(params.get('minSalary'))
  const minAnnual = Number.isFinite(salary) && salary >= 50_000 && salary <= 1_000_000 ? salary : undefined
  const remoteMode = REMOTE_MODES.find((m) => m === params.get('remoteMode'))

  let result: SuggestResult = { total: 0, jobs: [] }
  if (q.length >= MIN_QUERY_LENGTH) {
    try {
      result = await memoAsync(stableKey('suggest', q.toLowerCase(), minAnnual, remoteMode), TTL_MS, async () => {
        const found = await queryJobs({
          keyword: q,
          sortBy: 'relevant',
          page: 1,
          pageSize: SHOWN,
          ...(minAnnual ? { minAnnual } : {}),
          ...(remoteMode ? { remoteMode } : {}),
        })
        return {
          total: found.total,
          jobs: found.jobs.map((job) => ({
            title: job.title,
            company: job.company,
            pay: buildSalaryText(job),
            href: buildJobSlugHref(job as any),
          })),
        }
      })
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
