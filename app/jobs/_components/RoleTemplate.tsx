import type { Metadata } from 'next'

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
import { JobsUnavailablePage } from '@/components/runtime/FallbackPresets'
import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { buildLogoUrl } from '@/lib/companies/logo'
import { DEFAULT_TTL_MS, memoAsync, stableKey } from '@/lib/cache/memo'
import { prisma } from '@/lib/prisma'
import { buildWhere, queryJobs, type JobQueryInput, type JobWithCompany } from '@/lib/jobs/queryJobs'
import { withRuntimeFallback } from '@/lib/runtime/fallback'
import { buildItemListJsonLd } from '@/lib/seo/itemListJsonLd'
import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'
import { CITY_TARGET_SLUG_SET } from '@/lib/seo/pseoTargets'
import { SEARCH_ROLE_OPTIONS } from '@/lib/roles/searchRoles'
import { CANONICAL_ROLE_SET } from '@/lib/roles/canonicalSlugs'
import { formatRelativeTime } from '@/lib/utils/time'

import { JobsFiltersPanel, type JobsFacets } from './JobsFilters'
import { JobsToolbar } from './JobsToolbar'
import { ListingSalaryAside } from '@/components/listing/ListingSalaryAside'
import { SalaryByLevel } from '@/components/listing/SalaryByLevel'

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

function parseStringArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function stripHtml(value: string | null | undefined): string {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncateText(value: string | null | undefined, max = 120): string | null {
  const clean = stripHtml(value)
  if (!clean) return null
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 3).trim()}...`
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

function roleCareerPath(roleSlug: string): Array<{ stage: string; slug: string | null; label: string; seniority: string | null }> {
  const slug = roleSlug.toLowerCase()
  const base = slug
    .replace(/^junior-/, '')
    .replace(/^mid-/, '')
    .replace(/^senior-/, '')
    .replace(/^staff-/, '')
    .replace(/^principal-/, '')
    .replace(/^lead-/, '')

  const candidates = [
    { stage: 'Junior', slug: `junior-${base}`, seniority: 'junior' },
    { stage: 'Mid', slug: base, seniority: null },
    { stage: 'Senior', slug: `senior-${base}`, seniority: 'senior' },
    { stage: 'Staff', slug: `staff-${base}`, seniority: 'staff' },
    { stage: 'Principal', slug: `principal-${base}`, seniority: 'principal' },
  ]

  return candidates.map((c) => ({
    stage: c.stage,
    // Keep the slug for is-active detection, but we'll link via seniority param
    slug: CANONICAL_ROLE_SET.has(c.slug) ? c.slug : c.stage === 'Mid' && CANONICAL_ROLE_SET.has(base) ? base : null,
    label: c.stage === 'Mid' ? toTitleCase(base) : toTitleCase(c.slug),
    seniority: c.seniority,
    // Use base slug for linking (avoids 404 when seniority slug has 0 jobs in DB)
    baseSlug: CANONICAL_ROLE_SET.has(base) ? base : null,
  })) as Array<{ stage: string; slug: string | null; label: string; seniority: string | null; baseSlug: string | null }>
}

export function buildRoleMetadata(
  roleSlug: string,
  total: number,
  avgUsd: number | null,
  options?: { canonicalPath?: string },
): Metadata {
  const roleOpt = SEARCH_ROLE_OPTIONS.find((r) => r.slug === roleSlug)
  const roleTitle = roleOpt?.label ?? toTitleCase(roleSlug)

  const title = `${roleTitle} Jobs - $100k+ | ${SITE_NAME}`
  const description =
    total > 0
      ? `Browse ${total.toLocaleString()} ${roleTitle} jobs with published salary ranges.${avgUsd ? ` ~$${Math.round(avgUsd / 1000)}k average USD salary where available.` : ''}`
      : `Browse ${roleTitle} jobs with published salary ranges.`

  const canonical = options?.canonicalPath ? `${SITE_URL}${options.canonicalPath}` : `${SITE_URL}/jobs/${roleSlug}`
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

  const scopeLabels = [
    country ? `country ${country}` : null,
    remoteMode ? `${remoteMode} roles` : null,
    selectedSkills.length ? `${selectedSkills.length} skill filters` : null,
  ].filter(Boolean)
  const scopedSuffix = scopeLabels.length ? ` for ${scopeLabels.join(' and ')}` : ''
  const fallbackTitle = `${toTitleCase(roleSlug)} jobs are temporarily unavailable`
  const fallbackDescription = `The live ${toTitleCase(roleSlug)} job feed${scopedSuffix} is temporarily unavailable while the production database reconnects. Browse the broader jobs index or retry this role hub once data access is restored.`

  return withRuntimeFallback(
    `jobs.role.${roleSlug}.page`,
    async () => {
  const data = await queryJobs(queryInput)
  const jobs = dedupeJobs(data.jobs as JobWithCompany[])
  const totalPages = Math.max(1, data.totalPages || 1)
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

  const [countryRows, remoteCount, hybridCount, onsiteCount] = await memoAsync(stableKey('role-facets', roleSlug, { ...queryInput, page: undefined }), DEFAULT_TTL_MS, () => Promise.all([
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
  ]))

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

  const [avgAggUsd, topCityRows] = await memoAsync(stableKey('role-insights', roleSlug), DEFAULT_TTL_MS, () => Promise.all([
    prisma.job.aggregate({
      where: {
        ...insightsWhere,
        currency: 'USD',
        OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }],
      },
      _avg: { maxAnnual: true, minAnnual: true },
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
  ]))

  const avgMaxUsd = asNumber((avgAggUsd as any)?._avg?.maxAnnual)
  const avgMinUsd = asNumber((avgAggUsd as any)?._avg?.minAnnual)
  const avgUsd = avgMaxUsd != null && avgMinUsd != null ? (avgMaxUsd + avgMinUsd) / 2 : (avgMaxUsd ?? avgMinUsd)

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
    .filter((c) => c.slug && CITY_TARGET_SLUG_SET.has(c.slug))
    .filter((c) => c.slug && c.city)

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
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          website: true,
          description: true,
          industry: true,
          sizeBucket: true,
          headquarters: true,
        },
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
        description: truncateText(info?.description ?? null),
        industry: info?.industry ?? null,
        sizeBucket: info?.sizeBucket ?? null,
        headquarters: info?.headquarters ?? null,
        count: Number(r?._count?._all ?? 0),
      }
    })
    .filter((c) => Boolean(c.name))

  const roleOpt = SEARCH_ROLE_OPTIONS.find((r) => r.slug === roleSlug)
  const roleTitle = roleOpt?.label ?? toTitleCase(roleSlug)
  const emoji = roleOpt?.emoji ?? '💼'

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

  const avgUsdLabel = avgUsd ? `~$${Math.round(avgUsd / 1000)}k USD` : 'competitive salaries'
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How much does a ${roleTitle} make?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${roleTitle} roles on ${SITE_NAME} average ${avgUsdLabel}. Salaries range from $100k to $300k+ depending on seniority, location, and company size. All listings show verified salary ranges upfront.`,
        },
      },
      {
        '@type': 'Question',
        name: `Are there remote ${roleTitle} jobs available?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. ${SITE_NAME} lists ${data.total.toLocaleString()} ${roleTitle} jobs including fully remote, hybrid, and on-site positions. Use the Remote filter to narrow results to distributed-friendly roles.`,
        },
      },
      {
        '@type': 'Question',
        name: `What skills are required for ${roleTitle} jobs?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: skills.length
            ? `Top skills for ${roleTitle} jobs include ${skills.slice(0, 8).map((s) => s.name).join(', ')}. Skill demand is derived from active $100k+ job postings on ${SITE_NAME}.`
            : `${roleTitle} roles typically require a mix of technical and domain expertise. Browse current listings on ${SITE_NAME} for specific skill requirements.`,
        },
      },
      {
        '@type': 'Question',
        name: `How do I find $100k+ ${roleTitle} jobs?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Every listing on ${SITE_NAME} is filtered to $100k+ with a published salary range. Browse ${data.total.toLocaleString()} ${roleTitle} jobs, filter by seniority, location, or remote preference, and apply directly via each listing's link.`,
        },
      },
    ],
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${SITE_URL}/jobs` },
      { '@type': 'ListItem', position: 3, name: `${roleTitle} Jobs`, item: `${SITE_URL}/jobs/${roleSlug}` },
    ],
  }

  return (
    <ListingPage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <ListingHeader
        aside={<ListingSalaryAside input={queryInput} scope={`${roleTitle} roles`} />}
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Jobs', href: '/jobs' }, { label: roleTitle }]}
        accent={roleTitle}
        title="Jobs — $100k+"
        summary={
          <>
            <strong>{data.total.toLocaleString()}</strong> {data.total === 1 ? 'job' : 'jobs'} with a published salary
            {avgUsd ? <> · average <strong>{formatUsdK(avgUsd)}</strong></> : null}
            {lastUpdatedLabel ? <> · updated {lastUpdatedLabel}</> : null}
          </>
        }
        chips={seniorityChips.map((chip) => ({
          label: chip.label,
          href: buildToggleMultiHref(basePath, sp, 'seniority', chip.value),
          active: selectedSeniority.has(chip.value),
          nofollow: true,
        }))}
        toolbar={<JobsToolbar facets={facets} rolePreset={{ label: roleTitle, emoji }} />}
      />

      <ListingLayout sidebar={<JobsFiltersPanel facets={facets} rolePreset={{ label: roleTitle, emoji }} />}>
        <JobRows
          jobs={jobs}
          empty={{
            title: 'No jobs match these filters.',
            body: `Clear the filters to see every ${roleTitle} job.`,
            href: basePath,
          }}
        />
        <Pagination page={page} totalPages={totalPages} hrefFor={(n) => buildPageHref(basePath, sp, n)} />
      </ListingLayout>

      {cities.length > 0 ? (
        <ListingSection title={`Top-paying cities for ${roleTitle}`}>
          <LinkChips
            label="Top paying cities"
            items={cities.slice(0, 6).map((c) => ({
              label: `${c.city}${c.cc ? ` · ${c.cc}` : ''}`,
              href: `${basePath}/city/${c.slug}`,
            }))}
          />
        </ListingSection>
      ) : null}

      {topCompanies.length > 0 ? (
        <ListingSection title={`Companies hiring ${roleTitle}s`}>
          <LinkChips
            label="Top companies"
            items={topCompanies
              .filter((c) => c.slug && c.name)
              .slice(0, 12)
              .map((c) => ({
                label: String(c.name),
                href: `/company/${c.slug}`,
                count: c.count,
                logo: <CompanyLogo name={String(c.name)} src={c.logoUrl} size="sm" />,
              }))}
          />
        </ListingSection>
      ) : null}

      {skills.length > 0 ? (
        <ListingSection title={`In-demand skills for ${roleTitle}`}>
          <LinkChips
            label="Skills"
            items={skills.slice(0, 16).map((sk) => ({
              label: sk.name,
              href: buildToggleMultiHref(basePath, sp, 'skill', sk.name),
              active: selectedSkills.includes(sk.name),
              count: sk.count,
              nofollow: true,
            }))}
          />
        </ListingSection>
      ) : null}

      <SalaryByLevel input={{ roleSlugs: [roleSlug] }} label={roleTitle} />

      <ListingSection title="Other levels">
        <LinkChips
          label="Career path"
          items={career
            .map((step) => {
              const linkSlug = (step as typeof step & { baseSlug?: string | null }).baseSlug ?? step.slug
              return linkSlug
                ? { label: step.label, href: `/jobs/${linkSlug}`, active: step.slug === roleSlug }
                : null
            })
            .filter((x): x is { label: string; href: string; active: boolean } => x !== null)}
        />
      </ListingSection>

      <ListingSection title={`About ${roleTitle} jobs`}>
        <Prose>
          <p>
            {data.total.toLocaleString()} <strong>{roleTitle}</strong> jobs paying $100k+ are listed on Six Figure Jobs.
            {avgUsd ? ` The average salary is ${formatUsdK(avgUsd)} USD.` : ''} Every listing shows its salary range
            from the employer&rsquo;s posting. Use the filters to narrow by seniority, location, skills or work type.
          </p>
        </Prose>
      </ListingSection>

      <ListingSection title="Frequently asked questions">
        <Faq
          items={faqJsonLd.mainEntity.map((item: { name: string; acceptedAnswer: { text: string } }) => ({
            question: item.name,
            answer: item.acceptedAnswer.text,
          }))}
        />
      </ListingSection>
    </ListingPage>
  )
    },
    () => (
      <JobsUnavailablePage
        title={fallbackTitle}
        description={fallbackDescription}
        primaryHref={`/jobs/${roleSlug}`}
        primaryLabel={`Retry ${toTitleCase(roleSlug)} jobs`}
      />
    ),
  )
}
