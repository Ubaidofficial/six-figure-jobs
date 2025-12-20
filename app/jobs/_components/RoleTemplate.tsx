import type { Metadata } from 'next'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'

import { JobCard } from '@/components/jobs/JobCard'
import { buildLogoUrl } from '@/lib/companies/logo'
import { prisma } from '@/lib/prisma'
import { buildWhere, queryJobs, type JobQueryInput, type JobWithCompany } from '@/lib/jobs/queryJobs'
import { buildItemListJsonLd } from '@/lib/seo/itemListJsonLd'
import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'
import { SEARCH_ROLE_OPTIONS } from '@/lib/roles/searchRoles'
import { CANONICAL_ROLE_SET } from '@/lib/roles/canonicalSlugs'
import { formatRelativeTime } from '@/lib/utils/time'

import { JobsFiltersPanel, type JobsFacets } from './JobsFilters'
import { JobsToolbar } from './JobsToolbar'
import styles from './RoleTemplate.module.css'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 24

type SearchParams = Record<string, string | string[] | undefined>

type Accent = { a: string; b: string }

const ROLE_ACCENTS: Record<string, Accent> = {
  'software-engineer': { a: '#84CC16', b: '#22C55E' },
  'backend-engineer': { a: '#84CC16', b: '#0EA5E9' },
  'frontend-engineer': { a: '#84CC16', b: '#A78BFA' },
  'full-stack-engineer': { a: '#84CC16', b: '#60A5FA' },
  'devops-engineer': { a: '#84CC16', b: '#F59E0B' },
  'data-scientist': { a: '#84CC16', b: '#A78BFA' },
  'data-engineer': { a: '#84CC16', b: '#38BDF8' },
  'product-manager': { a: '#84CC16', b: '#60A5FA' },
  'product-designer': { a: '#84CC16', b: '#FB7185' },
  'engineering-manager': { a: '#84CC16', b: '#F97316' },
} as const

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

function buildToggleMultiHref(basePath: string, sp: SearchParams, key: string, value: string): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'page') continue
    if (Array.isArray(v)) v.forEach((val) => val != null && params.append(k, val))
    else if (v != null) params.set(k, v)
  }

  const existing = params
    .getAll(key)
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)
  const set = new Set(existing)
  if (set.has(value)) set.delete(value)
  else set.add(value)

  params.delete(key)
  for (const v of Array.from(set)) params.append(key, v)
  params.delete('page')
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

function buildSetMultiHref(basePath: string, sp: SearchParams, key: string, values: string[]): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'page') continue
    if (Array.isArray(v)) v.forEach((val) => val != null && params.append(k, val))
    else if (v != null) params.set(k, v)
  }
  params.delete(key)
  for (const v of values) params.append(key, v)
  params.delete('page')
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

function toTitleCase(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^Senior Senior /, 'Senior ')
    .replace(/^Staff Staff /, 'Staff ')
    .replace(/^Principal Principal /, 'Principal ')
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

function cssVarStyle(vars: Record<string, string>): CSSProperties {
  return vars as unknown as CSSProperties
}

function parseStringArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
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

function roleCareerPath(roleSlug: string): Array<{ stage: string; slug: string | null; label: string }> {
  const slug = roleSlug.toLowerCase()
  const base = slug
    .replace(/^junior-/, '')
    .replace(/^mid-/, '')
    .replace(/^senior-/, '')
    .replace(/^staff-/, '')
    .replace(/^principal-/, '')
    .replace(/^lead-/, '')

  const candidates = [
    { stage: 'Junior', slug: `junior-${base}` },
    { stage: 'Mid', slug: base },
    { stage: 'Senior', slug: `senior-${base}` },
    { stage: 'Staff', slug: `staff-${base}` },
    { stage: 'Principal', slug: `principal-${base}` },
  ]

  return candidates.map((c) => ({
    stage: c.stage,
    slug: CANONICAL_ROLE_SET.has(c.slug) ? c.slug : c.stage === 'Mid' && CANONICAL_ROLE_SET.has(base) ? base : null,
    label: c.stage === 'Mid' ? toTitleCase(base) : toTitleCase(c.slug),
  }))
}

