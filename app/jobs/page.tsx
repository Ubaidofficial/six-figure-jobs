import type { Metadata } from 'next'
import Link from 'next/link'
import { JobCard } from '@/components/jobs/JobCard'
import { InfiniteJobsList } from './_components/InfiniteJobsList'

import {
  buildWhere,
  queryJobs,
  type JobQueryInput,
  type JobWithCompany,
} from '../../lib/jobs/queryJobs'
import { prisma } from '../../lib/prisma'
import { buildItemListJsonLd } from '../../lib/seo/itemListJsonLd'
import { resolveSliceCanonicalPath } from '../../lib/seo/canonical'
import { buildCleanJobsCanonicalPath, shouldNoindexListingPage } from '../../lib/seo/listingSearchParams'
import { SITE_NAME, getSiteUrl } from '../../lib/seo/site'
import { parseSliceFilters } from '../../lib/slices/types'
import { formatRelativeTime } from '@/lib/utils/time'
import { logRuntimeFallback } from '@/lib/runtime/fallback'

import { JobsFiltersPanel, type JobsFacets } from './_components/JobsFilters'
import { JobsToolbar } from './_components/JobsToolbar'
import styles from './JobsPage.module.css'
import { PageStatGrid } from '@/components/seo/PageChrome'

export const revalidate = 600

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 24

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

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = (await searchParams) || {}
  const canonicalPath = buildCleanJobsCanonicalPath(sp)
  const canonical = `${SITE_URL}${canonicalPath}`
  const shouldNoindex = shouldNoindexListingPage(sp)

  return {
    title: `Six-Figure Tech Jobs — Browse $100k+ Openings | ${SITE_NAME}`,
    description:
      'Browse thousands of verified $100k+ tech jobs with published salaries, direct apply links, and real-time ATS listings. Filter by role, location, remote work, seniority, and company size.',
    alternates: {
      canonical,
    },
    robots: shouldNoindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: `Six-Figure Tech Jobs — Browse $100k+ Openings | ${SITE_NAME}`,
      description:
        'Thousands of verified $100k+ tech jobs with salary ranges, direct apply links, and fresh listings by role, location, and work type.',
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Six-Figure Tech Jobs — Browse $100k+ Openings | ${SITE_NAME}`,
      description:
        'Thousands of verified $100k+ tech jobs with published salaries, direct apply links, and fresh ATS listings.',
    },
  }
}

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

function buildJobsBreadcrumbJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${SITE_URL}/jobs` },
    ],
  }
}

function buildJobsCollectionPageJsonLd(totalJobs: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'All $100k+ jobs',
    description: `Browse ${totalJobs.toLocaleString()} verified $100k+ jobs from company ATS feeds and trusted sources.`,
    url: `${SITE_URL}/jobs`,
    about: [
      'verified $100k+ jobs',
      'six figure jobs',
      'high paying jobs',
      'remote jobs',
      'published salary ranges',
    ],
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
}

function buildJobsFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Are these six-figure jobs verified?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. The jobs index prioritizes live roles from company ATS feeds and trusted sources, then filters to verified six-figure compensation.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I browse by salary band, country, and role?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. The jobs hub links into salary-band pages, role pages, country pages, and category pages so searchers can land on more specific six-figure job slices.',
        },
      },
      {
        '@type': 'Question',
        name: 'How often is the jobs feed refreshed?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Listings are refreshed frequently and stale jobs are removed so the main jobs index stays current and useful for applicants and search engines.',
        },
      },
    ],
  }
}

