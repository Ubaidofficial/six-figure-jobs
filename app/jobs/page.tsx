import type { Metadata } from 'next'
import Link from '@/components/ui/Link'
import { redirect, unstable_rethrow } from 'next/navigation'
import { InfiniteJobsList } from './_components/InfiniteJobsList'

import {
  buildWhere,
  queryJobs,
  type JobQueryInput,
  type JobWithCompany,
} from '../../lib/jobs/queryJobs'
import { loadTopRolePages, topRolesRow } from '@/lib/roles/topRolePages'
import { DEFAULT_TTL_MS, memoAsync, stableKey } from '@/lib/cache/memo'
import { prisma } from '../../lib/prisma'
import { buildItemListJsonLd } from '../../lib/seo/itemListJsonLd'
import { resolveSliceCanonicalPath } from '../../lib/seo/canonical'
import { buildCleanJobsCanonicalPath, shouldNoindexListingPage, readListingPageParam } from '../../lib/seo/listingSearchParams'
import { SITE_NAME, getSiteUrl, defaultOgImages } from '../../lib/seo/site'
import { parseSliceFilters } from '../../lib/slices/types'
import { dropEmptyRoleBandLinks } from '../../lib/jobs/bandLinks'
import { formatRelativeTime } from '@/lib/utils/time'
import { salaryFilterCurrency } from '@/lib/jobs/salaryFilter'
import { loadLevelSizeCounts } from '@/lib/jobs/levelSizeFacets'
import { buildKeywordPlan } from '@/lib/search/keywordPlan'
import { displayKeyword } from '@/lib/search/displayKeyword'
import { JOB_CATEGORY_MAP } from '@/lib/seo/jobCategories'
import { CategoryRow, type CategoryRowItem } from '@/components/listing/CategoryRow'
import { loadListingSalaryStats } from '@/lib/jobs/listingSalaryStats'
import { countryName } from '@/lib/location/country'
import { LISTING_REMOTE_REGIONS as JOBS_REMOTE_REGIONS, normalizeRemoteRegionSlug } from '@/lib/jobs/remoteRegions'
import { countryCodeToSlug } from '@/lib/seo/countrySlug'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'
import { buildJobsHubDescription, buildJobsHubTitle } from '@/lib/seo/metaText'
import { getSearchVocabulary } from '@/lib/search/vocabulary'
import { logRuntimeFallback, skipPrerenderWhileBuilding } from '@/lib/runtime/fallback'

import { JobsFiltersPanel, type JobsFacets } from './_components/JobsFilters'
import { JobsToolbar } from './_components/JobsToolbar'
import { ActiveFilters } from './_components/ActiveFilters'
import {
  Accent,
  Faq,
  JobRows,
  LinkChips,
  ListingHeader,
  ListingLayout,
  ListingPage,
  ListingSection,
  Pagination,
} from '@/components/listing/ListingParts'
import { ListingSearch } from '@/components/listing/ListingSearch'
import { SavedSearchChip } from '@/components/listing/SavedSearchChip'
import { ListingSalaryAside } from '@/components/listing/ListingSalaryAside'
import { toPublicJob } from '@/lib/jobs/publicJob'

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
      'Tech and software roles with a published salary of $100k or more.',
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
  
  // Noindex utility states (filtered lists or pagination beyond page 1) to conserve crawl budget
  const noindexUtilityState = shouldNoindexListingPage(sp)
  const pageNumber = readListingPageParam(sp)
  const pageSuffix = pageNumber > 1 ? ` (Page ${pageNumber})` : ''

  // The live count is the same `total` the page itself shows for the unfiltered list, so title, description and the
  // "Browse N jobs" button agree. Filtered and deep pages are noindex, so they skip the extra query.
  let total: number | null = null
  if (!noindexUtilityState) {
    try {
      total = (await memoAsync(stableKey('jobs-hub-total'), DEFAULT_TTL_MS, () => queryJobs({ page: 1, pageSize: 1, sortBy: 'date' }))).total
    } catch (error) {
      logRuntimeFallback('jobs.page.metadata', error)
    }
  }
  const title = buildJobsHubTitle(total, pageSuffix)
  const description = buildJobsHubDescription(total)

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: noindexUtilityState ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { images: defaultOgImages(),
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
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
    description: `Browse ${totalJobs.toLocaleString()} jobs with a published salary of $100k or more, with new jobs added daily.`,
    url: `${SITE_URL}/jobs`,
    about: [
      '$100k+ jobs',
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
        name: 'How are these six-figure jobs selected?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Every job on this page has a published salary at or above the six-figure threshold for its currency, was posted recently, and says where its apply button goes: the employer’s own page or the job board it was posted on. Jobs that are no longer open are removed.',
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
          text: 'New jobs are added every day and listings that are no longer open are removed.',
        },
      },
    ],
  }
}

