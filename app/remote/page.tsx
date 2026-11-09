import type { Metadata } from 'next'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { cache } from 'react'
import { queryJobs, buildWhere, type JobWithCompany } from '../../lib/jobs/queryJobs'
import { loadTopRolePages, topRolesRow } from '@/lib/roles/topRolePages'
import { prisma } from '../../lib/prisma'
import { SITE_NAME, getSiteUrl, defaultOgImages } from '../../lib/seo/site'
import { buildNormalizedListingPath, hasNonPaginationQueryParams } from '../../lib/seo/listingSearchParams'
import { collectRemoteRoleRows } from '../../lib/seo/remoteSitemap'
import { buildItemListJsonLd } from '../../lib/seo/itemListJsonLd'
import { buildJobSlugHref } from '../../lib/jobs/jobSlug'
import { newThisWeekClause } from '../../lib/jobs/postedRecently'
import { buildSalaryText } from '../../lib/jobs/salary'
import { countryCodeToName, countryCodeToSlug } from '../../lib/seo/countrySlug'
import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { buildLogoUrl } from '@/lib/companies/logo'
import listingStyles from '@/components/listing/Listing.module.css'
import {
  Faq,
  JobRows,
  ListingLayout,
  LinkChips,
  ListingHeader,
  ListingPage,
  ListingSection,
} from '@/components/listing/ListingParts'
import { logRuntimeFallback, skipPrerenderWhileBuilding } from '@/lib/runtime/fallback'
import { formatRelativeTime } from '@/lib/utils/time'
import { DEFAULT_TTL_MS, memoAsync, stableKey } from '@/lib/cache/memo'
import { ListingSalaryAside } from '@/components/listing/ListingSalaryAside'
import {
  countRemoteByRegion,
  normalizeRemoteRegionSlug,
  remoteRegionDef,
  visibleHubRegionSlugs,
} from '../../lib/jobs/remoteRegions'
import { loadSiteCounts } from '../../lib/jobs/siteCounts'


/**
 * Region chips for the hub. With counts (taken from the database at most every hour) a region that has no remote jobs
 * right now is left out, so there is never a chip that opens an empty page; the region being viewed always stays.
 */
function buildRegionChips(active: string | null, regionCounts?: Record<string, number> | null) {
  const all = {
    label: 'All remote',
    href: '/remote',
    active: !active,
  }
  const regions = visibleHubRegionSlugs(regionCounts, active).map((slug) => ({
    label: remoteRegionDef(slug)!.label,
    href: `/remote?remoteRegion=${encodeURIComponent(slug)}`,
    active: active === slug,
    count: regionCounts ? (regionCounts[slug] ?? 0) : undefined,
  }))
  return [all, ...regions]
}

const SITE_URL = getSiteUrl()

export const revalidate = 600

type SearchParams = Record<string, string | string[] | undefined>

type RemoteHubCompany = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  website: string | null
  jobCount: number
}

type RemoteHubCountry = {
  code: string
  slug: string
  name: string
  jobCount: number
}

type RemoteHubSnapshot = {
  remoteJobCount: number
  companyCount: number
  countryCount: number
  avgSalaryUsd: number
  newThisWeek: number
  roleList: Array<{ slug: string; count: number; title: string }>
  recentJobs: JobWithCompany[]
  topCompanies: RemoteHubCompany[]
  topCountries: RemoteHubCountry[]
}

