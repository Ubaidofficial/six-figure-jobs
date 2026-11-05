import type { Metadata } from 'next'
import {
  Faq,
  JobRows,
  ListingHeader,
  ListingLayout,
  ListingPage,
  ListingSection,
  Pagination,
  Prose,
} from '@/components/listing/ListingParts'

import { JobsUnavailablePage } from '@/components/runtime/FallbackPresets'
import { DEFAULT_TTL_MS, memoAsync, stableKey } from '@/lib/cache/memo'
import { prisma } from '@/lib/prisma'
import { buildWhere, queryJobs, type JobQueryInput, type JobWithCompany } from '@/lib/jobs/queryJobs'
import { withRuntimeFallback } from '@/lib/runtime/fallback'
import { getSiteUrl, SITE_NAME } from '@/lib/seo/site'
import { buildItemListJsonLd } from '@/lib/seo/itemListJsonLd'
import { SALARY_TIERS, type SalaryTierId } from '@/lib/jobs/salaryTiers'
import { formatRelativeTime } from '@/lib/utils/time'

import { JobsFiltersPanel, type JobsFacets } from './JobsFilters'
import { JobsToolbar } from './JobsToolbar'
import { ListingSalaryAside } from '@/components/listing/ListingSalaryAside'

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



export function buildSalaryTierMetadata(
  tierId: SalaryTierId,
  total: number,
  options?: { canonicalPath?: string },
): Metadata {
  const tier = SALARY_TIERS[tierId]
  const title = `Top ${tier.rangeLabel} Jobs | ${SITE_NAME}`
  const description =
    total > 0
      ? `Browse ${total.toLocaleString()} ${tier.rangeLabel} jobs with published salary ranges, and fresh listings by role, location, and work type.`
      : `Browse ${tier.rangeLabel} jobs with published salary ranges.`

  const canonical = options?.canonicalPath ? `${SITE_URL}${options.canonicalPath}` : `${SITE_URL}/jobs/${tierId}`
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
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/og-image.png`],
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

  const scopeLabels = [
    country ? `country ${country}` : null,
    remoteMode ? `${remoteMode} roles` : null,
  ].filter(Boolean)
  const scopedSuffix = scopeLabels.length ? ` for ${scopeLabels.join(' and ')}` : ''
  const fallbackTitle = `${tier.rangeLabel} jobs are temporarily unavailable`
  const fallbackDescription = `The live ${tier.rangeLabel} job feed${scopedSuffix} is temporarily unavailable while the production database reconnects. Browse the main job hubs and salary bands while data access recovers.`

  return withRuntimeFallback(
    `jobs.salary-tier.${tierId}.page`,
    async () => {
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

  const [roleRows, countryRows, remoteCount, hybridCount, onsiteCount] = await memoAsync(stableKey('tier-facets', tierId, { ...queryInput, page: undefined }), DEFAULT_TTL_MS, () => Promise.all([
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
  ]))

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

  const avgAgg = await memoAsync(stableKey('tier-avg', tierId, { ...queryInput, page: undefined }), DEFAULT_TTL_MS, () =>
    prisma.job.aggregate({
    where: {
      ...buildWhere(baseFacetInput),
      OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }],
    },
    _avg: { maxAnnual: true, minAnnual: true },
  }),
  )

  const avgMax = asNumber((avgAgg as any)?._avg?.maxAnnual)
  const avgMin = asNumber((avgAgg as any)?._avg?.minAnnual)
  const avgSalary =
    avgMax != null && avgMin != null ? (avgMax + avgMin) / 2 : (avgMax ?? avgMin)

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

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${SITE_URL}/jobs` },
      { '@type': 'ListItem', position: 3, name: `${tier.rangeLabel} Jobs`, item: `${SITE_URL}/jobs/${tierId}` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What kinds of jobs are in the ${tier.rangeLabel} salary tier?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The ${tier.rangeLabel} salary tier on ${SITE_NAME} includes ${data.total.toLocaleString()} verified roles across engineering, product, data, design, and sales — all with published salary ranges. Top roles in this tier include software engineers, engineering managers, data scientists, and senior product managers.`,
        },
      },
      {
        '@type': 'Question',
        name: `How often are ${tier.rangeLabel} job listings updated?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `New ${tier.rangeLabel} listings are added every day and jobs that are no longer open are removed. Each listing shows the salary from the employer’s posting and links to the company’s own application page.`,
        },
      },
      {
        '@type': 'Question',
        name: `Are there remote ${tier.rangeLabel} jobs available?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. Many ${tier.rangeLabel} roles on ${SITE_NAME} offer fully remote or hybrid arrangements. Use the work type filter to narrow results to distributed-friendly positions. Remote ${tier.rangeLabel} roles span engineering, product, and data teams at companies of all sizes.`,
        },
      },
    ],
  }

  const basePath = `/jobs/${tierId}`

  return (
    <ListingPage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(salaryPageJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <ListingHeader
        aside={<ListingSalaryAside input={queryInput} scope={`${tier.rangeLabel} roles`} compare={false} />}
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Jobs', href: '/jobs' }, { label: tier.rangeLabel }]}
        accent={tier.rangeLabel}
        title="Jobs"
        summary={
          <>
            <strong>{data.total.toLocaleString()}</strong> {data.total === 1 ? 'job' : 'jobs'} with a published salary
            {avgSalary ? <> · average <strong>{formatUsdK(avgSalary)}</strong></> : null}
            {lastUpdatedLabel ? <> · updated {lastUpdatedLabel}</> : null}
          </>
        }
        toolbar={<JobsToolbar facets={facets} salaryPresetLabel={tier.rangeLabel} />}
      />

      <ListingLayout sidebar={<JobsFiltersPanel facets={facets} salaryPresetLabel={tier.rangeLabel} />}>
        <JobRows
          jobs={jobs}
          empty={{
            title: 'No jobs match these filters.',
            body: 'Clear the filters to see every job in this salary range.',
            href: basePath,
          }}
        />
        <Pagination page={page} totalPages={totalPages} hrefFor={(n) => buildPageHref(basePath, sp, n)} />
      </ListingLayout>

      <ListingSection title={`About ${tier.rangeLabel} jobs`}>
        <Prose>
          <p>
            <strong>{tier.rangeLabel} jobs</strong> on Six Figure Jobs: {data.total.toLocaleString()} roles with a
            published salary range.{avgSalary ? ` Average salary: ${formatUsdK(avgSalary)} USD.` : ''} Salaries come
            from the employer&rsquo;s own posting, and every listing links to the company&rsquo;s application page.
            Filter by role, country or work type to narrow the list.
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
        primaryHref={`/jobs/${tierId}`}
        primaryLabel={`Retry ${tier.rangeLabel} jobs`}
      />
    ),
  )
}
