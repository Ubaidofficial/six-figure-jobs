import Link from '@/components/ui/Link'
import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { buildLogoUrl } from '@/lib/companies/logo'
import {
  Faq,
  JobRows,
  LinkChips,
  ListingHeader,
  ListingLayout,
  ListingPage,
  ListingSection,
  Pagination,
  Prose,
} from '@/components/listing/ListingParts'

import { prisma } from '@/lib/prisma'
import { buildWhere, queryJobs, type JobQueryInput, type JobWithCompany } from '@/lib/jobs/queryJobs'
import { loadTopRolePages, topRolesRow } from '@/lib/roles/topRolePages'
import { buildItemListJsonLd } from '@/lib/seo/itemListJsonLd'
import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'
import { CITY_TARGET_SLUG_SET } from '@/lib/seo/pseoTargets'
import { highSalaryThresholdForCountry, TARGET_COUNTRIES } from '@/lib/seo/regions'
import { formatRelativeTime } from '@/lib/utils/time'

import { JobsFiltersPanel, type JobsFacets } from '../../_components/JobsFilters'
import { JobsToolbar } from '../../_components/JobsToolbar'
import { ActiveFilters } from '../../_components/ActiveFilters'
import { DEFAULT_TTL_MS, memoAsync, stableKey } from '@/lib/cache/memo'
import { loadLevelSizeCounts } from '@/lib/jobs/levelSizeFacets'
import { ListingSalaryAside } from '@/components/listing/ListingSalaryAside'
import { notFoundPastLastPage } from '@/lib/seo/listingSearchParams'

const PAGE_SIZE = 24
const SITE_URL = getSiteUrl()

type SearchParams = Record<string, string | string[] | undefined>

export type CountryLocation = {
  slug: string
  label: string
  countryCode: string
}

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  CAD: '$',
  AUD: '$',
  GBP: '£',
  EUR: '€',
  CHF: 'CHF ',
  SEK: 'kr ',
  NOK: 'kr ',
  DKK: 'kr ',
  SGD: '$',
  NZD: '$',
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

function toTitleCase(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function asNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'object') {
    const v: any = value
    if (typeof v.toNumber === 'function') {
      const n = v.toNumber()
      return Number.isFinite(n) ? n : null
    }
    if (typeof v.toString === 'function') {
      const n = Number(v.toString())
      return Number.isFinite(n) ? n : null
    }
  }
  return null
}

function formatCurrencyCompact(amount: number | null, currency: string): string {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return '—'
  const cur = (currency || '').toUpperCase()
  const symbol = CURRENCY_SYMBOL[cur] ?? `${cur} `

  if (amount >= 1_000_000) {
    const m = amount / 1_000_000
    const label = m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`
    return `${symbol}${label} ${cur}`.trim()
  }

  const k = Math.round(amount / 1000)
  return `${symbol}${k.toLocaleString()}k ${cur}`.trim()
}

function dedupeJobs(jobs: JobWithCompany[]): JobWithCompany[] {
  const seen = new Set<string>()
  return jobs.filter((job: any) => {
    const companyId = job.companyId || job.companyRef?.id || ''
    const title = (job.title || '').trim().toLowerCase()
    const min = String(job.minAnnual ?? '')
    const max = String(job.maxAnnual ?? '')
    const key = `${companyId}:${title}:${min}:${max}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildCountryBreadcrumbJsonLd(loc: CountryLocation) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${SITE_URL}/jobs` },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${loc.label} jobs`,
        item: `${SITE_URL}/jobs/location/${loc.slug}`,
      },
    ],
  }
}