function JobsIndexFallback({ techFilter }: { techFilter?: string }) {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-14 pt-10">
      <div className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-8 shadow-2xl shadow-neutral-950/40">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
          Live job data temporarily unavailable
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-50">All $100k+ Jobs</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-300">
          The production database is reconnecting. Search metadata is still live, but the full job
          feed is temporarily unavailable.
          {techFilter ? ` Active filter: ${techFilter}.` : ''}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BANDS.map((band) => (
            <Link
              key={band.id}
              href={band.href}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 text-sm text-neutral-100 transition hover:border-neutral-600"
            >
              <div className="font-semibold">{band.label}</div>
              <p className="mt-2 text-xs text-neutral-400">{band.blurb}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
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
  const techFilter = (firstParam(sp, 'tech') || '').trim() || undefined
  const keyword = (firstParam(sp, 'q') || '').trim() || undefined

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
  const activeFilterCount =
    roles.length +
    seniority.length +
    companySizes.length +
    (country ? 1 : 0) +
    (remoteMode ? 1 : 0) +
    (techFilter ? 1 : 0) +
    (keyword ? 1 : 0) +
    (minSalary ? 1 : 0)

  const queryInput: JobQueryInput = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: sort === 'recent' ? 'date' : 'salary',
    roleSlugs: roles.length ? roles : undefined,
    countryCode: country || undefined,
    remoteMode: remoteMode || undefined,
    seniorityLevels: seniority.length ? seniority : undefined,
    companySizeBuckets: companySizes.length ? companySizes : undefined,
    tech: techFilter,
    keyword,
    ...(minSalary && salaryCurrency ? { currency: salaryCurrency, minAnnual: minSalary } : {}),
  }

  try {
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
  const bandCanonicalLinks = bandSlices.map((slices) => {
    const seen = new Set<string>()
    const normalized: Array<{
      slug: string
      title: string | null
      h1: string | null
      jobCount: number
      href: string
    }> = []

    for (const slice of slices) {
      const parsed = parseSliceFilters(slice)
      const roleSlug = parsed.filters.roleSlugs?.[0]?.toLowerCase()
      if (roleSlug === 'other') continue

      const canonicalPath = resolveSliceCanonicalPath(parsed.filters, parsed.slug)
      if (!canonicalPath || !canonicalPath.startsWith('/')) continue
      if (canonicalPath.includes('/other/')) continue
      if (seen.has(canonicalPath)) continue
      seen.add(canonicalPath)

      normalized.push({
        slug: slice.slug,
        title: slice.title,
        h1: slice.h1,
        jobCount: slice.jobCount,
        href: canonicalPath,
      })
    }

    return normalized.slice(0, 12)
  })

  const basePath = '/jobs'
  const totalPages = data.totalPages
  const breadcrumbJsonLd = buildJobsBreadcrumbJsonLd()
  const itemListJsonLd = buildItemListJsonLd({
    name: 'All $100k+ jobs',
    jobs: dedupedJobs.map((job) => ({ id: job.id, title: job.title })),
    page,
    pageSize: PAGE_SIZE,
  })
  const collectionPageJsonLd = buildJobsCollectionPageJsonLd(data.total)
  const faqJsonLd = buildJobsFaqJsonLd()

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

      <div className="mb-8">
        <PageStatGrid
          items={[
            {
              label: 'Live opportunities',
              value: data.total.toLocaleString(),
              hint: 'Verified six-figure openings in the current result set',
            },
            {
              label: 'Page freshness',
              value: lastUpdatedLabel ? `Updated ${lastUpdatedLabel}` : 'Live feed',
              hint: 'ATS-driven listings are refreshed and deduped regularly',
            },
            {
              label: 'Active filters',
              value: activeFilterCount.toLocaleString(),
              hint: activeFilterCount > 0 ? 'Current query is narrowed from the full jobs hub' : 'Showing the broadest jobs hub view',
            },
            {
              label: 'Pay floor',
              value: minSalary ? `$${Math.round(minSalary / 1000)}k+` : '$100k+',
              hint: salaryCurrency ? `Applied in ${salaryCurrency}` : 'Default high-salary threshold',
            },
          ]}
        />
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Filters">
          {/* Collapsible on mobile, always-open on desktop via CSS that
              hides the summary at md+. <details> gives us a free, no-JS
              drawer that respects keyboard / screen readers. */}
          <details
            className="group rounded-2xl border border-neutral-800/80 bg-neutral-950/60 md:border-0 md:bg-transparent md:p-0 md:[&>div]:!block"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-neutral-100 transition hover:bg-neutral-900/60 md:hidden [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-emerald-400"
                >
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                  <line x1="10" y1="18" x2="14" y2="18" />
                </svg>
                Filters
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 text-neutral-400 transition-transform group-open:rotate-180"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <div className="md:block">
              <JobsFiltersPanel facets={facets} />
            </div>
          </details>
        </aside>

        <section className={styles.results} aria-label="Job results">
          {techFilter ? (
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="text-sm text-neutral-400">Filtering by technology:</span>
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
                <span className="font-semibold text-emerald-400">{techFilter}</span>
                <Link
                  href="/jobs"
                  className="ml-1 text-neutral-400 transition-colors hover:text-white"
                  aria-label="Clear tech filter"
                >
                  <span className="text-lg">✕</span>
                </Link>
              </div>
              <span className="text-sm text-neutral-500">
                ({data.total} {data.total === 1 ? 'job' : 'jobs'} found)
              </span>
            </div>
          ) : null}

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
            <>
              <InfiniteJobsList
                initialJobs={dedupedJobs}
                initialPage={page}
                totalPages={totalPages}
                view={view}
              />
              {totalPages > 1 ? (
                <nav
                  className={styles.pagination}
                  aria-label="Jobs pagination"
                  // SSR pagination links so Google can crawl pages beyond 1.
                  // The client-side InfiniteJobsList above appends pages for
                  // human users; these anchor tags are the discoverable index.
                >
                  {page > 1 ? (
                    <Link
                      className={styles.pageLink}
                      href={buildPageHref(basePath, sp, page - 1)}
                      rel="prev"
                    >
                      ← Previous page
                    </Link>
                  ) : null}
                  {page < totalPages ? (
                    <Link
                      className={styles.pageLink}
                      href={buildPageHref(basePath, sp, page + 1)}
                      rel="next"
                    >
                      Next page →
                    </Link>
                  ) : null}
                </nav>
              ) : null}
            </>
          )}
        </section>
      </div>
        <section className={styles.below} aria-label="Why use this jobs hub">
        <div className={styles.belowHeader}>
          <h2 className={styles.belowTitle}>Why this page is the main $100k+ jobs hub</h2>
          <p className={styles.belowBlurb}>
            This crawlable jobs index combines verified salary ranges, fresh ATS listings, and
            canonical links into role, salary, remote, and location pages for high-intent searches.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-sm text-neutral-300">
            <h3 className="text-sm font-semibold text-neutral-50">Verified pay floor</h3>
            <p className="mt-2">
              Jobs shown here pass validated salary checks and highlight published compensation
              ranges, keeping the main index aligned with $100k+ job search intent.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-sm text-neutral-300">
            <h3 className="text-sm font-semibold text-neutral-50">Fresh live inventory</h3>
            <p className="mt-2">
              ATS-driven listings are refreshed frequently, and stale jobs are removed to reduce dead
              clicks and keep the hub trustworthy.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-sm text-neutral-300">
            <h3 className="text-sm font-semibold text-neutral-50">Clean internal routing</h3>
            <p className="mt-2">
              Salary-band pages, countries, categories, and role hubs sit one click away so Google can
              discover narrower high-intent pages from the main jobs index.
            </p>
          </div>
        </div>
      </section>
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
              className="group flex flex-col justify-between rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 transition hover:border-neutral-600 hover:bg-neutral-900"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                  {band.id === '100k'
                    ? 'Core band'
                    : band.id === '200k'
                    ? 'Senior band'
                    : band.id === '300k'
                    ? 'Principal band'
                    : 'Executive band'}
                </p>
                <h3 className="mt-2 text-sm font-semibold text-neutral-50">{band.label}</h3>
                <p className="mt-2 text-xs text-neutral-300">{band.blurb}</p>
              </div>
              <p className="mt-3 text-[11px] text-neutral-400">View all {band.id}+ jobs →</p>
            </Link>
          ))}
        </div>

        {BANDS.map((band, idx) => {
          const slices = bandCanonicalLinks[idx]

          if (!slices || slices.length === 0) {
            return null
          }

          return (
            <section key={band.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-50">
                  Popular {band.id}+ jobs by role &amp; country
                </h3>
                <Link href={band.href} className="text-[11px] text-blue-400 hover:underline">
                  View all {band.id}+ jobs →
                </Link>
              </div>

              <ul className="flex flex-wrap gap-2 text-[11px]">
                {slices.map((slice) => (
                  <li key={slice.slug}>
                    <Link
                      href={slice.href}
                      className="inline-flex items-center rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900"
                    >
                      <span className="truncate">
                        {slice.title || slice.h1 || prettyRoleAndCountryFromSlug(slice.slug)}
                      </span>
                      <span className="ml-1 text-neutral-500">({slice.jobCount})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </section>
      </main>
    )
  } catch (error) {
    logRuntimeFallback('jobs.page', error)
    return <JobsIndexFallback techFilter={techFilter} />
  }
}