const REMOTE_FAQ = [
  {
    q: 'Are these remote jobs really six figures?',
    a: 'Every job here has a published salary at or above the six-figure threshold for its currency. Salaries come from the employer’s posting.',
  },
  {
    q: 'Where do these jobs come from?',
    a: 'Jobs are collected from company career pages and job boards. Each apply button says where it goes: the employer’s own application page or the job board the role was posted on.',
  },
  {
    q: 'How often is the remote jobs hub refreshed?',
    a: 'New remote jobs are added every day, and jobs that are no longer open are removed.',
  },
] as const

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = (await searchParams) || {}
  const activeRemoteRegion = normalizeRemoteRegion(sp.remoteRegion)
  let total = 0

  try {
    total = (await getRemoteHubSnapshot(activeRemoteRegion)).remoteJobCount
  } catch (error) {
    logRuntimeFallback('remote.metadata', error)
    await skipPrerenderWhileBuilding()
  }

  const canonicalPath = buildNormalizedListingPath('/remote', sp)
  const canonical = `${SITE_URL}${canonicalPath}`
  const noindexUtilityState = hasNonPaginationQueryParams(sp)
  const regionLabel = prettyRemoteRegion(activeRemoteRegion)
  const title = regionLabel
    ? `${regionLabel} Remote $100k+ Jobs (${total.toLocaleString()} Open Roles) | ${SITE_NAME}`
    : `Remote $100k+ Jobs — ${total.toLocaleString()} Six-Figure Openings | ${SITE_NAME}`
  const description = regionLabel
    ? `Browse ${total.toLocaleString()} ${regionLabel.toLowerCase()} six-figure remote jobs in engineering, product, data and more, with published salaries and fresh listings.`
    : `Browse ${total.toLocaleString()} remote six-figure jobs with published salaries and links to apply. Engineering, product, data and more, new jobs added daily.`

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: noindexUtilityState
      ? { index: false, follow: true }
      : { index: true, follow: true },
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

function normalizeRemoteRegion(raw?: string | string[]): string | null {
  return normalizeRemoteRegionSlug(raw)
}

function toTitleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
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

function addAndClause<T extends { AND?: any }>(where: T, clause: Record<string, unknown>): T {
  const andClauses = where.AND
    ? Array.isArray(where.AND)
      ? [...where.AND, clause]
      : [where.AND, clause]
    : [clause]
  return { ...where, AND: andClauses }
}

function prettyRemoteRegion(region: string | null): string | null {
  return remoteRegionDef(region)?.heading ?? null
}

function latestJobTimestamp(job: JobWithCompany): number {
  const candidate = job.updatedAt ?? job.postedAt ?? job.createdAt
  if (!candidate) return 0
  const ms = new Date(candidate).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function workTypeLabel(job: JobWithCompany): string {
  const mode = String(job.remoteMode ?? job.workArrangementNormalized ?? '').toLowerCase()
  if (job.remote === true || mode === 'remote') return 'Remote'
  if (mode === 'hybrid') return 'Hybrid'
  if (mode === 'onsite' || mode === 'on-site') return 'On-site'
  return 'Remote-friendly'
}

function describeRemoteLocation(job: JobWithCompany): string {
  const primary = String(job.primaryLocation ?? '').trim()
  if (primary) return primary
  if (job.countryCode) return countryCodeToName(job.countryCode)
  if (job.remoteRegion) return prettyRemoteRegion(job.remoteRegion) ?? 'Remote'
  return 'Remote'
}

function dedupeJobs(jobs: JobWithCompany[]): JobWithCompany[] {
  const seen = new Set<string>()
  return jobs.filter((job) => {
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

function buildRemoteBreadcrumbJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Remote Jobs', item: `${SITE_URL}/remote` },
    ],
  }
}

function buildRemoteCollectionPageJsonLd(totalJobs: number, canonicalPath: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Remote $100k+ jobs',
    description: `Browse ${totalJobs.toLocaleString()} remote six-figure jobs with published salaries, new jobs added daily.`,
    url: `${SITE_URL}${canonicalPath}`,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
}

function buildRemoteFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: REMOTE_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }
}