function JobsIndexFallback({ techFilter }: { techFilter?: string }) {
  return (
    <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-14 pt-10">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-2xl shadow-neutral-950/40">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Live job data temporarily unavailable
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">All six-figure jobs ($100k+)</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          The production database is reconnecting. Search metadata is still live, but the full job
          feed is temporarily unavailable.
          {techFilter ? ` Active filter: ${techFilter}.` : ''}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BANDS.map((band) => (
            <Link
              key={band.id}
              href={band.href}
              className="rounded-2xl border border-border bg-card p-4 text-sm text-foreground transition hover:border-foreground/40"
            >
              <div className="font-semibold">{band.label}</div>
              <p className="mt-2 text-xs text-muted-foreground">{band.blurb}</p>
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
  const visa = firstParam(sp, 'visa') === '1'
  // exact=1: the visitor chose to search for the words as typed, without typo correction.
  const exact = firstParam(sp, 'exact') === '1'

  const rawCountry = (firstParam(sp, 'country') || '').trim().toUpperCase()
  const country = rawCountry.length === 2 ? rawCountry : undefined
  // The homepage Location list also offers remote regions ("global" = anywhere in the world); they arrive as `country`
  // and are moved to `remoteRegion`, the one parameter the filters read.
  const regionFromLocation = country ? null : normalizeRemoteRegionSlug(rawCountry.toLowerCase())
  if (regionFromLocation) {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
      if (k === 'country' || v == null) continue
      for (const one of Array.isArray(v) ? v : [v]) next.append(k, one)
    }
    next.set('remoteRegion', regionFromLocation)
    redirect(`/jobs?${next.toString()}`)
  }

  const rawRemoteMode = (firstParam(sp, 'remoteMode') || '').trim()
  const remoteMode: '' | 'remote' | 'hybrid' | 'onsite' =
    rawRemoteMode === 'remote' || rawRemoteMode === 'hybrid' || rawRemoteMode === 'onsite'
      ? rawRemoteMode
      : ''

  // Remote jobs in a region (a set of countries), or "global" for jobs that can be done from anywhere.
  const remoteRegion = normalizeRemoteRegionSlug(firstParam(sp, 'remoteRegion')) ?? undefined

  const rawSort = (firstParam(sp, 'sort') || '').trim()
  // A keyword search is ranked by relevance unless the visitor picked another order.
  const sort =
    rawSort === 'recent' || rawSort === 'salary' || rawSort === 'relevant' ? rawSort : keyword ? 'relevant' : 'recent'


  const roles = allParams(sp, 'role')
  const seniority = allParams(sp, 'seniority')
  const companySizes = allParams(sp, 'companySize')

  const minSalaryRaw = Number(firstParam(sp, 'minSalary') || '') || null
  const minSalary =
    minSalaryRaw && Number.isFinite(minSalaryRaw)
      ? Math.min(450_000, Math.max(100_000, minSalaryRaw))
      : null
  const salaryCurrency = minSalary ? salaryFilterCurrency(country) : null
  const activeFilterCount =
    roles.length +
    seniority.length +
    companySizes.length +
    (country ? 1 : 0) +
    (remoteMode ? 1 : 0) +
    (remoteRegion ? 1 : 0) +
    (techFilter ? 1 : 0) +
    (visa ? 1 : 0) +
    (keyword ? 1 : 0) +
    (minSalary ? 1 : 0)

  const queryInput: JobQueryInput = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: sort === 'recent' ? 'date' : sort === 'relevant' && keyword ? 'relevant' : 'salary',
    roleSlugs: roles.length ? roles : undefined,
    countryCode: country || undefined,
    remoteMode: remoteMode || undefined,
    remoteRegion,
    seniorityLevels: seniority.length ? seniority : undefined,
    companySizeBuckets: companySizes.length ? companySizes : undefined,
    tech: techFilter,
    keyword,
    ...(visa ? { visaSponsorship: true } : {}),
    ...(keyword && exact ? { keywordPlan: buildKeywordPlan(keyword, null) } : {}),
    ...(minSalary && salaryCurrency ? { currency: salaryCurrency, minAnnual: minSalary } : {}),
  }

  try {
    const data = await memoAsync(stableKey('jobs-list', queryInput), DEFAULT_TTL_MS, () => queryJobs(queryInput))
    const jobs = data.jobs as JobWithCompany[]
    const topRoles = await loadTopRolePages({})

  const baseFacetInput: JobQueryInput = {
    ...queryInput,
    page: 1,
    pageSize: 1,
  }

    const [roleRows, countryRows, remoteCount, hybridCount, onsiteCount, regionCounts] =
      await memoAsync(stableKey('jobs-hub-facets', { ...queryInput, page: undefined }), DEFAULT_TTL_MS, () => Promise.all([
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
        Promise.all(
          JOBS_REMOTE_REGIONS.map((r) =>
            prisma.job.count({ where: buildWhere({ ...baseFacetInput, remoteRegion: r.slug }) }),
          ),
        ),
      ]))

  const vocabulary = await getSearchVocabulary().catch(() => null)
  const levelSize = await memoAsync(stableKey('jobs-hub-level-size', baseFacetInput), DEFAULT_TTL_MS, () =>
    loadLevelSizeCounts(baseFacetInput),
  )

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
    techs: vocabulary?.topSkills.map((t) => ({ value: t.term, count: t.count })),
    visaFilter: true,
    remoteRegions: JOBS_REMOTE_REGIONS.map((r, i) => ({ value: r.slug, label: r.label, count: regionCounts[i] ?? 0 })),
    ...levelSize,
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
    const bandSlices = await memoAsync(stableKey('jobs-hub-band-slices'), DEFAULT_TTL_MS, () => Promise.all(
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
    ))
  const bandCanonicalLinksAll = bandSlices.map((slices) => {
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
  // A chip must open a page that shows jobs: the role x band page redirects to the role page when it has none.
  const bandCanonicalLinks = await memoAsync(stableKey('jobs-hub-band-links', bandCanonicalLinksAll.map((links) => links.map((l) => l.href))), DEFAULT_TTL_MS, () =>
    Promise.all(bandCanonicalLinksAll.map((links) => dropEmptyRoleBandLinks(links))),
  )

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

  // A search reads as a page title ("SEO Manager jobs paying $100k+"); a very long query would not, so it is quoted instead.
  const keywordLabel = keyword ? displayKeyword(keyword) : ''
  const keywordFitsHeading = keywordLabel.length <= 40 && keywordLabel.split(/\s+/).length <= 5
  const shownKeyword = keywordLabel.length > 80 ? `${keywordLabel.slice(0, 80)}…` : keywordLabel
  const jobsWord = data.total === 1 ? 'job' : 'jobs'
  const updatedSentence = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : ''
  // Category tiles show on the plain hub only. Each count is the category page's own number (same roles, same filter).
  const categoryItems: CategoryRowItem[] =
    activeFilterCount === 0 && page === 1
      ? await memoAsync(stableKey('jobs-hub-categories', {}), DEFAULT_TTL_MS, async () => {
          const rows = await Promise.all(
            Object.entries(JOB_CATEGORY_MAP).map(async ([slug, cfg]) => ({
              slug,
              label: cfg.label,
              count: await prisma.job.count({
                where: buildWhere({ roleSlugs: cfg.roleSlugs, isHundredKLocal: true, page: 1, pageSize: 1 }),
              }),
            })),
          )
          return rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count)
        })
      : []

  // "Where the jobs are": the biggest countries with their typical pay, on the plain hub only. A country without
  // enough listings paid in its currency to quote a median is left out rather than shown with a thin number.
  const countryPay =
    activeFilterCount === 0 && page === 1
      ? (
          await Promise.all(
            facets.countries.slice(0, 6).map(async (c) => ({
              code: c.value,
              jobs: c.count,
              stats: await loadListingSalaryStats({ countryCode: c.value }).catch(() => null),
            })),
          )
        ).flatMap((row) => {
          const slug = countryCodeToSlug(row.code)
          const name = countryName(row.code, { short: true })
          return row.stats && slug && name ? [{ ...row, slug, name, stats: row.stats }] : []
        })
      : []


    return (
      <ListingPage>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

        <ListingHeader
          aside={<ListingSalaryAside input={queryInput} />}
          search={
            <>
              <ListingSearch action="/jobs" defaultValue={keyword} />
              {keyword ? <SavedSearchChip keyword={keyword} /> : null}
            </>
          }
          related={topRolesRow('Top roles', topRoles)}
          breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Jobs' }]}
          title={
            keyword ? (
              // On phones the sort control sits beside the heading, so the query is set smaller and may break inside a
              // very long word; otherwise the heading would push the control off the screen.
              data.total === 0 ? (
                <>
                  No jobs matching{' '}
                  <Accent>
                    <span className="max-sm:text-[0.7em] [overflow-wrap:anywhere]">&ldquo;{shownKeyword}&rdquo;</span>
                  </Accent>{' '}
                  yet
                </>
              ) : keywordFitsHeading ? (
                <>
                  <Accent>
                    <span className="max-sm:text-[0.7em] [overflow-wrap:anywhere]">{shownKeyword}</span>
                  </Accent>{' '}
                  jobs paying $100k+
                </>
              ) : (
                <>
                  $100k+ jobs matching{' '}
                  <Accent>
                    <span className="max-sm:text-[0.7em] [overflow-wrap:anywhere]">&ldquo;{shownKeyword}&rdquo;</span>
                  </Accent>
                </>
              )
            ) : (
              <>
                All <Accent>six-figure</Accent> jobs ($100k+)
              </>
            )
          }
          summary={
            keyword ? (
              <>
                {data.total === 0 ? (
                  <>Try a broader keyword, or browse every $100k+ job.</>
                ) : (
                  <>
                    <strong>{data.total.toLocaleString()}</strong> open {jobsWord} matching &ldquo;{shownKeyword}&rdquo;,
                    each with a published salary.{updatedSentence}
                  </>
                )}{' '}
                <Link href="/jobs" className="text-primary underline underline-offset-4">
                  Clear search
                </Link>
              </>
            ) : (
              <>
                Every listing shows a published salary. Filter by role, country, remote work or seniority.
                {updatedSentence}
              </>
            )
          }
        />

        <ListingLayout
          sidebar={<JobsFiltersPanel facets={facets} />}
          bar={<ActiveFilters total={data.total} actions={<JobsToolbar facets={facets} total={data.total} />} />}
          alert={queryInput}
        >
          {data.search?.corrections.length && keyword ? (
            <p className="mb-3 text-sm text-muted-foreground" role="status">
              Showing results for{' '}
              <strong className="text-foreground">
                {data.search.corrections.reduce((q, c) => q.replace(new RegExp(c.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), c.to), keyword)}
              </strong>
              .{' '}
              <Link
                href={`/jobs?${new URLSearchParams({ q: keyword, exact: '1' }).toString()}`}
                className="text-primary underline underline-offset-4"
                rel="nofollow"
              >
                Search for &ldquo;{keyword}&rdquo; instead
              </Link>
            </p>
          ) : null}

          {dedupedJobs.length === 0 ? (
            <JobRows
              jobs={[]}
              empty={{
                title: 'No jobs match these filters.',
                body: 'Clear the filters to see every $100k+ job.',
                href: '/jobs',
              }}
            />
          ) : (
            <>
              <InfiniteJobsList initialJobs={dedupedJobs.map(toPublicJob)} initialPage={page} totalPages={totalPages} />
              {/* Server-rendered pagination links so Google can crawl pages beyond 1; the client list above
                  appends pages for people. */}
              <Pagination page={page} totalPages={totalPages} hrefFor={(n) => buildPageHref(basePath, sp, n)} numbered />
            </>
          )}
        </ListingLayout>

        {/* Below the results, so the jobs are the first thing under the header (they sat under these tiles). */}
        <CategoryRow items={categoryItems} />

        {countryPay.length > 0 ? (
          <ListingSection title="Where the six-figure jobs are">
            <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
              The countries with the most open jobs, and what they typically pay in local currency. Typical pay is the
              median of the listings that show a salary; the middle half runs from the 25th to the 75th percentile.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[30rem] text-left text-sm">
                <caption className="sr-only">Open six-figure jobs and typical pay by country</caption>
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Country</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Open jobs</th>
                    <th scope="col" className="px-4 py-3 font-medium">Typical pay</th>
                    <th scope="col" className="px-4 py-3 font-medium">Middle half</th>
                  </tr>
                </thead>
                <tbody>
                  {countryPay.map((row) => (
                    <tr key={row.code} className="border-b border-border last:border-0">
                      <th scope="row" className="px-4 py-3 font-medium text-foreground">
                        <Link href={`/jobs/location/${row.slug}`} className="hover:underline underline-offset-4">
                          {row.name}
                        </Link>
                      </th>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.jobs.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-primary">
                        {formatCurrencyShort(Math.round(row.stats.snapshot.median / 1000) * 1000, row.stats.currency)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatCurrencyShort(Math.round(row.stats.snapshot.p25 / 1000) * 1000, row.stats.currency)}&ndash;
                        {formatCurrencyShort(Math.round(row.stats.snapshot.p75 / 1000) * 1000, row.stats.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListingSection>
        ) : null}

        <ListingSection title="Browse by salary band">
          <LinkChips
            label="Salary bands"
            items={BANDS.map((band) => ({ label: `${band.id.toUpperCase()}+ jobs`, href: band.href }))}
          />
          {BANDS.map((band, idx) => {
            const slices = bandCanonicalLinks[idx]
            if (!slices || slices.length === 0) return null
            return (
              <div key={band.id} style={{ marginTop: 24 }}>
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Popular {band.id}+ jobs by role &amp; country
                </h3>
                <LinkChips
                  label={`Popular ${band.id}+ slices`}
                  items={slices.map((slice) => ({
                    label: slice.title || slice.h1 || prettyRoleAndCountryFromSlug(slice.slug),
                    href: slice.href,
                    count: slice.jobCount,
                  }))}
                />
              </div>
            )
          })}
        </ListingSection>

        <ListingSection title="Frequently asked questions">
          <Faq
            items={faqJsonLd.mainEntity.map((item) => ({
              question: item.name,
              answer: item.acceptedAnswer.text,
            }))}
          />
        </ListingSection>
      </ListingPage>
    )
  } catch (error) {
    unstable_rethrow(error)
    logRuntimeFallback('jobs.page', error)
    await skipPrerenderWhileBuilding()
    return <JobsIndexFallback techFilter={techFilter} />
  }
}
