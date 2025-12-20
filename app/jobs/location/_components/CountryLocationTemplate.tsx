import Link from 'next/link'
import { JobCard } from '@/components/jobs/JobCard'

import { prisma } from '@/lib/prisma'
import { buildWhere, queryJobs, type JobQueryInput, type JobWithCompany } from '@/lib/jobs/queryJobs'
import { buildItemListJsonLd } from '@/lib/seo/itemListJsonLd'
import { SITE_NAME } from '@/lib/seo/site'
import { highSalaryThresholdForCountry, TARGET_COUNTRIES } from '@/lib/seo/regions'
import { formatRelativeTime } from '@/lib/utils/time'

import { JobsFiltersPanel, type JobsFacets } from '../../_components/JobsFilters'
import { JobsToolbar } from '../../_components/JobsToolbar'
import styles from './CountryLocationTemplate.module.css'

const PAGE_SIZE = 24

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

function flagEmojiFromCountryCode(code: string): string {
  const cc = (code || '').toUpperCase()
  if (cc.length !== 2) return '🌍'
  const A = 0x1f1e6
  const base = 'A'.charCodeAt(0)
  const first = A + (cc.charCodeAt(0) - base)
  const second = A + (cc.charCodeAt(1) - base)
  return String.fromCodePoint(first, second)
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

  const rawView = (firstParam(sp, 'view') || 'grid').trim()
  const view: 'grid' | 'list' = rawView === 'list' ? 'list' : 'grid'

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
  const jobs = dedupeJobs(data.jobs as JobWithCompany[])
  const totalPages = data.totalPages
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

  const [companyGroups, avgAgg, topCityGroups, topCompanyGroups] = await Promise.all([
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
  ])

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
    .filter((r) => r.slug && r.name)
    .slice(0, 6)

  const cityAvgRows =
    topCityListBase.length > 0
      ? await prisma.job.groupBy({
          by: ['citySlug'],
          where: {
            ...statsWhere,
            currency: countryCurrency,
            citySlug: { in: topCityListBase.map((c) => c.slug) },
            OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }],
          },
          _avg: { maxAnnual: true, minAnnual: true },
        })
      : []

  const cityAvgBySlug = new Map<string, number | null>()
  for (const row of cityAvgRows as any[]) {
    const slug = String(row.citySlug || '')
    const max = asNumber(row?._avg?.maxAnnual)
    const min = asNumber(row?._avg?.minAnnual)
    const v = max != null && min != null ? (max + min) / 2 : (max ?? min)
    if (slug) cityAvgBySlug.set(slug, v)
  }

  const companyIds = Array.from(
    new Set((topCompanyGroups as any[]).map((r) => String(r.companyId)).filter(Boolean))
  )
  const companies = companyIds.length
    ? await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true, slug: true },
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

  const [roleRows, remoteCount, hybridCount, onsiteCount] = await Promise.all([
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
  ])

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
  }

  const jsonLd = buildItemListJsonLd({
    name: `$100k+ jobs in ${loc.label} on ${SITE_NAME}`,
    jobs: jobs.map((j) => ({ id: j.id, title: j.title })),
    page,
    pageSize: PAGE_SIZE,
  })

  const basePath = `/jobs/location/${loc.slug}`
  const flag = flagEmojiFromCountryCode(countryCode)

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/jobs">Jobs</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{loc.label}</span>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <div>
              <div className={styles.flag} aria-hidden="true">
                {flag}
              </div>
              <h1 className={styles.heroTitle}>
                <span className={styles.heroAccent}>$100k+</span> Jobs in {loc.label}
              </h1>
              <p className={styles.heroSub}>
                {data.total.toLocaleString()} opportunities from {companyCount.toLocaleString()} companies. Verified
                compensation only — no entry-level clutter.
              </p>

              <div className={styles.pillRow}>
                <div className={styles.pill}>
                  <span className={styles.pillLabel}>Minimum</span>
                  <span className={styles.pillValue}>{thresholdLabel}</span>
                </div>
                <div className={styles.pill}>
                  <span className={styles.pillLabel}>Currency</span>
                  <span className={styles.pillValue}>{countryCurrency}</span>
                </div>
              </div>
            </div>

            <JobsToolbar
              facets={facets}
              locationPreset={{ label: loc.label, emoji: flag }}
              hideSalaryFilter
            />
          </div>

          <div className={styles.heroStats} aria-label="Country stats">
            <div className={styles.statCard}>
              <div className={`${styles.statValue} ${styles.statValueAccent}`}>{data.total.toLocaleString()}</div>
              <div className={styles.statLabel}>Total jobs in country</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{formatCurrencyCompact(avgLocal, countryCurrency)}</div>
              <div className={styles.statLabel}>Average salary (local)</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>Top cities</div>
              <div className={styles.miniList} aria-label="Top cities list">
                {topCityListBase.slice(0, 3).map((c) => (
                  <div key={c.slug} className={styles.miniRow}>
                    <span>{c.name}</span>
                    <span className={styles.miniRight}>{c.count.toLocaleString()}</span>
                  </div>
                ))}
                {topCityListBase.length === 0 ? (
                  <div className={styles.miniRow}>
                    <span>—</span>
                    <span className={styles.miniRight}>—</span>
                  </div>
                ) : null}
              </div>
              <div className={styles.statLabel}>By job count</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>Top companies</div>
              <div className={styles.miniList} aria-label="Top companies list">
                {topCompanies.slice(0, 3).map((c) => (
                  <div key={c.id} className={styles.miniRow}>
                    <span>{c.name}</span>
                    <span className={styles.miniRight}>{c.count.toLocaleString()}</span>
                  </div>
                ))}
                {topCompanies.length === 0 ? (
                  <div className={styles.miniRow}>
                    <span>—</span>
                    <span className={styles.miniRight}>—</span>
                  </div>
                ) : null}
              </div>
              <div className={styles.statLabel}>Hiring right now</div>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.ppp} aria-label="PPP context">
        <div className={styles.pppTitle}>Understanding {countryCurrency} salaries</div>
        <p className={styles.pppBody}>
          In {loc.label}, a “six-figure” job is best understood in local purchasing power. We use a currency-specific
          high-salary cutoff (roughly equivalent to $100k USD) — approximately{' '}
          <strong className={styles.pillValue}>{thresholdLabel}</strong> — to keep listings comparable across regions.
        </p>
      </section>

      <section className={styles.citiesSection} aria-label="Top cities">
        <header className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionTitle}>Top cities</div>
            <div className={styles.sectionSub}>
              Browse the busiest hiring markets in {loc.label}.
            </div>
          </div>
        </header>

        <div className={styles.citiesGrid}>
          {topCityListBase.length === 0 ? (
            <div className={styles.empty} role="status">
              <div className={styles.emptyTitle}>No city data yet.</div>
              <div className={styles.emptyBody}>Check back soon as more roles are ingested and normalized.</div>
            </div>
          ) : (
            topCityListBase.map((c) => (
              <Link key={c.slug} href={`/jobs/city/${c.slug}`} className={styles.cityCard}>
                <div className={styles.cityTop}>
                  <div className={styles.cityName}>{c.name}</div>
                  <div className={styles.cityCount}>{c.count.toLocaleString()} jobs</div>
                </div>
                <div className={styles.cityMeta}>
                  <div className={styles.cityAvg}>
                    {formatCurrencyCompact(cityAvgBySlug.get(c.slug) ?? null, countryCurrency)} avg
                  </div>
                  <div className={styles.arrow} aria-hidden="true">
                    →
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className={styles.listSection} aria-label="Job listings">
        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Filters">
            <JobsFiltersPanel
              facets={facets}
              locationPreset={{ label: loc.label, emoji: flag }}
              hideSalaryFilter
            />
          </aside>

          <div className={styles.results}>
            <div className={styles.resultsHeader}>
              <div className={styles.resultsCount}>
                Showing page {data.page} of {totalPages} • {data.total.toLocaleString()} total
                {lastUpdatedLabel ? ` • Updated ${lastUpdatedLabel}` : ''}
              </div>
              <div />
            </div>

            {jobs.length === 0 ? (
              <div className={styles.empty} role="status">
                <div className={styles.emptyTitle}>No jobs found.</div>
                <div className={styles.emptyBody}>
                  Try adjusting your filters, or clear them to explore all $100k+ opportunities.
                </div>
                <div className={styles.pagination}>
                  <Link className={styles.pageLink} href={basePath}>
                    Clear filters
                  </Link>
                </div>
              </div>
            ) : (
              <div className={view === 'list' ? styles.list : styles.grid}>
                {jobs.map((job) => (
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
          </div>
        </div>
      </section>
    </main>
  )
}