export function buildRoleMetadata(roleSlug: string, total: number, avgUsd: number | null): Metadata {
  const roleOpt = SEARCH_ROLE_OPTIONS.find((r) => r.slug === roleSlug)
  const roleTitle = roleOpt?.label ?? toTitleCase(roleSlug)

  const title = `${roleTitle} Jobs - $100k+ | ${SITE_NAME}`
  const description =
    total > 0
      ? `Browse ${total.toLocaleString()} verified ${roleTitle} opportunities paying $100k+ (or local equivalent).${avgUsd ? ` ~$${Math.round(avgUsd / 1000)}k average (USD where available).` : ''}`
      : `Browse verified ${roleTitle} opportunities paying $100k+ (or local equivalent).`

  const canonical = `${SITE_URL}/jobs/${roleSlug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export async function RoleTemplate({
  roleSlug,
  searchParams,
}: {
  roleSlug: string
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

  const seniority = allParams(sp, 'seniority')
  const companySizes = allParams(sp, 'companySize')
  const selectedSkills = allParams(sp, 'skill')

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
    roleSlugs: [roleSlug],
    countryCode: country || undefined,
    remoteMode: remoteMode || undefined,
    seniorityLevels: seniority.length ? seniority : undefined,
    companySizeBuckets: companySizes.length ? companySizes : undefined,
    skillSlugs: selectedSkills.length ? selectedSkills : undefined,
    ...(minSalary && salaryCurrency ? { currency: salaryCurrency, minAnnual: minSalary } : {}),
  }

  const data = await queryJobs(queryInput)
  if (data.total === 0) notFound()
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

  const [countryRows, remoteCount, hybridCount, onsiteCount] = await Promise.all([
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
    roles: [],
    countries: countryRows
      .map((r: any) => ({
        value: String((r as any).countryCode || '').toUpperCase(),
        count: Number((r as any)._count?._all ?? 0),
      }))
      .filter((r: any) => r.value),
    workTypes: { remote: remoteCount, hybrid: hybridCount, onsite: onsiteCount },
  }

  // Insights are computed for the role overall (USD-only where needed), independent of sidebar filters.
  const insightsWhere = buildWhere({ roleSlugs: [roleSlug], page: 1, pageSize: 1 })

  const [avgAggUsd, dist100_150, dist150_200, dist200Plus, topCityRows] = await Promise.all([
    prisma.job.aggregate({
      where: {
        ...insightsWhere,
        currency: 'USD',
        OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }],
      },
      _avg: { maxAnnual: true, minAnnual: true },
    }),
    prisma.job.count({
      where: {
        ...insightsWhere,
        currency: 'USD',
        OR: [
          { minAnnual: { gte: BigInt(100_000), lt: BigInt(150_000) } },
          { minAnnual: null, maxAnnual: { gte: BigInt(100_000), lt: BigInt(150_000) } },
        ],
      },
    }),
    prisma.job.count({
      where: {
        ...insightsWhere,
        currency: 'USD',
        OR: [
          { minAnnual: { gte: BigInt(150_000), lt: BigInt(200_000) } },
          { minAnnual: null, maxAnnual: { gte: BigInt(150_000), lt: BigInt(200_000) } },
        ],
      },
    }),
    prisma.job.count({
      where: {
        ...insightsWhere,
        currency: 'USD',
        OR: [{ minAnnual: { gte: BigInt(200_000) } }, { maxAnnual: { gte: BigInt(200_000) } }],
      },
    }),
    prisma.job.groupBy({
      by: ['citySlug', 'city', 'countryCode'],
      where: {
        ...insightsWhere,
        currency: 'USD',
        citySlug: { not: null },
        OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }],
      },
      _count: { _all: true },
      _avg: { maxAnnual: true, minAnnual: true },
      orderBy: [{ _avg: { maxAnnual: 'desc' } }, { _avg: { minAnnual: 'desc' } }],
      take: 6,
    }),
  ])

  const avgMaxUsd = asNumber((avgAggUsd as any)?._avg?.maxAnnual)
  const avgMinUsd = asNumber((avgAggUsd as any)?._avg?.minAnnual)
  const avgUsd = avgMaxUsd != null && avgMinUsd != null ? (avgMaxUsd + avgMinUsd) / 2 : (avgMaxUsd ?? avgMinUsd)

  const dist = [
    { label: '$100k–$150k', count: dist100_150 },
    { label: '$150k–$200k', count: dist150_200 },
    { label: '$200k+', count: dist200Plus },
  ]
  const distMax = Math.max(1, ...dist.map((d) => d.count))

  const cities = (topCityRows as any[])
    .map((r) => {
      const slug = String(r.citySlug || '')
      const city = String(r.city || r.citySlug || '').trim()
      const cc = String(r.countryCode || '').toUpperCase()
      const count = Number(r?._count?._all ?? 0)
      const max = asNumber(r?._avg?.maxAnnual)
      const min = asNumber(r?._avg?.minAnnual)
      const avg = max != null && min != null ? (max + min) / 2 : (max ?? min)
      return { slug, city, cc, count, avg }
    })
    .filter((c) => c.slug && c.city)

  const now = new Date()
  const startLast7 = new Date(now)
  startLast7.setDate(startLast7.getDate() - 7)
  const startPrev7 = new Date(now)
  startPrev7.setDate(startPrev7.getDate() - 14)

  const [avgLast7, avgPrev7] = await Promise.all([
    prisma.job.aggregate({
      where: {
        AND: [
          insightsWhere,
          { currency: 'USD' },
          { OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }] },
          { OR: [{ postedAt: { gte: startLast7 } }, { postedAt: null, createdAt: { gte: startLast7 } }] },
        ],
      } as any,
      _avg: { maxAnnual: true, minAnnual: true },
    }),
    prisma.job.aggregate({
      where: {
        AND: [
          insightsWhere,
          { currency: 'USD' },
          { OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }] },
          {
            OR: [
              { postedAt: { gte: startPrev7, lt: startLast7 } },
              { postedAt: null, createdAt: { gte: startPrev7, lt: startLast7 } },
            ],
          },
        ],
      } as any,
      _avg: { maxAnnual: true, minAnnual: true },
    }),
  ])

  const last7 = asNumber((avgLast7 as any)?._avg?.maxAnnual ?? (avgLast7 as any)?._avg?.minAnnual)
  const prev7 = asNumber((avgPrev7 as any)?._avg?.maxAnnual ?? (avgPrev7 as any)?._avg?.minAnnual)
  const deltaPct = last7 && prev7 && prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : null
  const trend =
    deltaPct == null
      ? { label: 'Stable', kind: 'stable' as const }
      : deltaPct > 2
        ? { label: 'Growing', kind: 'up' as const }
        : deltaPct < -2
          ? { label: 'Declining', kind: 'down' as const }
          : { label: 'Stable', kind: 'stable' as const }

  const skillSample = await prisma.job.findMany({
    where: insightsWhere,
    select: { skillsJson: true },
    orderBy: [{ postedAt: 'desc' }, { updatedAt: 'desc' }],
    take: 2000,
  })

  const skillCounts = new Map<string, number>()
  for (const row of skillSample) {
    for (const s of parseStringArray(row.skillsJson).map((x) => x.trim()).filter(Boolean)) {
      skillCounts.set(s, (skillCounts.get(s) ?? 0) + 1)
    }
  }

  const skillMax = Math.max(1, ...Array.from(skillCounts.values()))

  const skills = Array.from(skillCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([name, count], idx) => {
      const w = count / skillMax
      const hot = idx < 6 && count >= Math.max(10, Math.round(skillSample.length * 0.08))
      return { name, count, w, hot }
    })

  const topCompanyGroups = await (prisma.job.groupBy as any)({
    by: ['companyId'],
    where: { ...insightsWhere, companyId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { companyId: 'desc' } } as any,
    take: 24,
  })

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
        logoUrl: buildLogoUrl(info?.logoUrl ?? null, info?.website ?? null),
        count: Number(r?._count?._all ?? 0),
      }
    })
    .filter((c) => Boolean(c.name))

  const roleOpt = SEARCH_ROLE_OPTIONS.find((r) => r.slug === roleSlug)
  const roleTitle = roleOpt?.label ?? toTitleCase(roleSlug)
  const emoji = roleOpt?.emoji ?? '💼'
  const accent = ROLE_ACCENTS[roleSlug] ?? { a: '#84CC16', b: '#65A30D' }

  const basePath = `/jobs/${roleSlug}`
  const selectedSeniority = new Set(seniority)
  const seniorityChips = [
    { value: 'mid', label: 'Mid' },
    { value: 'senior', label: 'Senior' },
    { value: 'staff', label: 'Staff' },
    { value: 'principal', label: 'Principal' },
    { value: 'lead', label: 'Lead' },
  ] as const

  const itemListJsonLd = buildItemListJsonLd({
    name: `${roleTitle} jobs on ${SITE_NAME}`,
    jobs: jobs.map((j) => ({ id: j.id, title: j.title })),
    page,
    pageSize: PAGE_SIZE,
  })

  const career = roleCareerPath(roleSlug)

  return (
    <main
      className={styles.page}
      style={cssVarStyle({ '--role-a': accent.a, '--role-b': accent.b })}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/jobs">Jobs</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{roleTitle}</span>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.badge}>
              <span className={styles.emoji} aria-hidden="true">
                {emoji}
              </span>
              <span className={styles.badgeText}>PREMIUM ROLE FEED</span>
            </div>
            <h1 className={styles.heroTitle}>
              <span className={styles.heroAccent}>{roleTitle}</span> Jobs — $100k+
            </h1>
            <p className={styles.heroSub}>
              {data.total.toLocaleString()} opportunities • {avgUsd ? `${formatUsdK(avgUsd)} average (USD)` : 'Verified salaries'}
            </p>

            <div className={styles.quickFilters} aria-label="Quick seniority filters">
              {seniorityChips.map((chip) => {
                const active = selectedSeniority.has(chip.value)
                const href = buildToggleMultiHref(basePath, sp, 'seniority', chip.value)
                return (
                  <Link
                    key={chip.value}
                    href={href}
                    scroll={false}
                    className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                  >
                    {chip.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className={styles.toolbarWrap}>
            <JobsToolbar facets={facets} rolePreset={{ label: roleTitle, emoji }} />
          </div>
        </div>
      </header>

      <section className={styles.grid3} aria-label="Role insights">
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Salary insights</span>
            <span
              className={`${styles.trendBadge} ${
                trend.kind === 'up' ? styles.trendUp : trend.kind === 'down' ? styles.trendDown : ''
              }`}
            >
              {trend.label}
              {deltaPct != null ? <span className={styles.miniRight}>{deltaPct.toFixed(1)}%</span> : null}
            </span>
          </div>
          <div className={styles.cardSub}>Distribution and averages use USD salaries where available.</div>

          <div className={styles.statRow}>
            <div className={styles.stat}>
              <div className={`${styles.statValue} ${styles.statValueAccent}`}>{formatUsdK(avgUsd)}</div>
              <div className={styles.statLabel}>Average salary</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{data.total.toLocaleString()}</div>
              <div className={styles.statLabel}>Total jobs</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{selectedSkills.length ? selectedSkills.length : '—'}</div>
              <div className={styles.statLabel}>Active skill filters</div>
            </div>
          </div>

          <div className={styles.bars} aria-label="Salary distribution">
            {dist.map((d) => (
              <div key={d.label} className={styles.barRow}>
                <div>
                  <div className={styles.barLabel}>{d.label}</div>
                  <div className={styles.barCount}>{d.count.toLocaleString()} jobs</div>
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={cssVarStyle({ '--w': `${(d.count / distMax) * 100}%` })} />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.miniList} aria-label="Top paying cities">
            {cities.length ? (
              cities.slice(0, 3).map((c) => (
                <Link key={c.slug} href={`${basePath}/city/${c.slug}`} className={styles.miniItem}>
                  <span>
                    {c.city} {c.cc ? `· ${c.cc}` : ''}
                  </span>
                  <span className={styles.miniRight}>{formatUsdK(c.avg)}</span>
                </Link>
              ))
            ) : (
              <div className={styles.cardSub}>Not enough salary data to rank cities yet.</div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Skills in demand</span>
            {selectedSkills.length ? (
              <Link href={buildSetMultiHref(basePath, sp, 'skill', [])} className={styles.pageLink}>
                Clear skills
              </Link>
            ) : (
              <span className={styles.cardSub}>Click to filter</span>
            )}
          </div>
          <div className={styles.cardSub}>
            Tag size reflects frequency (sampled from recent postings for this role).
          </div>

          <div className={styles.skillsCloud} aria-label="Skills cloud">
            {skills.length === 0 ? (
              <div className={styles.cardSub}>No skills extracted yet.</div>
            ) : (
              skills.map((s) => {
                const active = selectedSkills.includes(s.name)
                return (
                  <Link
                    key={s.name}
                    href={buildToggleMultiHref(basePath, sp, 'skill', s.name)}
                    scroll={false}
                    className={`${styles.skill} ${active ? styles.skillActive : ''}`}
                    style={cssVarStyle({ '--s': String(s.w) })}
                    title={`${s.count.toLocaleString()} jobs`}
                  >
                    {s.name}
                    {s.hot ? (
                      <span className={styles.hot} aria-label="Trending skill">
                        🔥
                      </span>
                    ) : null}
                  </Link>
                )
              })
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Career path</span>
            <span className={styles.cardSub}>Common progression</span>
          </div>
          <div className={styles.cardSub}>
            Explore seniority variants where available.
          </div>

          <div className={styles.path}>
            <div className={styles.pathRow}>
              {career.map((step) => {
                const href = step.slug ? `/jobs/${step.slug}` : '#'
                const isActive = step.slug === roleSlug
                return (
                  <Link
                    key={step.stage}
                    href={href}
                    className={`${styles.pathStep} ${!step.slug ? styles.pathStepDisabled : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className={styles.pathLabel}>{step.stage}</div>
                    <div className={styles.pathValue}>{step.slug ? step.label : '—'}</div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className={styles.cardTitle} style={{ marginTop: 16 }}>
            <span>Top companies hiring</span>
            <span className={styles.cardSub}>Open roles right now</span>
          </div>

          <div className={styles.companyGrid} aria-label="Top companies">
            {topCompanies.length === 0 ? (
              <div className={styles.cardSub}>No company breakdown yet.</div>
            ) : (
              topCompanies.slice(0, 12).map((c) => {
                const href = c.slug ? `/company/${c.slug}` : '#'
                const initials = String(c.name || '')
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
                return (
                  <Link key={c.id} href={href} className={styles.companyCard}>
                    <span className={styles.companyLeft}>
                      <span className={styles.logoWrap} aria-hidden="true">
                        {c.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.logoUrl} alt="" className={styles.logoImg} loading="lazy" />
                        ) : (
                          <span className={styles.logoFallback}>{initials || 'C'}</span>
                        )}
                      </span>
                      <span className={styles.companyName}>{c.name}</span>
                    </span>
                    <span className={styles.companyCount}>{c.count.toLocaleString()}</span>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </section>

      <section className={styles.listSection} aria-label="Job listings">
        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Filters">
            <JobsFiltersPanel facets={facets} rolePreset={{ label: roleTitle, emoji }} />
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
