// app/search/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SearchUnavailablePage } from '@/components/runtime/FallbackPresets'
import {
  queryJobs,
  type JobWithCompany,
} from '../../lib/jobs/queryJobs'
import { withRuntimeFallback } from '@/lib/runtime/fallback'
import JobList from '../components/JobList'
import { SearchForm } from './SearchForm'
import { parseSearchQuery } from '../../lib/jobs/nlToFilters'
import { leftoverTokens } from '../../lib/search/leftover'
import { SITE_NAME, getSiteUrl } from '../../lib/seo/site'

// CDN-cacheable per-query. /search is noindex by design (X-Robots-Tag header in
// next.config), so caching has no SEO impact — but every search hit was
// re-rendering server-side under the previous `force-dynamic`. 60s ISR plus a
// public s-maxage gives identical queries a near-free hit while keeping results
// fresh enough for a job board.
export const revalidate = 60

const PAGE_SIZE = 40

type SearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  searchParams?: Promise<SearchParams>
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function resolveSearchParams(
  input?: Promise<SearchParams>
): Promise<SearchParams> {
  return (await input) || {}
}

function getParam(sp: SearchParams, key: string): string | undefined {
  const value = sp[key]
  if (Array.isArray(value)) return value[0]
  return value
}

function normalizeFreeText(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase()
  return normalized || undefined
}

function normalizeKeyword(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  return normalized || undefined
}

function normalizeLocation(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.length === 2) return trimmed.toUpperCase()
  return trimmed.toLowerCase()
}

function normalizeRemoteMode(
  value: string | undefined,
): 'remote' | 'hybrid' | 'onsite' | undefined {
  if (value === 'remote' || value === 'hybrid' || value === 'onsite') return value
  return undefined
}

function resolveCountryCode(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  return normalized.length === 2 ? normalized : undefined
}

function resolveSeniorityLevels(
  explicit: string | undefined,
  inferred: string | undefined,
): string[] | undefined {
  const value = (explicit || inferred || '').trim().toLowerCase()
  if (!value) return undefined

  switch (value) {
    case 'entry':
    case 'mid':
    case 'senior':
    case 'staff':
    case 'principal':
    case 'lead':
    case 'director':
    case 'vp':
      return [value]
    case 'executive':
      return ['director', 'vp']
    default:
      return undefined
  }
}

function normalizeSearchParams(sp: SearchParams): SearchParams {
  const page = Math.max(1, Number(getParam(sp, 'page') || '1') || 1)
  const minSalaryRaw = Number(getParam(sp, 'minSalary') || '100000')
  const minSalary = Math.max(100000, isNaN(minSalaryRaw) ? 100000 : minSalaryRaw)

  const normalized: SearchParams = {}

  const q = normalizeFreeText(getParam(sp, 'q'))
  const role = normalizeKeyword(getParam(sp, 'role'))
  const location = normalizeLocation(getParam(sp, 'location'))
  const remoteMode = normalizeKeyword(getParam(sp, 'remoteMode'))
  const remoteRegion = normalizeKeyword(getParam(sp, 'remoteRegion'))
  const seniority = normalizeKeyword(getParam(sp, 'seniority'))

  if (q) normalized.q = q
  if (role) normalized.role = role
  if (location) normalized.location = location
  if (remoteMode) normalized.remoteMode = remoteMode
  if (remoteRegion) normalized.remoteRegion = remoteRegion
  if (seniority) normalized.seniority = seniority
  if (minSalary > 100000 || getParam(sp, 'minSalary')) normalized.minSalary = String(minSalary)
  if (page > 1) normalized.page = String(page)

  return normalized
}

function buildSearchHref(sp: SearchParams, page: number): string {
  const params = new URLSearchParams()

  const q = getParam(sp, 'q')
  const role = getParam(sp, 'role')
  const location = getParam(sp, 'location')
  const remoteMode = getParam(sp, 'remoteMode')
  const minSalary = getParam(sp, 'minSalary')
  const remoteRegion = getParam(sp, 'remoteRegion')
  const seniority = getParam(sp, 'seniority')

  if (q) params.set('q', q)
  if (role) params.set('role', role)
  if (location) params.set('location', location)
  if (minSalary) params.set('minSalary', minSalary)
  if (remoteMode) params.set('remoteMode', remoteMode)
  if (remoteRegion) params.set('remoteRegion', remoteRegion)
  if (seniority) params.set('seniority', seniority)
  if (page > 1) params.set('page', String(page))

  const qs = params.toString()
  return qs ? `/search?${qs}` : '/search'
}

