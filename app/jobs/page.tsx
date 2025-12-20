import type { Metadata } from 'next'
import Link from 'next/link'
import { JobCard } from '@/components/jobs/JobCard'

import {
  buildWhere,
  queryJobs,
  type JobQueryInput,
  type JobWithCompany,
} from '../../lib/jobs/queryJobs'
import { prisma } from '../../lib/prisma'
import { SITE_NAME, getSiteUrl } from '../../lib/seo/site'
import { formatRelativeTime } from '@/lib/utils/time'

import { JobsFiltersPanel, type JobsFacets } from './_components/JobsFilters'
import { JobsToolbar } from './_components/JobsToolbar'
import styles from './JobsPage.module.css'

export const revalidate = 600
export const dynamic = 'force-dynamic'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 24

export const metadata: Metadata = {
  title: `All $100k+ Jobs | ${SITE_NAME}`,
  description:
    'Browse verified $100k+ jobs from ATS-powered company job boards. Filter by location, work type, role, and seniority — no entry-level clutter.',
  alternates: {
    canonical: `${SITE_URL}/jobs`,
  },
  openGraph: {
    title: `All $100k+ Jobs | ${SITE_NAME}`,
    description:
      'Browse verified $100k+ jobs. Filter by location, work type, role, and seniority — no entry-level clutter.',
    url: `${SITE_URL}/jobs`,
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `All $100k+ Jobs | ${SITE_NAME}`,
    description:
      'Browse verified $100k+ jobs from ATS-powered company job boards.',
  },
}

type BandConfig = {
  id: '100k' | '200k' | '300k' | '400k'
  label: string
  blurb: string
  href: string
  slugPrefix: string // matches JobSlice.slug prefix from seedJobSlices
}

const BANDS: BandConfig[] = [
  {
    id: '100k',
    label: '$100k+ tech jobs from top companies',
    blurb:
      'Curated $100k+ tech and software roles from ATS-powered company boards.',
    href: '/jobs/100k-plus',
    slugPrefix: 'jobs/100k-plus',
  },
  {
    id: '200k',
    label: '$200k+ tech jobs from top companies',
    blurb:
      'Principal, leadership, and specialist roles with $200k+ compensation.',
    href: '/jobs/200k-plus',
    slugPrefix: 'jobs/200k-plus',
  },
  {
    id: '300k',
    label: '$300k+ tech jobs',
    blurb: 'Executive-track and top-comp principal roles with $300k+ packages.',
    href: '/jobs/300k-plus',
    slugPrefix: 'jobs/300k-plus',
  },
  {
    id: '400k',
    label: '$400k+ executive tech jobs',
    blurb: 'Executive and top-comp band roles with $400k+ compensation.',
    href: '/jobs/400k-plus',
    slugPrefix: 'jobs/400k-plus',
  },
]

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type SearchParams = Record<string, string | string[] | undefined>

function firstParam(sp: SearchParams, key: string): string | undefined {
  const value = sp[key]
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function allParams(sp: SearchParams, key: string): string[] {
  const value = sp[key]
  const values = (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)
  return Array.from(new Set(values))
}

function parsePage(sp: SearchParams): number {
  const n = Number(firstParam(sp, 'page') || '1') || 1
  return Math.max(1, n)
}

function buildPageHref(basePath: string, sp: SearchParams, page: number): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'page') continue
    if (Array.isArray(v)) v.forEach((val) => val != null && params.append(k, val))
    else if (v != null) params.set(k, v)
  }
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

function resolveCurrencyFromCountryCode(code?: string | null): string | null {
  const cc = (code || '').toUpperCase()
  if (!cc) return null
  const map: Record<string, string> = {
    US: 'USD',
    GB: 'GBP',
    CA: 'CAD',
    DE: 'EUR',
    NL: 'EUR',
    AU: 'AUD',
  }
  return map[cc] ?? null
}

