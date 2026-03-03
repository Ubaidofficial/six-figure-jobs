import type { Metadata } from 'next'
import Link from 'next/link'
import { JobCard } from '@/components/jobs/JobCard'
import type { CSSProperties } from 'react'

import { prisma } from '@/lib/prisma'
import { buildWhere, queryJobs, type JobQueryInput, type JobWithCompany } from '@/lib/jobs/queryJobs'
import { getSiteUrl, SITE_NAME } from '@/lib/seo/site'
import { buildItemListJsonLd } from '@/lib/seo/itemListJsonLd'
import { SALARY_TIERS, type SalaryTierId } from '@/lib/jobs/salaryTiers'
import { formatRelativeTime } from '@/lib/utils/time'

import { JobsFiltersPanel, type JobsFacets } from './JobsFilters'
import { JobsToolbar } from './JobsToolbar'
import styles from './SalaryTierTemplate.module.css'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 24

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

function toTitleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
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

function formatUsdK(amount: number | null): string {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return '—'
  const k = Math.round(amount / 1000)
  return `$${k.toLocaleString()}k`
}

function coalesceAnnual(job: { maxAnnual?: any; minAnnual?: any }): number | null {
  return asNumber(job.maxAnnual ?? job.minAnnual)
}

function buildTierQueryInput(tierId: SalaryTierId): Pick<JobQueryInput, 'currency' | 'minAnnual' | 'maxAnnual'> {
  const tier = SALARY_TIERS[tierId]
  return {
    currency: 'USD',
    minAnnual: tier.minAnnualUsd,
    ...(tier.maxAnnualUsd ? { maxAnnual: tier.maxAnnualUsd } : {}),
  }
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

function cssVarStyle(vars: Record<string, string>): CSSProperties {
  return vars as unknown as CSSProperties
}

function svgPathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ` + rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
}

export function buildSalaryTierMetadata(tierId: SalaryTierId, total: number): Metadata {
  const tier = SALARY_TIERS[tierId]
  const title = `Top ${tier.rangeLabel} Jobs | ${SITE_NAME}`
  const description =
    total > 0
      ? `Browse ${total.toLocaleString()} verified ${tier.rangeLabel} opportunities. Filter by role, location, and work type — no entry-level clutter.`
      : `Browse verified ${tier.rangeLabel} opportunities with premium salary transparency.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/jobs/${tierId}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/jobs/${tierId}`,
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

export async function SalaryTierTemplate({
  tierId,
  searchParams,
}: {
  tierId: SalaryTierId
  searchParams?: Promise<SearchParams>
}) {
  const tier = SALARY_TIERS[tierId]
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

  const queryInput: JobQueryInput = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: sort === 'recent' ? 'date' : 'salary',
    roleSlugs: roles.length ? roles : undefined,
    countryCode: country || undefined,
    remoteMode: remoteMode || undefined,
    seniorityLevels: seniority.length ? seniority : undefined,
    companySizeBuckets: companySizes.length ? companySizes : undefined,
    ...buildTierQueryInput(tierId),
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

  const baseFacetInput: JobQueryInput = {
    ...queryInput,
    page: 1,
    pageSize: 1,
  }

  const [roleRows, countryRows, remoteCount, hybridCount, onsiteCount] = await Promise.all([
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
    (prisma.job.groupBy as any)({
      by: ['countryCode'],
      where: {
        ...buildWhere({ ...baseFacetInput, countryCode: undefined }),
        countryCode: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { countryCode: 'desc' } } as any,
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
      .map((r: any) => ({
        value: (r as any).roleSlug as string,
        count: Number((r as any)._count?._all ?? 0),
      }))
      .filter((r: any) => Boolean(r.value)),
    countries: countryRows
      .map((r: any) => ({
        value: String((r as any).countryCode || '').toUpperCase(),
        count: Number((r as any)._count?._all ?? 0),
      }))
      .filter((r: any) => r.value),
    workTypes: {
      remote: remoteCount,
      hybrid: hybridCount,
      onsite: onsiteCount,
    },
  }

  const [avgAgg, topCityRows, topRoleAvgRows, topRolesForChart, countriesForPie] =
    await Promise.all([
      prisma.job.aggregate({
        where: {
          ...buildWhere(baseFacetInput),
          OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }],
        },
        _avg: { maxAnnual: true, minAnnual: true },
      }),
      prisma.job.groupBy({
        by: ['city', 'countryCode'],
        where: {
          ...buildWhere(baseFacetInput),
          city: { not: null },
        },
        _count: { _all: true },
        _avg: { maxAnnual: true, minAnnual: true },
        orderBy: [{ _avg: { maxAnnual: 'desc' } }, { _avg: { minAnnual: 'desc' } }],
        take: 10,
      }),
      prisma.job.groupBy({
        by: ['roleSlug'],
        where: {
          ...buildWhere(baseFacetInput),
          roleSlug: { not: null },
        },
        _count: { _all: true },
        _avg: { maxAnnual: true, minAnnual: true },
        orderBy: [{ _avg: { maxAnnual: 'desc' } }, { _avg: { minAnnual: 'desc' } }],
        take: 10,
      }),
      (prisma.job.groupBy as any)({
        by: ['roleSlug'],
        where: {
          ...buildWhere({ ...baseFacetInput, roleSlugs: undefined }),
          roleSlug: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { roleSlug: 'desc' } } as any,
        take: 5,
      }),
      (prisma.job.groupBy as any)({
        by: ['countryCode'],
        where: {
          ...buildWhere({ ...baseFacetInput, countryCode: undefined }),
          countryCode: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { countryCode: 'desc' } } as any,
        take: 5,
      }),
    ])

  const avgMax = asNumber((avgAgg as any)?._avg?.maxAnnual)
  const avgMin = asNumber((avgAgg as any)?._avg?.minAnnual)
  const avgSalary =
    avgMax != null && avgMin != null ? (avgMax + avgMin) / 2 : (avgMax ?? avgMin)

  const topCity = (() => {
    const row = (topCityRows as any[]).find((r) => {
      const avg = asNumber(r?._avg?.maxAnnual ?? r?._avg?.minAnnual)
      const count = Number(r?._count?._all ?? 0)
      return avg != null && count >= 3
    }) as any
    if (!row) return null
    const city = String(row.city || '').trim()
    const cc = String(row.countryCode || '').trim().toUpperCase()
    if (!city) return null
    return `${city}${cc ? ` · ${cc}` : ''}`
  })()

  const topRole = (() => {
    const row = (topRoleAvgRows as any[]).find((r) => {
      const slug = String(r.roleSlug || '').trim()
      const avg = asNumber(r?._avg?.maxAnnual ?? r?._avg?.minAnnual)
      const count = Number(r?._count?._all ?? 0)
      return Boolean(slug) && avg != null && count >= 3
    }) as any
    if (!row) return null
    return toTitleCase(String(row.roleSlug))
  })()

  const maxRoleCount = Math.max(1, ...topRolesForChart.map((r: any) => Number(r?._count?._all ?? 0)))
  const roleBars = topRolesForChart
    .map((r: any) => {
      const slug = String(r.roleSlug || '')
      const count = Number(r?._count?._all ?? 0)
      return { slug, label: toTitleCase(slug), count, pct: (count / maxRoleCount) * 100 }
    })
    .filter((r: any) => Boolean(r.slug))

  const totalForPie = await prisma.job.count({
    where: buildWhere({ ...baseFacetInput, countryCode: undefined }),
  })

  const pieEntriesBase = countriesForPie
    .map((r: any) => ({
      code: String(r.countryCode || '').toUpperCase(),
      count: Number(r?._count?._all ?? 0),
    }))
    .filter((r: any) => r.code)

  const pieTopSum = pieEntriesBase.reduce((sum: number, e: any) => sum + e.count, 0)
  const pieOther = Math.max(0, totalForPie - pieTopSum)
  const pieEntries = pieOther > 0 ? [...pieEntriesBase, { code: 'Other', count: pieOther }] : pieEntriesBase

  const palette = [
    tier.theme.accentA,
    tier.theme.accentB,
    tier.theme.goldA ?? '#A3E635',
    tier.theme.goldB ?? '#F59E0B',
    '#22C55E',
    '#60A5FA',
    '#A78BFA',
    '#F97316',
  ]

  let pieStart = 0
  const pieStops: Array<{ color: string; from: number; to: number; label: string; pct: number }> = pieEntries.map(
    (e: any, i: number) => {
      const pct = totalForPie > 0 ? (e.count / totalForPie) * 100 : 0
      const from = pieStart
      const to = pieStart + pct
      pieStart = to
      return {
        color: palette[i % palette.length],
        from,
        to,
        label: e.code,
        pct,
      }
    }
  )

  const pieGradient =
    pieStops.length > 0
      ? `conic-gradient(${pieStops
          .map((s) => `${s.color} ${s.from.toFixed(1)}% ${s.to.toFixed(1)}%`)
          .join(', ')})`
      : 'conic-gradient(rgba(255,255,255,0.08), rgba(255,255,255,0.08))'

  const trendWhere = buildWhere({ ...baseFacetInput, page: 1, pageSize: 1 })
  const trendRows = await prisma.job.findMany({
    where: trendWhere,
    select: { postedAt: true, createdAt: true, maxAnnual: true, minAnnual: true },
    orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
    take: 5000,
  })

  const DAYS = 21
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayKeys: string[] = []
  for (let i = DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dayKeys.push(d.toISOString().slice(0, 10))
  }

  const dayBuckets = new Map<string, { sum: number; count: number }>()
  for (const key of dayKeys) dayBuckets.set(key, { sum: 0, count: 0 })

  for (const row of trendRows) {
    const dt = (row.postedAt ?? row.createdAt) as Date
    const day = new Date(dt)
    day.setHours(0, 0, 0, 0)
    const key = day.toISOString().slice(0, 10)
    if (!dayBuckets.has(key)) continue
    const v = coalesceAnnual(row)
    if (v == null) continue
    const bucket = dayBuckets.get(key)!
    bucket.sum += v
    bucket.count += 1
  }

  const trendValues = dayKeys.map((k) => {
    const b = dayBuckets.get(k)!
    return b.count > 0 ? b.sum / b.count : null
  })

  const trendNonNull = trendValues.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const hasTrend = trendNonNull.length >= 3
  const trendMin = hasTrend ? Math.min(...trendNonNull) : 0
  const trendMax = hasTrend ? Math.max(...trendNonNull) : 0

  const svgPoints = (() => {
    if (!hasTrend) return []
    const W = 520
    const H = 140
    const padX = 4
    const padY = 10
    const spanX = W - padX * 2
    const spanY = H - padY * 2
    const denom = trendMax - trendMin || 1
    const pts: Array<{ x: number; y: number } | null> = trendValues.map((v, idx) => {
      if (v == null) return null
      const x = padX + (idx / Math.max(1, trendValues.length - 1)) * spanX
      const t = (v - trendMin) / denom
      const y = padY + (1 - t) * spanY
      return { x, y }
    })

    const segments: Array<Array<{ x: number; y: number }>> = []
    let current: Array<{ x: number; y: number }> = []
    for (const p of pts) {
      if (!p) {
        if (current.length) segments.push(current)
        current = []
      } else {
        current.push(p)
      }
    }
    if (current.length) segments.push(current)

    return segments.map(svgPathFromPoints).filter(Boolean)
  })()

  const jsonLd = buildItemListJsonLd({
    name: `${tier.title} on ${SITE_NAME}`,
    jobs: jobs.map((j) => ({ id: j.id, title: j.title })),
    page,
    pageSize: PAGE_SIZE,
  })

  const salaryPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${tier.title} | ${SITE_NAME}`,
    description: `Verified ${tier.rangeLabel} jobs with premium salary transparency.`,
    url: `${SITE_URL}/jobs/${tierId}`,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    about: {
      '@type': 'Thing',
      name: tier.rangeLabel,
      description: `Jobs with salaries in the ${tier.rangeLabel} range (USD).`,
    },
  }

  const basePath = `/jobs/${tierId}`

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(salaryPageJsonLd) }}
      />

      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/jobs">Jobs</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{tier.rangeLabel}</span>
      </nav>

      <header
        className={styles.hero}
        style={cssVarStyle({
          '--tier-a': tier.theme.accentA,
          '--tier-b': tier.theme.accentB,
        })}
      >
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <div>
              <div className={styles.badge}>
                <span className={styles.badgeEmoji} aria-hidden="true">
                  {tier.emoji}
                </span>
                <span className={styles.badgeText}>SALARY TIER</span>
              </div>
              <h1 className={styles.heroTitle}>
                <span className={styles.heroTitleAccent}>{tier.rangeLabel}</span> Jobs
              </h1>
              <p className={styles.heroSub}>
                {data.total.toLocaleString()} premium opportunities in this range. Filter by role, location, and
                work type — verified salaries only.
              </p>
            </div>
            <div className={styles.toolbarWrap}>
              <JobsToolbar facets={facets} salaryPresetLabel={tier.rangeLabel} />
            </div>
          </div>

          <div className={styles.heroStats} aria-label="Salary tier stats">
            <div className={styles.statCard}>
              <div className={`${styles.statValue} ${styles.statValueAccent}`}>{data.total.toLocaleString()}</div>
              <div className={styles.statLabel}>Total jobs in tier</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{formatUsdK(avgSalary)}</div>
              <div className={styles.statLabel}>Average salary (USD)</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{topCity ?? '—'}</div>
              <div className={styles.statLabel}>Top paying city</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{topRole ?? '—'}</div>
              <div className={styles.statLabel}>Top paying role</div>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.insights} aria-label="Insights">
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Top roles</span>
            <span className={styles.cardSub}>By job count</span>
          </div>
          <div className={styles.bars}>
            {roleBars.length === 0 ? (
              <div className={styles.cardSub}>Not enough data yet.</div>
            ) : (
              roleBars.map((r: any) => (
                <div key={r.slug} className={styles.barRow}>
                  <div>
                    <div className={styles.barLabel}>{r.label}</div>
                    <div className={styles.barCount}>{r.count.toLocaleString()} jobs</div>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={cssVarStyle({ '--w': `${r.pct}%` })} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Geography</span>
            <span className={styles.cardSub}>Share of jobs by country</span>
          </div>
          <div className={styles.pieWrap}>
            <div className={styles.pie} style={{ background: pieGradient }} aria-hidden="true" />
            <div className={styles.legend}>
              {pieStops.length === 0 ? (
                <div className={styles.cardSub}>Not enough data yet.</div>
              ) : (
                pieStops.map((s) => (
                  <div key={s.label} className={styles.legendItem}>
                    <span className={styles.legendLeft}>
                      <span className={styles.swatch} style={cssVarStyle({ '--c': s.color })} />
                      <span className={styles.legendName}>{s.label}</span>
                    </span>
                    <span className={styles.legendPct}>{s.pct.toFixed(0)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Salary trend</span>
            <span className={styles.cardSub}>Last {DAYS} days (avg)</span>
          </div>
          <div className={styles.lineChart}>
            {hasTrend ? (
              <svg className={styles.lineSvg} viewBox="0 0 520 140" role="img" aria-label="Salary trend chart">
                <defs>
                  <linearGradient id="tierGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={tier.theme.accentA} />
                    <stop offset="100%" stopColor={tier.theme.accentB} />
                  </linearGradient>
                </defs>

                {[0.25, 0.5, 0.75].map((t) => (
                  <line
                    key={t}
                    className={styles.lineGrid}
                    x1={0}
                    x2={520}
                    y1={140 * t}
                    y2={140 * t}
                  />
                ))}

                {svgPoints.map((d, i) => (
                  <path key={i} className={styles.linePath} d={d} />
                ))}
              </svg>
            ) : (
              <div className={styles.cardSub} style={{ padding: 10 }}>
                Not enough data to chart a trend yet.
              </div>
            )}
          </div>
          <div className={styles.lineHint}>
            Range: {formatUsdK(trendMin)}–{formatUsdK(trendMax)} (USD)
          </div>
        </div>
      </section>

      <section className={styles.listSection} aria-label="Job listings">
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>Jobs in this tier</h2>
          <Link href="/jobs" className={styles.pageLink}>
            Explore all opportunities →
          </Link>
        </div>

        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Filters">
            <JobsFiltersPanel facets={facets} salaryPresetLabel={tier.rangeLabel} />
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