function buildTitle(sp: SearchParams): string {
  const q = getParam(sp, 'q')
  const location = getParam(sp, 'location')
  const remoteMode = getParam(sp, 'remoteMode')
  const remoteRegion = getParam(sp, 'remoteRegion')
  const minSalary = Number(getParam(sp, 'minSalary') || '100000') || 100000

  const salaryLabel =
    minSalary >= 300000
      ? '$300k+'
      : minSalary >= 200000
      ? '$200k+'
      : '$100k+'

  if (q && location) {
    return `${salaryLabel} ${q} jobs in ${location.toUpperCase()} | ${SITE_NAME}`
  }
  if (q && remoteRegion) {
    return `${salaryLabel} ${q} jobs (${remoteRegion}) | ${SITE_NAME}`
  }
  if (q) {
    return `${salaryLabel} ${q} jobs | ${SITE_NAME}`
  }
  if (location) {
    return `${salaryLabel} jobs in ${location.toUpperCase()} | ${SITE_NAME}`
  }
  if (remoteRegion) {
    return `${salaryLabel} remote jobs (${remoteRegion}) | ${SITE_NAME}`
  }
  return `${salaryLabel} tech jobs search | ${SITE_NAME}`
}

function buildCanonicalPath(sp: SearchParams): string {
  const params = new URLSearchParams()

  const q = getParam(sp, 'q')
  const role = getParam(sp, 'role')
  const location = getParam(sp, 'location')
  const remoteMode = getParam(sp, 'remoteMode')
  const minSalary = getParam(sp, 'minSalary')
  const remoteRegion = getParam(sp, 'remoteRegion')
  const seniority = getParam(sp, 'seniority')
  const page = Math.max(1, Number(getParam(sp, 'page') || '1') || 1)

  if (q) params.set('q', q)
  if (role) params.set('role', role)
  if (location) params.set('location', location)
  if (remoteMode) params.set('remoteMode', remoteMode)
  if (remoteRegion) params.set('remoteRegion', remoteRegion)
  if (seniority) params.set('seniority', seniority)
  if (minSalary) params.set('minSalary', minSalary)
  if (page > 1) params.set('page', String(page))

  const qs = params.toString()
  return qs ? `/search?${qs}` : `/search`
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = normalizeSearchParams(await resolveSearchParams(searchParams))
  const title = buildTitle(sp)
  const canonical = `${getSiteUrl()}${buildCanonicalPath(sp)}`

  const description =
    'Search curated $100k+ tech jobs from top companies. Filter by role, location, and salary band across remote, hybrid, and on-site roles.'

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index: false,
      follow: true,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function SearchPage({ searchParams }: PageProps) {
  const rawSp = await resolveSearchParams(searchParams)
  const sp = normalizeSearchParams(rawSp)
  const canonicalPath = buildCanonicalPath(sp)

  const requestedParams = new URLSearchParams()
  Object.entries(rawSp).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((val) => val != null && requestedParams.append(k, val))
    else if (v != null) requestedParams.set(k, v)
  })
  const rawPage = getParam(rawSp, 'page')
  if (!rawPage || Number(rawPage) <= 1) requestedParams.delete('page')
  const requestedPath = (() => {
    const qs = requestedParams.toString()
    return qs ? `/search?${qs}` : '/search'
  })()
  if (requestedPath !== canonicalPath) {
    redirect(canonicalPath)
  }

  const q = getParam(sp, 'q')?.trim() || ''
  const role = getParam(sp, 'role')?.trim() || ''
  const location = getParam(sp, 'location')?.trim() || ''
  const remoteMode = normalizeRemoteMode(getParam(sp, 'remoteMode')?.trim())
  const remoteRegion = getParam(sp, 'remoteRegion')?.trim() || ''
  const seniority = getParam(sp, 'seniority')?.trim() || ''
  const minSalaryParam = getParam(sp, 'minSalary')
  const minSalaryRaw = Number(minSalaryParam || '100000')
  const page = Math.max(1, Number(getParam(sp, 'page') || '1') || 1)

  const aiFilters = parseSearchQuery(q)

  const minAnnual = Math.max(
    100_000,
    isNaN(minSalaryRaw) ? 100_000 : minSalaryRaw,
    aiFilters.minAnnual ?? 0,
  )

  const resolvedLocation = location || aiFilters.countryCode || ''
  const resolvedRemoteMode = remoteMode || normalizeRemoteMode(aiFilters.remoteMode)
  const resolvedRemoteRegion = remoteRegion || aiFilters.remoteRegion || ''
  const resolvedSeniority = seniority || aiFilters.experienceLevel || ''
  // Roles guessed from free text are not used as filters: the guess maps skills to roles ("react" -> frontend + mobile
  // engineer, "data engineer" -> ... + recruiter) and then drops the words, so "react" found 1 job here and 84 from
  // the homepage box. The words go to the same keyword search as /jobs?q= instead; only an explicit ?role= filters.
  const roleSlugs = role ? [role] : []
  const resolvedCountryCode =
    resolvedLocation === 'remote' ? undefined : resolveCountryCode(resolvedLocation)
  const remoteOnly = resolvedLocation === 'remote' || (Boolean(aiFilters.remoteOnly) && !remoteMode)
  const seniorityLevels = resolveSeniorityLevels(seniority, aiFilters.experienceLevel)
  const hasUserMinSalary = Boolean(minSalaryParam) || aiFilters.minAnnual != null

  return withRuntimeFallback(
    'search.page',
    async () => {
      // The words not consumed by the country, remote, seniority or salary filters ("react developer" in
      // "senior react developer uk") are the keyword, searched with typo correction, aliases and relevance.
      const keyword = leftoverTokens(q, []).join(' ') || undefined

      const data = await queryJobs({
        page,
        pageSize: PAGE_SIZE,
        sortBy: keyword ? 'relevant' : 'salary',
        roleSlugs: roleSlugs.length ? roleSlugs : undefined,
        countryCode: resolvedCountryCode,
        remoteOnly: remoteOnly || undefined,
        remoteMode: resolvedRemoteMode,
        remoteRegion: resolvedRemoteRegion || undefined,
        seniorityLevels,
        // If the query already resolved to a structured role (e.g. "ML engineer" → machine-learning-engineer), the
        // raw phrase is not ANDed (it would require the literal text in the title and wipe out valid matches); only
        // the leftover words above are. With no structured match the whole query is the keyword.
        keyword,
        ...(hasUserMinSalary ? { minAnnual } : {}),
      })

      const jobs = data.jobs as JobWithCompany[]
      const hasNextPage = data.page * PAGE_SIZE < data.total
      const hasPrevPage = page > 1
      const paginationState: SearchParams = {
        ...sp,
        ...(resolvedLocation ? { location: resolvedLocation } : {}),
        ...(resolvedRemoteMode ? { remoteMode: resolvedRemoteMode } : {}),
        ...(resolvedRemoteRegion ? { remoteRegion: resolvedRemoteRegion } : {}),
        ...(resolvedSeniority ? { seniority: resolvedSeniority } : {}),
        ...(roleSlugs.length === 1 ? { role: roleSlugs[0] } : {}),
        minSalary: String(minAnnual),
      }

      const title = buildTitle(sp)

      return (
        <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-12 pt-10">
      {/* Search Form */}
      <div className="glass soft-shadow mb-6 rounded-2xl p-4 md:sticky md:top-24 md:z-30 md:mb-10 md:p-6">
        <SearchForm
          q={q}
          hasRole={Boolean(role)}
          location={resolvedLocation}
          remoteMode={resolvedRemoteMode ?? ''}
          minSalary={minSalaryRaw}
          remoteRegion={resolvedRemoteRegion}
          seniority={resolvedSeniority}
        />
      </div>

      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {q ? `Results for "${q}"` : 'All $100k+ Jobs'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {data.total.toLocaleString()}
              </span>{' '}
              opportunities found
              {resolvedLocation &&
                ` in ${resolvedLocation === 'remote' ? 'Remote' : resolvedLocation.toUpperCase()}`}
              {minAnnual > 100000 && ` paying $${(minAnnual / 1000).toFixed(0)}k+`}
            </p>
          </div>
        </div>
      </header>

      {/* Results */}
      {jobs.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="text-base font-semibold text-foreground">
            No jobs found.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your filters, or clear them to explore all $100k+ opportunities.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/search"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground transition hover:bg-foreground/5"
            >
              Clear filters
            </Link>
            <Link
              href="/"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 text-sm font-semibold text-[#0a0a0a] transition hover:brightness-95"
            >
              Explore newest opportunities
            </Link>
          </div>
        </div>
      ) : (
        <>
          <JobList jobs={jobs} headingLevel={2} />

          {/* Pagination */}
          <div className="mt-8 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Page <span className="font-semibold text-foreground">{page}</span> of{' '}
              <span className="font-semibold text-foreground">
                {data.totalPages}
              </span>
            </span>

            <div className="flex gap-2">
              {hasPrevPage && (
                <Link
                  href={buildSearchHref(paginationState, page - 1)}
                  className="focus-ring inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-foreground/5"
                >
                  ← Previous
                </Link>
              )}
              {hasNextPage && (
                <Link
                  href={buildSearchHref(paginationState, page + 1)}
                  className="focus-ring inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-foreground/5"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        </>
      )}
        </main>
      )
    },
    () => (
      <SearchUnavailablePage
        title="Search results are temporarily unavailable"
        description={
          q
            ? `Search results for "${q}" are temporarily unavailable while the production database reconnects. Browse the main jobs and remote hubs while live search access recovers.`
            : 'Search is temporarily unavailable while the production database reconnects. Browse the main jobs and remote hubs while live search access recovers.'
        }
        primaryHref={canonicalPath}
        primaryLabel={q ? `Retry "${q}" search` : 'Retry search'}
      />
    ),
  )
}
