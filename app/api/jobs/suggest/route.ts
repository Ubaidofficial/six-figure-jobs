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
import { prisma } from '@/lib/prisma'
import { buildWhere, queryJobs } from '@/lib/jobs/queryJobs'
import { buildSalaryText } from '@/lib/jobs/salary'
import { matchRolePages } from '@/lib/roles/relatedRoles'
import { loadRoleSlugCounts } from '@/lib/roles/roleSlugCounts'

const MAX_QUERY_LENGTH = 60
const MIN_QUERY_LENGTH = 2
const SHOWN = 5
const POPULAR_ROLES = 6
// Role pages first, then job titles from live listings that contain every typed word, up to this many rows in all.
const MAX_ROLE_ROWS = 6
const MAX_TITLE_WORDS = 4
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
          // Best matches by title first; the results page puts jobs tagged New first instead.
          newFirst: false,
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

    // Job titles from live listings ("Solutions Architect", 42), so a search finds roles that have no role page yet.
    try {
      const titles = await memoAsync(stableKey('suggest-titles', q.toLowerCase(), minAnnual, remoteMode), TTL_MS, () =>
        loadMatchingTitles(q, { minAnnual, remoteMode }),
      )
      const shown = new Set(result.roles.map((r) => r.label.toLowerCase()))
      for (const t of titles) {
        if (result.roles.length >= MAX_ROLE_ROWS) break
        if (shown.has(t.label.toLowerCase())) continue
        shown.add(t.label.toLowerCase())
        result.roles.push({
          label: t.label,
          href: `/jobs?${new URLSearchParams({ q: t.label, exact: '1' }).toString()}`,
          count: t.count,
        })
      }
    } catch (error) {
      console.error('[suggest] titles failed:', error instanceof Error ? error.message : error)
    }
  }
  return NextResponse.json(
    result,
    // Counts move slowly; let the CDN and browser reuse an answer for a few minutes.
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  )
}

/**
 * The most common live job titles containing every typed word (case-insensitive), with how many jobs have each. Titles
 * that differ only in case or spacing count as one, under their most common spelling.
 */
async function loadMatchingTitles(
  q: string,
  filters: { minAnnual?: number; remoteMode?: (typeof REMOTE_MODES)[number] },
): Promise<Array<{ label: string; count: number }>> {
  const words = q
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length >= 2)
    .slice(0, MAX_TITLE_WORDS)
  if (words.length === 0) return []
  const rows = await prisma.job.groupBy({
    by: ['title'],
    where: {
      AND: [
        buildWhere({ page: 1, pageSize: 1, ...filters }),
        ...words.map((w) => ({ title: { contains: w, mode: 'insensitive' as const } })),
      ],
    },
    _count: { _all: true },
    orderBy: { _count: { title: 'desc' } },
    take: 30,
  })
  const merged = new Map<string, { label: string; count: number; best: number }>()
  for (const row of rows) {
    const label = row.title.replace(/\s+/g, ' ').trim()
    const key = label.toLowerCase()
    const n = row._count._all
    const prev = merged.get(key)
    if (!prev) merged.set(key, { label, count: n, best: n })
    else {
      prev.count += n
      if (n > prev.best) Object.assign(prev, { label, best: n })
    }
  }
  return [...merged.values()].sort((a, b) => b.count - a.count).slice(0, MAX_ROLE_ROWS)
}