function buildCountryCollectionPageJsonLd(input: {
  loc: CountryLocation
  total: number
  companyCount: number
  thresholdLabel: string
  countryCurrency: string
}) {
  const url = `${SITE_URL}/jobs/location/${input.loc.slug}`

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `$100k+ jobs in ${input.loc.label}`,
    description: `Browse ${input.total.toLocaleString()} verified high paying jobs in ${input.loc.label} with ${input.countryCurrency} salary context, published salary ranges where available, direct apply links, and fresh six figure roles.`,
    url,
    about: [
      `$100k+ jobs in ${input.loc.label}`,
      `six figure jobs in ${input.loc.label}`,
      `high paying jobs in ${input.loc.label}`,
      `remote jobs in ${input.loc.label}`,
      'published salary ranges',
      'direct apply links',
    ],
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
    mainEntity: {
      '@type': 'ItemList',
      name: `${input.loc.label} salary job feed`,
      numberOfItems: input.total,
    },
  }
}

function buildCountryFaqItems(input: {
  loc: CountryLocation
  total: number
  companyCount: number
  thresholdLabel: string
  countryCurrency: string
}) {
  return [
    {
      q: `How are these ${input.loc.label} jobs selected?`,
      a: `This page lists ${input.total.toLocaleString()} jobs in ${input.loc.label} from ${input.companyCount.toLocaleString()} companies. Each one has a published salary above the ${input.loc.label} threshold and was posted recently; jobs that are no longer open are removed.`,
    },
    {
      q: `What salary threshold is used for ${input.loc.label}?`,
      a: `The ${input.loc.label} page uses a country-aware high-salary floor of approximately ${input.thresholdLabel} and shows ${input.countryCurrency} salary context where available.`,
    },
    {
      q: `Can I find remote jobs in ${input.loc.label}?`,
      a: `Yes. Use the work type filter to compare remote, hybrid, and on-site six figure jobs in ${input.loc.label}, then apply through the link on each listing: the employer’s own page or the job board it was posted on.`,
    },
  ]
}

function buildCountryFaqJsonLd(input: {
  loc: CountryLocation
  total: number
  companyCount: number
  thresholdLabel: string
  countryCurrency: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: buildCountryFaqItems(input).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }
}

