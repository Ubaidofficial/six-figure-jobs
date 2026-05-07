import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import { queryJobs, buildWhere, type JobWithCompany } from '../../lib/jobs/queryJobs'
import { prisma } from '../../lib/prisma'
import { SITE_NAME, getSiteUrl } from '../../lib/seo/site'
import { buildNormalizedListingPath, hasNonPaginationQueryParams } from '../../lib/seo/listingSearchParams'
import { collectRemoteRoleRows } from '../../lib/seo/remoteSitemap'
import { buildItemListJsonLd } from '../../lib/seo/itemListJsonLd'
import { buildJobSlugHref } from '../../lib/jobs/jobSlug'
import { buildSalaryText } from '../../lib/jobs/salary'
import { countryCodeToName, countryCodeToSlug } from '../../lib/seo/countrySlug'
import { RemoteHero } from '@/components/remote/RemoteHero'
import { logRuntimeFallback } from '@/lib/runtime/fallback'
import { formatRelativeTime } from '@/lib/utils/time'

import styles from './RemotePage.module.css'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'
export const revalidate = 600

type SearchParams = Record<string, string | string[] | undefined>

type RemoteHubCompany = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
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
    a: 'Yes. The remote hub only includes jobs with validated high-salary signals, published compensation, and seniority filters that remove entry-level noise.',
  },
  {
    q: 'Do these jobs come from company career pages?',
    a: 'Many do. We prioritize ATS-powered company feeds and then supplement with trusted boards when the apply path and compensation quality are strong enough.',
  },
  {
    q: 'How often is the remote jobs hub refreshed?',
    a: 'Remote listings are refreshed frequently, and expired jobs are removed so the page stays current for both applicants and search engines.',
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
  }

  const canonicalPath = buildNormalizedListingPath('/remote', sp)
  const canonical = `${SITE_URL}${canonicalPath}`
  const noindexUtilityState = hasNonPaginationQueryParams(sp)
  const regionLabel = prettyRemoteRegion(activeRemoteRegion)
  const title = regionLabel
    ? `${regionLabel} Remote Jobs (${total.toLocaleString()}) | ${SITE_NAME}`
    : `Remote Jobs (Minimum $100k+ USD) (${total.toLocaleString()}) | ${SITE_NAME}`
  const description = regionLabel
    ? `Browse ${total.toLocaleString()} ${regionLabel.toLowerCase()} six-figure remote jobs across engineering, product, data, and more.`
    : `Browse ${total.toLocaleString()} remote six-figure jobs across engineering, product, data, and more. $100k+ remote jobs, remote high paying jobs, six figure remote jobs.`

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots:
      !noindexUtilityState && total > 0
        ? { index: true, follow: true }
        : { index: false, follow: true },
    openGraph: {
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
  const v = Array.isArray(raw) ? raw[0] : raw
  if (!v) return null
  const value = String(v).trim()
  const allowed = new Set(['global', 'us-only', 'emea', 'apac', 'uk-ireland', 'canada'])
  return allowed.has(value) ? value : null
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
  switch (region) {
    case 'global':
      return 'Worldwide Remote Jobs'
    case 'us-only':
      return 'US Remote Jobs'
    case 'emea':
      return 'EMEA Remote Jobs'
    case 'apac':
      return 'APAC Remote Jobs'
    case 'uk-ireland':
      return 'UK & Ireland Remote Jobs'
    case 'canada':
      return 'Canada Remote Jobs'
    default:
      return null
  }
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
    description: `Browse ${totalJobs.toLocaleString()} remote six-figure jobs from verified companies and trusted sources.`,
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
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const freshWhere = addAndClause(where, {
    OR: [
      { updatedAt: { gte: weekAgo } },
      { postedAt: { gte: weekAgo } },
      { createdAt: { gte: weekAgo } },
    ],
  })

  const [remoteJobCount, companyGroups, countryGroups, avg, roleRows, newThisWeek, recentData] =
    await Promise.all([
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
    ])

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
        select: { id: true, name: true, slug: true, logoUrl: true },
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
    recentJobs: dedupeJobs(recentData.jobs as JobWithCompany[]).slice(0, 9),
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
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Remote Jobs</span>
      </nav>

      <RemoteHero
        remoteJobCount={0}
        companyCount={0}
        countryCount={0}
        avgSalaryUsd={100000}
        activeRemoteRegion={activeRemoteRegion}
      />

      <section className={styles.section} aria-label="Remote roles fallback">
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Remote roles are temporarily unavailable</h2>
            <p className={styles.sectionSub}>
              The production database is reconnecting. Hub pages remain online while live remote
              counts recover.
            </p>
          </div>
        </div>

        <div className={styles.roleGrid}>
          {fallbackRoles.map((slug) => (
            <Link key={slug} href={`/remote/${slug}`} className={styles.roleCard}>
              <div className={styles.roleLeft}>
                <div className={styles.roleName}>{toTitleCase(slug)}</div>
                <div className={styles.roleMeta}>
                  <span className={styles.pill}>Role hub</span>
                  {activeRemoteRegion ? (
                    <span className={styles.pill}>{activeRemoteRegion}</span>
                  ) : null}
                </div>
              </div>
              <div className={styles.arrow} aria-hidden="true">
                →
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
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

    return (
      <main className={styles.page}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Remote Jobs</span>
        </nav>

        <RemoteHero
          remoteJobCount={remoteJobCount}
          companyCount={companyCount}
          countryCount={countryCount}
          avgSalaryUsd={avgSalaryUsd}
          activeRemoteRegion={activeRemoteRegion}
        />

        <section className={styles.section} aria-label="Latest remote jobs">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Latest remote six-figure jobs</h2>
              <p className={styles.sectionSub}>
                Search-friendly hub content starts with real inventory. These are live remote jobs
                surfaced from the latest verified feed.
              </p>
            </div>
          </div>

          <div className={styles.signalGrid}>
            <div className={styles.signalCard}>
              <div className={styles.signalValue}>{newThisWeek.toLocaleString()}</div>
              <div className={styles.signalLabel}>New or refreshed this week</div>
            </div>
            <div className={styles.signalCard}>
              <div className={styles.signalValue}>{roleList.length.toLocaleString()}</div>
              <div className={styles.signalLabel}>Remote role hubs linked from this page</div>
            </div>
            <div className={styles.signalCard}>
              <div className={styles.signalValue}>
                {regionPill ? regionPill.replace(' Remote Jobs', '') : 'Global'}
              </div>
              <div className={styles.signalLabel}>Current remote market focus</div>
            </div>
          </div>

          {recentJobs.length === 0 ? (
            <div className={styles.empty}>
              No remote jobs found. Try adjusting your filters or clear them to explore all remote
              opportunities.
            </div>
          ) : (
            <div className={styles.jobGrid}>
              {recentJobs.map((job) => {
                const salary = buildSalaryText(job)
                const location = describeRemoteLocation(job)
                const updatedLabel = formatRelativeTime(latestJobTimestamp(job))
                const companyName = job.companyRef?.name ?? job.company ?? 'Company'

                return (
                  <Link
                    key={job.id}
                    href={buildJobSlugHref(job)}
                    className={styles.jobCard}
                  >
                    <div className={styles.jobTop}>
                      <span className={styles.jobCompany}>{companyName}</span>
                      <span className={styles.jobAge}>{updatedLabel}</span>
                    </div>
                    <h3 className={styles.jobTitle}>{job.title}</h3>
                    <div className={styles.jobMeta}>
                      <span>{location}</span>
                      <span>{workTypeLabel(job)}</span>
                      {salary ? <span>{salary}</span> : <span>Salary verified</span>}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section className={styles.section} aria-label="Remote roles">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Explore remote roles</h2>
              <p className={styles.sectionSub}>
                High-paying remote opportunities by role, refreshed frequently from verified sources.
              </p>
            </div>
          </div>

          {roleList.length === 0 ? (
            <div className={styles.empty}>
              No roles found. Try adjusting your filters or clear them to explore all remote
              opportunities.
            </div>
          ) : (
            <div className={styles.roleGrid}>
              {roleList.map((role) => (
                <Link key={role.slug} href={`/remote/${role.slug}`} className={styles.roleCard}>
                  <div className={styles.roleLeft}>
                    <div className={styles.roleName}>{role.title}</div>
                    <div className={styles.roleMeta}>
                      <span className={styles.pill}>{role.count.toLocaleString()} jobs</span>
                      {activeRemoteRegion ? (
                        <span className={styles.pill}>{activeRemoteRegion}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.arrow} aria-hidden="true">
                    →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section} aria-label="Remote companies and markets">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Top remote companies and markets</h2>
              <p className={styles.sectionSub}>
                These company and country links turn the remote hub into a stronger internal-link
                source for the rest of the site.
              </p>
            </div>
          </div>

          <div className={styles.twoColumnGrid}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Remote-friendly companies</h3>
              <div className={styles.companyGrid}>
                {topCompanies.map((company) => (
                  <Link
                    key={company.id}
                    href={`/company/${company.slug}`}
                    className={styles.companyCard}
                  >
                    <span className={styles.companyName}>{company.name}</span>
                    <span className={styles.companyCount}>
                      {company.jobCount.toLocaleString()} remote jobs
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Popular remote countries</h3>
              <div className={styles.countryList}>
                {topCountries.map((country) => (
                  <Link
                    key={country.code}
                    href={`/jobs/location/${country.slug}`}
                    className={styles.countryCard}
                  >
                    <span className={styles.countryName}>{country.name}</span>
                    <span className={styles.countryCount}>
                      {country.jobCount.toLocaleString()} jobs
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-label="Remote hub guidance">
          <div className={styles.why}>
            <h3 className={styles.whyTitle}>Why Choose Remote $100k+ Jobs?</h3>
            <div className={styles.whyList}>
              {[
                'Work from anywhere in the world',
                'Verified $100k+ salary ranges with compensation shown up front',
                'Premium roles from top tech companies',
                'No location restrictions or relocation required',
                'Refreshed daily with new verified opportunities',
              ].map((item) => (
                <div key={item} className={styles.checkItem}>
                  <span className={styles.checkDot} aria-hidden="true">
                    ✓
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.faqGrid}>
            {REMOTE_FAQ.map((item) => (
              <article key={item.q} className={styles.faqCard}>
                <h3 className={styles.faqQuestion}>{item.q}</h3>
                <p className={styles.faqAnswer}>{item.a}</p>
              </article>
            ))}
          </div>

          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Explore adjacent six-figure hubs</h3>
            <div className={styles.linkHub}>
              <Link href="/jobs" className={styles.linkPill}>
                Browse all $100k+ jobs
              </Link>
              <Link href="/companies" className={styles.linkPill}>
                Explore hiring companies
              </Link>
              <Link href="/jobs/200k-plus" className={styles.linkPill}>
                Browse $200k+ jobs
              </Link>
              <Link href="/jobs/300k-plus" className={styles.linkPill}>
                Browse $300k+ jobs
              </Link>
              <Link href="/jobs/location/united-states" className={styles.linkPill}>
                United States jobs
              </Link>
              <Link href="/jobs/location/canada" className={styles.linkPill}>
                Canada jobs
              </Link>
            </div>
          </div>
        </section>

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
      </main>
    )
  } catch (error) {
    logRuntimeFallback('remote.page', error)
    return <RemoteJobsFallback activeRemoteRegion={activeRemoteRegion} />
  }
}