function prettyRoleAndCountryFromSlug(slug: string): string {
  // e.g. jobs/100k-plus/software-engineer/us
  const parts = slug.split('/')

  // Expect: ["jobs", "100k-plus", "role-slug", "country-code"]
  const roleSlug = parts[2] || ''
  const countryCode = (parts[3] || '').toUpperCase()

  const roleLabel = roleSlug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  if (!roleLabel) return slug
  if (!countryCode) return roleLabel
  return `${roleLabel} · ${countryCode}`
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function JobsIndexPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const sp = (await searchParams) || {}
  const page = parsePage(sp)

  const rawCountry = (firstParam(sp, 'country') || '').trim().toUpperCase()
  const country = rawCountry.length === 2 ? rawCountry : undefined

  const rawRemoteMode = (firstParam(sp, 'remoteMode') || '').trim()
  const remoteMode: '' | 'remote' | 'hybrid' | 'onsite' =
    rawRemoteMode === 'remote' || rawRemoteMode === 'hybrid' || rawRemoteMode === 'onsite'
      ? rawRemoteMode
      : ''

  const rawSort = (firstParam(sp, 'sort') || 'recent').trim()
  const sort = rawSort === 'recent' || rawSort === 'salary' || rawSort === 'relevant' ? rawSort : 'recent'

  const rawView = (firstParam(sp, 'view') || 'grid').trim()
  const view: 'grid' | 'list' = rawView === 'list' ? 'list' : 'grid'

  const roles = allParams(sp, 'role')
  const seniority = allParams(sp, 'seniority')
  const companySizes = allParams(sp, 'companySize')

  const minSalaryRaw = Number(firstParam(sp, 'minSalary') || '') || null
  const minSalary =
    minSalaryRaw && Number.isFinite(minSalaryRaw)
      ? Math.min(450_000, Math.max(100_000, minSalaryRaw))
      : null
  const salaryCurrency = minSalary ? resolveCurrencyFromCountryCode(country) ?? 'USD' : null

  const queryInput: JobQueryInput = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: sort === 'recent' ? 'date' : 'salary',
    roleSlugs: roles.length ? roles : undefined,
    countryCode: country || undefined,
    remoteMode: remoteMode || undefined,
    seniorityLevels: seniority.length ? seniority : undefined,
    companySizeBuckets: companySizes.length ? companySizes : undefined,
    ...(minSalary && salaryCurrency ? { currency: salaryCurrency, minAnnual: minSalary } : {}),
  }

  const data = await queryJobs(queryInput)
  const jobs = data.jobs as JobWithCompany[]

  const baseFacetInput: JobQueryInput = {
    ...queryInput,
    page: 1,
    pageSize: 1,
  }

  const [roleRows, countryRows, remoteCount, hybridCount, onsiteCount] =
    await Promise.all([
      prisma.job.groupBy({
        by: ['roleSlug'],
        where: {
          ...buildWhere({ ...baseFacetInput, roleSlugs: undefined }),
          roleSlug: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { roleSlug: 'desc' } },
        take: 20,
      }),
      prisma.job.groupBy({
        by: ['countryCode'],
        where: {
          ...buildWhere({ ...baseFacetInput, countryCode: undefined }),
          countryCode: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { countryCode: 'desc' } },
        take: 40,
      }),
      prisma.job.count({
        where: buildWhere({ ...baseFacetInput, remoteMode: 'remote' }),
      }),
      prisma.job.count({
        where: buildWhere({ ...baseFacetInput, remoteMode: 'hybrid' }),
      }),
      prisma.job.count({
        where: buildWhere({ ...baseFacetInput, remoteMode: 'onsite' }),
      }),
    ])

  const facets: JobsFacets = {
    roles: roleRows
      .map((r) => ({
        value: (r as any).roleSlug as string,
        count: Number((r as any)._count?._all ?? 0),
      }))
      .filter((r) => Boolean(r.value)),
    countries: countryRows
      .map((r) => ({
        value: String((r as any).countryCode || '').toUpperCase(),
        count: Number((r as any)._count?._all ?? 0),
      }))
      .filter((r) => r.value),
    workTypes: {
      remote: remoteCount,
      hybrid: hybridCount,
      onsite: onsiteCount,
    },
  }

  // ✅ UI dedupe: collapse identical ATS duplicates (same company + title + comp)
  const seen = new Set<string>()
  const dedupedJobs = jobs.filter((job: any) => {
    const companyId = job.companyId || job.companyRef?.id || ''
    const title = (job.title || '').trim().toLowerCase()
    const min = String(job.minAnnual ?? '')
    const max = String(job.maxAnnual ?? '')
    const key = `${companyId}:${title}:${min}:${max}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const mostRecentUpdateMs = dedupedJobs.reduce((acc, job: any) => {
    const candidate = job?.updatedAt ?? job?.postedAt ?? job?.createdAt ?? null
    if (!candidate) return acc
    const ms = new Date(candidate).getTime()
    if (!Number.isFinite(ms)) return acc
    return ms > acc ? ms : acc
  }, 0)

  const lastUpdatedLabel = mostRecentUpdateMs ? formatRelativeTime(mostRecentUpdateMs) : null

  // For each salary band, pull the most popular role+country JobSlices
  const bandSlices = await Promise.all(
    BANDS.map((band) =>
      prisma.jobSlice.findMany({
        where: {
          slug: {
            startsWith: `${band.slugPrefix}/`,
          },
          jobCount: {
            gt: 0,
          },
        },
        orderBy: {
          jobCount: 'desc',
        },
        take: 12,
      })
    )
  )

  const basePath = '/jobs'
  const totalPages = data.totalPages

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Jobs</span>
      </nav>

      <header className={styles.top}>
        <div className={styles.titleBlock}>
          <div className={styles.kicker}>PREMIUM JOB FEED</div>
          <h1 className={styles.title}>All $100k+ Jobs</h1>
          <p className={styles.subtitle}>
            {data.total.toLocaleString()} opportunities found. Verified salaries only — no
            entry-level noise.
          </p>
        </div>
        <JobsToolbar facets={facets} />
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Filters">
          <JobsFiltersPanel facets={facets} />
        </aside>

        <section className={styles.results} aria-label="Job results">
          <div className={styles.resultsHeader}>
            <div className={styles.resultsCount}>
              Showing page {data.page} of {totalPages} • {data.total.toLocaleString()} total
              {lastUpdatedLabel ? ` • Updated ${lastUpdatedLabel}` : ''}
            </div>
            <div />
          </div>

          {dedupedJobs.length === 0 ? (
            <div className={styles.empty} role="status">
              <div className={styles.emptyTitle}>No jobs found.</div>
              <div className={styles.emptyBody}>
                Try adjusting your filters, or clear them to explore all $100k+ opportunities.
              </div>
              <div className={styles.emptyActions}>
                <Link className={`${styles.pageLink} ${styles.clearFiltersLink}`} href="/jobs">
                  Clear filters
                </Link>
              </div>
            </div>
          ) : (
            <div className={view === 'list' ? styles.list : styles.grid}>
              {dedupedJobs.map((job) => (
                <JobCard key={job.id} job={job as JobWithCompany} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav className={styles.pagination} aria-label="Pagination">
              <div className={styles.pageMeta}>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </div>
              <div className={styles.pageLinks}>
                {page > 1 && (
                  <Link className={styles.pageLink} href={buildPageHref(basePath, sp, page - 1)} scroll={false}>
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link className={styles.pageLink} href={buildPageHref(basePath, sp, page + 1)} scroll={false}>
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </section>
      </div>

      <section className={styles.below} aria-label="Browse salary bands">
        <div className={styles.belowHeader}>
          <h2 className={styles.belowTitle}>Browse by salary band</h2>
          <p className={styles.belowBlurb}>
            Explore dedicated pages for $100k+, $200k+, $300k+, and $400k+ roles, plus popular role
            and country slices.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {BANDS.map((band) => (
            <Link
              key={band.id}
              href={band.href}
              className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/80 p-4 transition hover:border-slate-600 hover:bg-slate-900"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {band.id === '100k'
                    ? 'Core band'
                    : band.id === '200k'
                    ? 'Senior band'
                    : band.id === '300k'
                    ? 'Principal band'
                    : 'Executive band'}
                </p>
                <h3 className="mt-2 text-sm font-semibold text-slate-50">{band.label}</h3>
                <p className="mt-2 text-xs text-slate-300">{band.blurb}</p>
              </div>
              <p className="mt-3 text-[11px] text-slate-400">View all {band.id}+ jobs →</p>
            </Link>
          ))}
        </div>

        {BANDS.map((band, idx) => {
          const slices = bandSlices[idx]

          if (!slices || slices.length === 0) {
            return null
          }

          return (
            <section key={band.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-50">
                  Popular {band.id}+ jobs by role &amp; country
                </h3>
                <Link href={band.href} className="text-[11px] text-blue-400 hover:underline">
                  View all {band.id}+ jobs →
                </Link>
              </div>

              <ul className="flex flex-wrap gap-2 text-[11px]">
                {slices.map((slice: any) => (
                  <li key={slice.slug}>
                    <Link
                      href={`/${slice.slug}`}
                      className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-slate-200 hover:border-slate-600 hover:bg-slate-900"
                    >
                      <span className="truncate">
                        {slice.title || slice.h1 || prettyRoleAndCountryFromSlug(slice.slug)}
                      </span>
                      <span className="ml-1 text-slate-500">({slice.jobCount})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </section>
    </main>
  )
}