export async function CountryLocationTemplate({
  loc,
  searchParams,
}: {
  loc: CountryLocation
  searchParams?: Promise<SearchParams>
}) {
  const sp = (await searchParams) || {}
  const page = parsePage(sp)

  const rawRemoteMode = (firstParam(sp, 'remoteMode') || '').trim()
  const remoteMode: '' | 'remote' | 'hybrid' | 'onsite' =
    rawRemoteMode === 'remote' || rawRemoteMode === 'hybrid' || rawRemoteMode === 'onsite'
      ? rawRemoteMode
      : ''

  const rawSort = (firstParam(sp, 'sort') || 'recent').trim()
  const sort = rawSort === 'recent' || rawSort === 'salary' || rawSort === 'relevant' ? rawSort : 'recent'


  const roles = allParams(sp, 'role')
  const seniority = allParams(sp, 'seniority')
  const companySizes = allParams(sp, 'companySize')

  const countryCode = loc.countryCode.toUpperCase()
  const countryCurrency =
    TARGET_COUNTRIES.find((c) => c.code.toUpperCase() === countryCode)?.currency ?? 'USD'

  const thresholdLocal = highSalaryThresholdForCountry(countryCode)
  const thresholdLabel = thresholdLocal
    ? formatCurrencyCompact(thresholdLocal, countryCurrency)
    : '—'

  const queryInput: JobQueryInput = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: sort === 'recent' ? 'date' : 'salary',
    roleSlugs: roles.length ? roles : undefined,
    countryCode,
    remoteMode: remoteMode || undefined,
    seniorityLevels: seniority.length ? seniority : undefined,
    companySizeBuckets: companySizes.length ? companySizes : undefined,
  }

  const data = await queryJobs(queryInput)
  const topRoles = await loadTopRolePages({ countryCode })
  const jobs = dedupeJobs(data.jobs as JobWithCompany[])
  const totalPages = data.totalPages
  notFoundPastLastPage(page, totalPages)
  const mostRecentUpdateMs = jobs.reduce((acc, job: any) => {
    const candidate = job?.updatedAt ?? job?.postedAt ?? job?.createdAt ?? null
    if (!candidate) return acc
    const ms = new Date(candidate).getTime()
    if (!Number.isFinite(ms)) return acc
    return ms > acc ? ms : acc
  }, 0)
  const lastUpdatedLabel = mostRecentUpdateMs ? formatRelativeTime(mostRecentUpdateMs) : null

  const statsWhere = buildWhere({
    ...queryInput,
    page: 1,
    pageSize: 1,
  })

  const [companyGroups, avgAgg, topCityGroups, topCompanyGroups] = await memoAsync(stableKey('country-stats', countryCode, { ...queryInput, page: undefined }), DEFAULT_TTL_MS, () => Promise.all([
    prisma.job.groupBy({
      by: ['companyId'],
      where: { ...statsWhere, companyId: { not: null } },
      _count: { _all: true },
    }),
    prisma.job.aggregate({
      where: {
        ...statsWhere,
        currency: countryCurrency,
        OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }],
      },
      _avg: { maxAnnual: true, minAnnual: true },
    }),
    (prisma.job.groupBy as any)({
      by: ['citySlug', 'city'],
      where: { ...statsWhere, citySlug: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { citySlug: 'desc' } } as any,
      take: 12,
    }),
    (prisma.job.groupBy as any)({
      by: ['companyId'],
      where: { ...statsWhere, companyId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { companyId: 'desc' } } as any,
      take: 12,
    }),
  ]))

  const companyCount = companyGroups.length

  const avgMax = asNumber((avgAgg as any)?._avg?.maxAnnual)
  const avgMin = asNumber((avgAgg as any)?._avg?.minAnnual)
  const avgLocal =
    avgMax != null && avgMin != null ? (avgMax + avgMin) / 2 : (avgMax ?? avgMin)

  const topCityListBase = (topCityGroups as any[])
    .map((r) => ({
      slug: String(r.citySlug || ''),
      name: String(r.city || r.citySlug || '').trim(),
      count: Number(r?._count?._all ?? 0),
    }))
    .filter((r) => r.slug && r.name && CITY_TARGET_SLUG_SET.has(r.slug))
    .slice(0, 6)

  const companyIds = Array.from(
    new Set((topCompanyGroups as any[]).map((r) => String(r.companyId)).filter(Boolean))
  )
  const companies = companyIds.length
    ? await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true, slug: true, logoUrl: true, website: true },
      })
    : []
  const companyById = new Map(companies.map((c) => [c.id, c]))

  const topCompanies = (topCompanyGroups as any[])
    .map((r) => {
      const id = String(r.companyId || '')
      const info = companyById.get(id)
      return {
        id,
        name: info?.name ?? null,
        slug: info?.slug ?? null,
        logoUrl: buildLogoUrl(info?.logoUrl ?? null, info?.website ?? null, info?.name ?? null),
        count: Number(r?._count?._all ?? 0),
      }
    })
    .filter((c) => Boolean(c.name))
    .slice(0, 6)

  const baseFacetInput: JobQueryInput = {
    ...queryInput,
    page: 1,
    pageSize: 1,
  }

  const [roleRows, remoteCount, hybridCount, onsiteCount] = await memoAsync(stableKey('country-facets', countryCode, { ...queryInput, page: undefined }), DEFAULT_TTL_MS, () => Promise.all([
    (prisma.job.groupBy as any)({
      by: ['roleSlug'],
      where: {
        ...buildWhere({ ...baseFacetInput, roleSlugs: undefined }),
        roleSlug: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { roleSlug: 'desc' } } as any,
      take: 20,
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
  ]))

  const levelSize = await memoAsync(stableKey('country-level-size', countryCode, baseFacetInput), DEFAULT_TTL_MS, () =>
    loadLevelSizeCounts(baseFacetInput),
  )

  const facets: JobsFacets = {
    roles: roleRows
      .map((r: any) => ({
        value: (r as any).roleSlug as string,
        count: Number((r as any)._count?._all ?? 0),
      }))
      .filter((r: any) => Boolean(r.value)),
    countries: [],
    workTypes: {
      remote: remoteCount,
      hybrid: hybridCount,
      onsite: onsiteCount,
    },
    ...levelSize,
  }

  const jsonLd = buildItemListJsonLd({
    name: `$100k+ jobs in ${loc.label} on ${SITE_NAME}`,
    jobs: jobs.map((j) => ({ id: j.id, title: j.title })),
    page,
    pageSize: PAGE_SIZE,
  })

  const basePath = `/jobs/location/${loc.slug}`
  const countrySeoInput = {
    loc,
    total: data.total,
    companyCount,
    thresholdLabel,
    countryCurrency,
  }
  const breadcrumbJsonLd = buildCountryBreadcrumbJsonLd(loc)
  const collectionPageJsonLd = buildCountryCollectionPageJsonLd(countrySeoInput)
  const faqJsonLd = buildCountryFaqJsonLd(countrySeoInput)
  const faqItems = buildCountryFaqItems(countrySeoInput)

  return (
    <ListingPage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <ListingHeader
        aside={<ListingSalaryAside input={queryInput} scope={`roles in ${loc.label}`} />}
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Jobs', href: '/jobs' }, { label: loc.label }]}
        accent="High-paying"
        title={`jobs in ${loc.label}`}
        summary={
          <>
            Every job in {loc.label} shows a published salary of at least {thresholdLabel}, from{' '}
            <strong>{companyCount.toLocaleString()}</strong>{' '}
            {companyCount === 1 ? 'company' : 'companies'}
            {avgLocal ? <> · average <strong>{formatCurrencyCompact(avgLocal, countryCurrency)}</strong></> : null}
            {lastUpdatedLabel ? <> · updated {lastUpdatedLabel}</> : null}
          </>
        }
        related={topRolesRow(`Top roles in ${loc.label}`, topRoles)}
      />

      <ListingLayout
        sidebar={<JobsFiltersPanel facets={facets} locationPreset={{ label: loc.label, countryCode }} hideSalaryFilter />}
        bar={
          <ActiveFilters
            total={data.total}
            pinned={['country', 'minSalary']}
            actions={
              <JobsToolbar facets={facets} total={data.total} locationPreset={{ label: loc.label, countryCode }} hideSalaryFilter />
            }
          />
        }
        alert={queryInput}
      >
        <JobRows
          jobs={jobs}
          empty={{
            title: 'No jobs match these filters.',
            body: `Clear the filters to see every job in ${loc.label}.`,
            href: basePath,
          }}
        />
        <Pagination page={page} totalPages={totalPages} hrefFor={(n) => buildPageHref(basePath, sp, n)} />
      </ListingLayout>

      {topCityListBase.length > 0 ? (
        <ListingSection title={`Top cities in ${loc.label}`}>
          <LinkChips
            label="Top cities"
            items={topCityListBase.map((c) => ({ label: c.name, href: `/jobs/city/${c.slug}`, count: c.count }))}
          />
        </ListingSection>
      ) : null}

      {topCompanies.length > 0 ? (
        <ListingSection title={`Companies hiring in ${loc.label}`}>
          <LinkChips
            label="Top companies"
            items={topCompanies
              .filter((c) => c.slug && c.name)
              .map((c) => ({
                label: String(c.name),
                href: `/company/${c.slug}`,
                count: c.count,
                logo: <CompanyLogo name={String(c.name)} src={c.logoUrl} size="sm" />,
              }))}
          />
        </ListingSection>
      ) : null}

      <ListingSection title={`About ${countryCurrency} salaries in ${loc.label}`}>
        <Prose>
          <p>
            This page lists roles with a published salary of at least <strong>{thresholdLabel}</strong>, the
            six-figure threshold for {countryCurrency}. Salaries are taken from each employer&rsquo;s posting, and every
            apply button says where it goes: the company&rsquo;s own page or the job board it was posted on.
          </p>
        </Prose>
      </ListingSection>

      <ListingSection title={`${loc.label} jobs FAQ`}>
        <Faq items={faqItems.map((item) => ({ question: item.q, answer: item.a }))} />
      </ListingSection>
    </ListingPage>
  )
}