const getRemoteHubSnapshot = cache(async (activeRemoteRegion: string | null): Promise<RemoteHubSnapshot> => {
  const where = buildWhere({
    remoteOnly: true,
    remoteRegion: activeRemoteRegion || undefined,
    excludeInternships: true,
  })
  const freshWhere = addAndClause(where, newThisWeekClause())

  const [remoteJobCount, companyGroups, countryGroups, avg, roleRows, newThisWeek, recentData] =
    await memoAsync(stableKey('remote-snapshot', activeRemoteRegion), DEFAULT_TTL_MS, () => Promise.all([
      prisma.job.count({ where }),
      prisma.job.groupBy({
        by: ['companyId'],
        where: { ...where, companyId: { not: null } },
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ['countryCode'],
        where: { ...where, countryCode: { not: null } },
        _count: { _all: true },
      }),
      prisma.job.aggregate({
        where: addAndClause(where, {
          currency: 'USD',
          OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }],
        }),
        _avg: { maxAnnual: true, minAnnual: true },
      }),
      collectRemoteRoleRows({ remoteRegion: activeRemoteRegion }),
      prisma.job.count({ where: freshWhere }),
      queryJobs({
        remoteOnly: true,
        remoteRegion: activeRemoteRegion || undefined,
        excludeInternships: true,
        sortBy: 'date',
        page: 1,
        pageSize: 12,
      }),
    ]))

  const topCompanyGroups = companyGroups
    .filter((group) => Boolean(group.companyId))
    .map((group) => ({
      companyId: String(group.companyId),
      jobCount: Number((group as any)._count?._all ?? 0),
    }))
    .sort((a, b) => b.jobCount - a.jobCount)
    .slice(0, 8)

  const companyRows = topCompanyGroups.length
    ? await prisma.company.findMany({
        where: { id: { in: topCompanyGroups.map((group) => group.companyId) } },
        select: { id: true, name: true, slug: true, logoUrl: true, website: true },
      })
    : []

  const companyMap = new Map(companyRows.map((company) => [company.id, company]))
  const topCompanies = topCompanyGroups
    .map((group) => {
      const company = companyMap.get(group.companyId)
      if (!company || !company.name) return null
      return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logoUrl: company.logoUrl,
        website: company.website,
        jobCount: group.jobCount,
      }
    })
    .filter((company): company is RemoteHubCompany => Boolean(company))

  const topCountries = countryGroups
    .map((group) => {
      const code = String(group.countryCode || '').toUpperCase()
      const slug = countryCodeToSlug(code)
      if (!code || !slug) return null
      return {
        code,
        slug,
        name: countryCodeToName(code),
        jobCount: Number((group as any)._count?._all ?? 0),
      }
    })
    .filter((country): country is RemoteHubCountry => Boolean(country))
    .sort((a, b) => b.jobCount - a.jobCount)
    .slice(0, 8)

  return {
    remoteJobCount,
    companyCount: companyGroups.length,
    countryCount: countryGroups.length,
    avgSalaryUsd: Math.min(
      500_000,
      Math.max(
        100_000,
        asNumber((avg as any)?._avg?.minAnnual ?? (avg as any)?._avg?.maxAnnual) ?? 156_000,
      ),
    ),
    newThisWeek,
    roleList: roleRows.map((row) => ({
      slug: row.roleSlug,
      count: row.total,
      title: toTitleCase(row.roleSlug),
    })),
    recentJobs: dedupeJobs(recentData.jobs as JobWithCompany[]).slice(0, 12),
    topCompanies,
    topCountries,
  }
})

function RemoteJobsFallback({ activeRemoteRegion }: { activeRemoteRegion: string | null }) {
  const fallbackRoles = [
    'software-engineer',
    'product-manager',
    'data-engineer',
    'designer',
    'devops-engineer',
    'machine-learning-engineer',
  ]

  return (
    <ListingPage>
      <ListingHeader
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Remote Jobs' }]}
        accent="Remote"
        title="$100k+ Jobs"
        summary="Live remote job counts are temporarily unavailable. Browse by role below."
        chips={buildRegionChips(activeRemoteRegion)}
      />
      <ListingSection title="Remote roles">
        <LinkChips
          label="Remote roles"
          items={fallbackRoles.map((slug) => ({ label: toTitleCase(slug), href: `/remote/${slug}` }))}
        />
      </ListingSection>
    </ListingPage>
  )
}

export default async function RemoteJobsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) || {}
  const activeRemoteRegion = normalizeRemoteRegion(sp.remoteRegion)

  try {
    const {
      remoteJobCount,
      companyCount,
      countryCount,
      avgSalaryUsd,
      newThisWeek,
      roleList,
      recentJobs,
      topCompanies,
      topCountries,
    } = await getRemoteHubSnapshot(activeRemoteRegion)
    const topRemoteRoles = await loadTopRolePages({
      remoteOnly: true,
      remoteRegion: activeRemoteRegion || undefined,
      excludeInternships: true,
    })

    const canonicalPath = buildNormalizedListingPath('/remote', sp)
    const breadcrumbJsonLd = buildRemoteBreadcrumbJsonLd()
    const itemListJsonLd = buildItemListJsonLd({
      name: 'Remote $100k+ jobs',
      jobs: recentJobs.map((job) => ({ id: job.id, title: job.title })),
      page: 1,
      pageSize: recentJobs.length || 1,
    })
    const collectionPageJsonLd = buildRemoteCollectionPageJsonLd(remoteJobCount, canonicalPath)
    const faqJsonLd = buildRemoteFaqJsonLd()
    const regionPill = prettyRemoteRegion(activeRemoteRegion)
    // Remote jobs per region, counted from the database at most every hour; the chips still work without them.
    const regionCounts = await loadSiteCounts()
      .then((c) => countRemoteByRegion(c.remoteByCountry, c.remoteWithoutCountry))
      .catch((error) => {
        logRuntimeFallback('remote.regionCounts', error)
        return null
      })

    return (
      <ListingPage>
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

        <ListingHeader
          aside={
            <ListingSalaryAside
              input={{ remoteOnly: true, remoteRegion: activeRemoteRegion || undefined, excludeInternships: true }}
              scope={regionPill ? `remote roles in ${regionPill.replace(' Jobs', '')}` : 'remote roles'}
            />
          }
          breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Remote Jobs' }]}
          accent={regionPill ? regionPill.replace(' Jobs', '') : 'Remote'}
          title="$100k+ Jobs"
          summary={
            <>
              <strong>{remoteJobCount.toLocaleString()}</strong> remote {remoteJobCount === 1 ? 'job' : 'jobs'} from{' '}
              <strong>{companyCount.toLocaleString()}</strong> {companyCount === 1 ? 'company' : 'companies'}
              {avgSalaryUsd ? <> · average <strong>${Math.round(avgSalaryUsd / 1000)}k</strong></> : null}
              {newThisWeek ? <> · {newThisWeek.toLocaleString()} new this week</> : null}
            </>
          }
          cta={remoteJobCount > 0 ? `Browse ${remoteJobCount.toLocaleString()} remote ${remoteJobCount === 1 ? 'job' : 'jobs'}` : undefined}
          chips={buildRegionChips(activeRemoteRegion, regionCounts)}
          related={topRolesRow('Top remote roles', topRemoteRoles, '/remote')}
        />

        <ListingLayout>
          <JobRows
            jobs={recentJobs}
            empty={{
              title: 'No remote jobs found.',
              body: 'Try another region, or browse every $100k+ job.',
              href: '/jobs',
              hrefLabel: 'Browse all jobs',
            }}
          />
          {remoteJobCount > recentJobs.length ? (
            <p style={{ marginTop: 16 }}>
              <Link href="/jobs?remoteMode=remote" className={listingStyles.pageLink}>
                See all {remoteJobCount.toLocaleString()} remote jobs →
              </Link>
            </p>
          ) : null}
        </ListingLayout>

        {roleList.length > 0 ? (
          <ListingSection title="Remote jobs by role">
            <LinkChips
              label="Remote roles"
              items={roleList.map((role) => ({
                label: role.title,
                href: `/remote/${role.slug}`,
                count: role.count,
              }))}
            />
          </ListingSection>
        ) : null}

        {topCompanies.length > 0 ? (
          <ListingSection title="Companies hiring remotely">
            <LinkChips
              label="Remote-friendly companies"
              items={topCompanies
                .filter((c) => c.slug)
                .map((c) => ({
                  label: c.name,
                  href: `/company/${c.slug}`,
                  count: c.jobCount,
                  logo: <CompanyLogo name={c.name} src={buildLogoUrl(c.logoUrl, c.website, c.name)} size="sm" />,
                }))}
            />
          </ListingSection>
        ) : null}

        {topCountries.length > 0 ? (
          <ListingSection title="Remote jobs by country">
            <LinkChips
              label="Remote countries"
              items={topCountries.map((c) => ({
                label: c.name,
                href: `/jobs/location/${c.slug}`,
                count: c.jobCount,
              }))}
            />
          </ListingSection>
        ) : null}

        <ListingSection title="Frequently asked questions">
          <Faq items={REMOTE_FAQ.map((item) => ({ question: item.q, answer: item.a }))} />
        </ListingSection>
      </ListingPage>
    )
  } catch (error) {
    unstable_rethrow(error)
    logRuntimeFallback('remote.page', error)
    await skipPrerenderWhileBuilding()
    return <RemoteJobsFallback activeRemoteRegion={activeRemoteRegion} />
  }
}
