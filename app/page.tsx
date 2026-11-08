// app/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  queryJobs,
  type JobWithCompany,
  HIGH_SALARY_MIN_CONFIDENCE,
} from '../lib/jobs/queryJobs'
import { SEARCH_ROLE_OPTIONS } from '../lib/roles/searchRoles'
import { TARGET_COUNTRIES } from '../lib/seo/regions'
import { buildSliceCanonicalPath } from '../lib/seo/canonical'
import { HomeFAQ } from './pageFAQ'
import { CATEGORY_LINKS } from '@/lib/constants/category-links'
import { LOCATIONS } from '@/lib/constants/homepage'
import { SALARY_TIERS, tierQueryInput, type SalaryTierId } from '@/lib/jobs/salaryTiers'
import { countryCodeToSlug } from '@/lib/seo/countrySlug'
import { Hero } from '@/components/home/Hero'
import { HeroFilters } from '@/components/home/HeroFilters'
import { loadSalarySnapshot } from '@/lib/jobs/salarySnapshot'
import { loadSiteCounts } from '@/lib/jobs/siteCounts'
import { LiveJobFeed } from '@/components/home/LiveJobFeed'
import { SiteStatsStrip } from '@/components/home/SiteStatsStrip'
import { buildFeedItems } from '@/lib/jobs/latestFeed'
import {
  FeaturedCompaniesCarousel,
  type FeaturedCompany,
} from '@/components/home/FeaturedCompaniesCarousel'
import { LatestOpportunities } from '@/components/home/LatestOpportunities'
import { BrowseBySalaryTier, type SalaryTier } from '@/components/home/BrowseBySalaryTier'
import {
  ExplorePremiumRoles,
  type PremiumRoleCard,
} from '@/components/home/ExplorePremiumRoles'
import { HIGH_SALARY_THRESHOLDS } from '@/lib/currency/thresholds'
import { getThresholdLabelForCountry } from '@/lib/seo/salaryLabels'
import { getSiteUrl } from '@/lib/seo/site'
import { buildHomeDescription } from '@/lib/seo/metaText'
import { TopLocations, type TopLocationCard } from '@/components/home/TopLocations'
import { logRuntimeFallback, skipPrerenderWhileBuilding } from '@/lib/runtime/fallback'
import { loadPublicSiteStats } from '@/lib/jobs/publicStats'
import { getPriorityPublishedCompanyCandidates } from '@/lib/seo/companyPublishing'
import { TOP_COMPANY_SLUGS } from '@/lib/constants/topCompanies'

export const revalidate = 300 // 5min ISR — allows CDN caching unlike force-dynamic

export async function generateMetadata(): Promise<Metadata> {
  try {
    const stats = await loadPublicSiteStats()
    const description = buildHomeDescription(stats.totalJobs, stats.totalCompaniesHiring)
    const ogDescription =
      `${stats.totalJobs.toLocaleString()}+ six-figure jobs with salary shown upfront. ` +
      `Apply on the employer’s own page. $100k+ remote & on-site roles from ${stats.totalCompaniesHiring.toLocaleString()}+ companies.`

    return {
      title: 'Six Figure Jobs | Verified $100k+ Remote & On-Site Roles',
      description,
      keywords:
        '6 figure jobs, six figure jobs, 6 figure salary jobs, six-figure jobs, high paying jobs, easy 6 figure jobs, 6 figure remote jobs, 6 figure jobs no degree, 6 figure jobs without college degree, six-figure salary jobs, best 6 figure jobs',
      alternates: {
        canonical: getSiteUrl(),
      },
      openGraph: {
        title: 'Six Figure Jobs & High Paying $100k+ Positions',
        description: ogDescription,
        url: getSiteUrl(),
        siteName: '6FigJobs - Six Figure Jobs',
        type: 'website',
        images: [
          {
            url: `${getSiteUrl()}/og-image.png`,
            width: 1200,
            height: 630,
            alt: 'Six Figure Jobs - Find High Paying $100k+ Positions',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Six Figure Jobs | High Paying $100k+ Positions',
        description: `Find six-figure jobs with salaries. Explore ${stats.totalJobs.toLocaleString()}+ high-paying opportunities.`,
        images: [`${getSiteUrl()}/og-image.png`],
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
    }
  } catch {
    return {
      title: 'Six Figure Jobs | Verified $100k+ Remote & On-Site Roles',
      description:
        'Find $100k+ jobs with published salary ranges. Premium roles from verified companies.',
      alternates: {
        canonical: getSiteUrl(),
      },
    }
  }
}

const PAGE_SIZE = 80 // newest jobs fetched for the live feed and the market-balanced "Latest" list (lib/jobs/latestSelection.ts)
const SALARY_TIER_IDS: SalaryTierId[] = ['100k-plus', '200k-plus', '300k-plus', '400k-plus']

const PREMIUM_ROLE_DEFS = [
  { slug: 'software-engineer', name: 'Software Engineer', emoji: '💻' },
  { slug: 'product-manager', name: 'Product Manager', emoji: '🧭' },
  { slug: 'backend-engineer', name: 'Backend Engineer', emoji: '🖥️' },
  { slug: 'frontend-engineer', name: 'Frontend Engineer', emoji: '🎨' },
  { slug: 'devops-engineer', name: 'DevOps Engineer', emoji: '⚙️' },
  { slug: 'data-scientist', name: 'Data Scientist', emoji: '📊' },
  { slug: 'engineering-manager', name: 'Engineering Manager', emoji: '🧑‍💼' },
  { slug: 'staff-software-engineer', name: 'Staff Engineer', emoji: '🏆' },
] as const satisfies ReadonlyArray<{ slug: string; name: string; emoji: string }>

const TOP_LOCATION_DEFS = [
  { code: 'US', thresholdLabel: getThresholdLabelForCountry('US') },
  { code: 'GB', thresholdLabel: getThresholdLabelForCountry('GB') },
  { code: 'CA', thresholdLabel: getThresholdLabelForCountry('CA') },
  { code: 'DE', thresholdLabel: getThresholdLabelForCountry('DE') },
  { code: 'AU', thresholdLabel: getThresholdLabelForCountry('AU') },
  { code: 'NL', thresholdLabel: getThresholdLabelForCountry('NL') },
] as const satisfies ReadonlyArray<{ code: string; thresholdLabel: string }>

// Deduped, extended role list for the search dropdown
const ROLE_OPTIONS = (() => {
  const seen = new Set<string>()
  const result: typeof SEARCH_ROLE_OPTIONS = []
  for (const opt of SEARCH_ROLE_OPTIONS) {
    if (seen.has(opt.slug)) continue
    seen.add(opt.slug)
    result.push(opt)
  }
  return result
})()

function roleSlugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const REMOTE_REGIONS = [
  { value: '', label: 'Any remote region' },
  { value: 'global', label: 'Global' },
  { value: 'us-only', label: 'US only' },
  { value: 'canada', label: 'Canada' },
  { value: 'emea', label: 'EMEA' },
  { value: 'apac', label: 'APAC' },
  { value: 'uk-ireland', label: 'UK & Ireland' },
] as const

function HomepageSchemas({
  jobCount,
  companyCount,
}: {
  jobCount: number
  companyCount: number
}) {
  const siteUrl = getSiteUrl()

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: 'Six Figure Jobs',
    alternateName: ['6FigJobs', '6 Figure Jobs', 'SixFigJobs'],
    url: siteUrl,
    description:
      'The exclusive job board for six figure jobs and high paying $100k+ positions. ' +
      'Find lucrative careers with salaries.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: 'Six Figure Jobs',
    legalName: 'Six Figure Jobs LLC',
    alternateName: ['6FigJobs', '6 Figure Jobs'],
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: `Premium job board featuring ${jobCount.toLocaleString()}+ six figure jobs and high paying $100k+ positions from ${companyCount.toLocaleString()}+ top companies. The #1 destination for lucrative careers.`,
    foundingDate: '2025-12-05',
    sameAs: [
      'https://twitter.com/6figjobs',
      'https://linkedin.com/company/sixfigjobs',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'hello@6figjobs.com',
      availableLanguage: 'English',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
    </>
  )
}

function HomePageFallback() {
  return (
    <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-14 pt-10">
      <HomepageSchemas jobCount={0} companyCount={0} />

      <section className="rounded-3xl border border-border bg-card p-8 shadow-2xl shadow-slate-950/40">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Live data temporarily unavailable
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">
          Six Figure Jobs
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          The job feed is temporarily unavailable while the production database reconnects.
          Static pages remain live, and the next scrape will continue updating data once connectivity
          is restored.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/jobs"
            className="rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground"
          >
            Browse jobs
          </Link>
          <Link
            href="/remote"
            className="rounded-full border border-border px-5 py-2 text-foreground"
          >
            Remote jobs
          </Link>
          <Link
            href="/salary"
            className="rounded-full border border-border px-5 py-2 text-foreground"
          >
            Salary guides
          </Link>
          <Link
            href="/companies"
            className="rounded-full border border-border px-5 py-2 text-foreground"
          >
            Companies
          </Link>
        </div>
      </section>
    </main>
  )
}

function addAndClause(where: any, clause: any): any {
  return {
    ...where,
    AND: [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), clause],
  }
}

export default async function HomePage() {
  try {
    const stats = await loadPublicSiteStats()
    const publicJobWhere = stats.publicJobWhere
    const [
      jobsData,
      priorityCompanyCandidates,
      featuredCompanyGroups,
      salaryBandCounts,
      locationCounts,
      locationCityCounts,
      premiumRoleRows,
      salarySnapshot,
      siteCounts,
    ] = await Promise.all([
      queryJobs({
        isHundredKLocal: true,
        page: 1,
        pageSize: PAGE_SIZE,
        sortBy: 'date',
        excludeInternships: true,
      }),
      getPriorityPublishedCompanyCandidates(8),
      prisma.job.groupBy({
        by: ['companyId'],
        where: {
          ...publicJobWhere,
          companyId: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { companyId: 'desc' } },
        take: 20,
      }),
      // Each tier card counts exactly what its page lists (USD, by the top of the range), so the numbers match.
      Promise.all(
        SALARY_TIER_IDS.map(async (slug) => {
          const { total } = await queryJobs({ page: 1, pageSize: 1, ...tierQueryInput(slug) })
          return { slug, count: total }
        })
      ),
      prisma.job.groupBy({
        by: ['countryCode'],
        where: {
          ...publicJobWhere,
          countryCode: { in: TOP_LOCATION_DEFS.map((c) => c.code) },
        },
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ['countryCode', 'city'],
        where: {
          ...publicJobWhere,
          countryCode: { in: TOP_LOCATION_DEFS.map((c) => c.code) },
          city: { not: null },
          AND: [...(Array.isArray(publicJobWhere.AND) ? publicJobWhere.AND : publicJobWhere.AND ? [publicJobWhere.AND] : []), { city: { not: '' } }],
        },
        _count: { _all: true },
        orderBy: { _count: { countryCode: 'desc' } },
      }),
      prisma.$queryRaw<
        Array<{
          slug: string
          totalCount: bigint
          avgUsd: bigint | null
          last7: bigint
          prev7: bigint
        }>
      >((() => {
        const roleValues = PREMIUM_ROLE_DEFS.map((r) => Prisma.sql`(${r.slug})`)

        const currencyClauses = Object.entries(HIGH_SALARY_THRESHOLDS).map(
          ([currency, threshold]) =>
            Prisma.sql`("currency" = ${currency} AND ("minAnnual" >= ${threshold} OR "maxAnnual" >= ${threshold}))`,
        )

        const titleExclusions = [
          Prisma.sql`"title" ILIKE '%intern%'`,
          Prisma.sql`"title" ILIKE '%internship%'`,
          Prisma.sql`"title" ILIKE '%junior%'`,
          Prisma.sql`"title" ILIKE '% jr%'`,
          Prisma.sql`"title" ILIKE '%jr.%'`,
          Prisma.sql`"title" ILIKE '%entry%'`,
          Prisma.sql`"title" ILIKE '%entry level%'`,
          Prisma.sql`"title" ILIKE '%graduate%'`,
          Prisma.sql`"title" ILIKE '%new grad%'`,
          Prisma.sql`"title" ILIKE '%new graduate%'`,
          Prisma.sql`"title" ILIKE '%phd graduate%'`,
        ]

        return Prisma.sql`
        WITH roles("slug") AS (
          VALUES ${Prisma.join(roleValues)}
        ),
        eligible AS (
          SELECT
            "roleSlug",
            "currency",
            COALESCE("maxAnnual","minAnnual") AS "annual",
            "createdAt"
          FROM "Job"
          WHERE
            "isExpired" = false
            AND "salaryValidated" = true
            AND "salaryConfidence" >= ${HIGH_SALARY_MIN_CONFIDENCE}
            AND (${Prisma.join(currencyClauses, ' OR ')})
            AND COALESCE("maxAnnual","minAnnual") IS NOT NULL
            AND "roleSlug" IS NOT NULL
            AND NOT (${Prisma.join(titleExclusions, ' OR ')})
        ),
        matched AS (
          SELECT
            r."slug" AS "slug",
            e."currency" AS "currency",
            e."annual" AS "annual",
            e."createdAt" AS "createdAt"
          FROM roles r
          JOIN eligible e
            ON e."roleSlug" LIKE ('%' || r."slug" || '%')
        )
        SELECT
          "slug",
          COUNT(*)::bigint AS "totalCount",
          CAST(AVG(CASE WHEN "currency" = 'USD' THEN "annual" END) AS bigint) AS "avgUsd",
          SUM(CASE WHEN "createdAt" >= NOW() - interval '7 days' THEN 1 ELSE 0 END)::bigint AS "last7",
          SUM(CASE WHEN "createdAt" >= NOW() - interval '14 days' AND "createdAt" < NOW() - interval '7 days' THEN 1 ELSE 0 END)::bigint AS "prev7"
        FROM matched
        GROUP BY "slug";
      `
      })()),
      // A failure here only hides the salary card; the rest of the page still renders.
      loadSalarySnapshot(publicJobWhere).catch(() => null),
      // Jobs by country and job type, counted at most every hour; a failure only hides those rows.
      loadSiteCounts().catch(() => null),
    ])

    const featuredCompanyIds = featuredCompanyGroups
      .map((g) => g.companyId)
      .filter((id): id is string => typeof id === 'string')

    const priorityCompanySlugs = priorityCompanyCandidates.map((candidate) => candidate.slug)

    const featuredCompaniesRaw = featuredCompanyIds.length || priorityCompanySlugs.length
      ? await prisma.company.findMany({
          where: {
            OR: [
              ...(featuredCompanyIds.length ? [{ id: { in: featuredCompanyIds } }] : []),
              ...(priorityCompanySlugs.length ? [{ slug: { in: priorityCompanySlugs } }] : []),
            ],
          },
          select: { id: true, name: true, slug: true, logoUrl: true, website: true },
        })
      : []

  const featuredCompaniesById = new Map(featuredCompaniesRaw.map((c) => [c.id, c]))
  const featuredCompaniesBySlug = new Map(
    featuredCompaniesRaw
      .filter((c) => typeof c.slug === 'string')
      .map((c) => [c.slug as string, c] as const),
  )

  const priorityFeaturedCompanies: FeaturedCompany[] = priorityCompanyCandidates
    .map((candidate) => {
      const company = featuredCompaniesBySlug.get(candidate.slug)
      if (!company?.slug) return null
      return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logoUrl: company.logoUrl ?? null,
        website: company.website ?? null,
        activeHighPayingJobs: candidate.liveJobs,
      }
    })
    .filter((company): company is FeaturedCompany => Boolean(company))

  const volumeFeaturedCompanies: FeaturedCompany[] = featuredCompanyGroups
    .map((g) => {
      if (!g.companyId) return null
      const company = featuredCompaniesById.get(g.companyId)
      if (!company?.slug) return null
      return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logoUrl: company.logoUrl ?? null,
        website: company.website ?? null,
        activeHighPayingJobs: g._count._all,
      }
    })
    .filter((c): c is FeaturedCompany => Boolean(c))

  // Well-known employers first (a saved list), each only while it has live $100k+ jobs. A failure only drops them.
  const topCompaniesRaw = await prisma.company
    .findMany({
      where: { slug: { in: [...TOP_COMPANY_SLUGS] } },
      select: { id: true, name: true, slug: true, logoUrl: true, website: true },
    })
    .catch(() => [])
  const topCompanyJobCounts = topCompaniesRaw.length
    ? await prisma.job
        .groupBy({
          by: ['companyId'],
          where: { ...publicJobWhere, companyId: { in: topCompaniesRaw.map((c) => c.id) } },
          _count: { _all: true },
        })
        .catch(() => [])
    : []
  const topCompanyJobsById = new Map(topCompanyJobCounts.map((g) => [g.companyId, g._count._all]))
  const topCompanyBySlug = new Map(topCompaniesRaw.map((c) => [c.slug, c]))
  const topFeaturedCompanies: FeaturedCompany[] = TOP_COMPANY_SLUGS.flatMap((slug) => {
    const company = topCompanyBySlug.get(slug)
    const jobs = company ? topCompanyJobsById.get(company.id) ?? 0 : 0
    if (!company?.slug || jobs === 0) return []
    return [
      {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logoUrl: company.logoUrl ?? null,
        website: company.website ?? null,
        activeHighPayingJobs: jobs,
      },
    ]
  })

  const seenFeaturedCompanyIds = new Set<string>()
  const featuredCompanies: FeaturedCompany[] = [
    ...topFeaturedCompanies,
    ...priorityFeaturedCompanies,
    ...volumeFeaturedCompanies,
  ].filter((company) => {
    if (seenFeaturedCompanyIds.has(company.id)) return false
    seenFeaturedCompanyIds.add(company.id)
    return true
  })

  const jobs = jobsData.jobs as JobWithCompany[]
  const newestPostedAt = jobs[0]?.postedAt ?? jobs[0]?.createdAt ?? null

  // Live feed: the newest jobs we added (real data), rendered here and refreshed in the browser once a minute.
  const feedItems = buildFeedItems(jobs)
  const feedItemIds = new Set(feedItems.map((item) => item.id))
  const salaryTiers: SalaryTier[] = salaryBandCounts.map(({ slug, count }) => ({
    slug,
    label: SALARY_TIERS[slug].rangeLabel,
    count,
  }))

  const premiumRolesBySlug = new Map(
    premiumRoleRows.map((row) => [row.slug, row]),
  )

  const premiumRoles: PremiumRoleCard[] = PREMIUM_ROLE_DEFS.map((def) => {
    const row = premiumRolesBySlug.get(def.slug)
    const totalCount = row?.totalCount != null ? Number(row.totalCount) : 0
    const avgUsd = row?.avgUsd != null ? Number(row.avgUsd) : null
    const last7 = row?.last7 != null ? Number(row.last7) : 0
    const prev7 = row?.prev7 != null ? Number(row.prev7) : 0
    const trending = prev7 > 0 && last7 / prev7 > 1.1

    return {
      slug: def.slug,
      name: def.name,
      count: totalCount,
      avgUsdAnnual: avgUsd && Number.isFinite(avgUsd) ? avgUsd : null,
      trending,
    }
  })

  const locationCountsByCode = new Map(
    locationCounts
      .map((row) => [row.countryCode, row._count._all] as const)
      .filter((x): x is readonly [string, number] => typeof x[0] === 'string'),
  )

  const topCityByCode = new Map<string, string>()
  for (const row of locationCityCounts) {
    const code = row.countryCode
    if (!code || topCityByCode.has(code)) continue
    if (typeof row.city !== 'string' || !row.city.trim()) continue
    topCityByCode.set(code, row.city.trim())
  }

  const topLocations: TopLocationCard[] = TOP_LOCATION_DEFS.map((def) => {
    const slug = countryCodeToSlug(def.code) ?? def.code.toLowerCase()
    const name = TARGET_COUNTRIES.find((c) => c.code === def.code)?.label ?? slug
    return {
      slug,
      name,
      countryCode: def.code,
      thresholdLabel: def.thresholdLabel,
      jobCount: locationCountsByCode.get(def.code) ?? 0,
      topCity: topCityByCode.get(def.code) ?? null,
    }
  })

    return (
    <>
      <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-14 pt-10">
        <HomepageSchemas
          jobCount={stats.totalJobs}
          companyCount={stats.totalCompaniesHiring}
        />
      <Hero
        jobCount={stats.totalJobs}
        companyCount={stats.totalCompaniesHiring}
        newThisWeek={stats.newThisWeek}
        newestPostedAtISO={newestPostedAt ? newestPostedAt.toISOString() : null}
        salarySnapshot={salarySnapshot}
        siteCounts={siteCounts}
      >
        <HeroFilters
          roles={ROLE_OPTIONS.map((o) => ({ value: o.slug, label: o.label }))}
          locations={LOCATIONS.map((l) => ({ value: l.code, label: l.label }))}
          remoteRegions={REMOTE_REGIONS.map((r) => ({ value: r.value, label: r.label }))}
        />
      </Hero>

      <LiveJobFeed initialItems={feedItems} serverNow={new Date().toISOString()} />

      {/* Jobs already in the live feed above are left out, so no job appears twice with two different times. */}
      <LatestOpportunities jobs={jobs.filter((job) => !feedItemIds.has(job.id))} totalJobs={stats.totalJobs} />

      <FeaturedCompaniesCarousel companies={featuredCompanies} />

      <SiteStatsStrip
        jobs={stats.totalJobs}
        companies={stats.totalCompaniesHiring}
        newThisWeek={stats.newThisWeek}
        countries={siteCounts ? siteCounts.byCountry.filter((c) => c.count > 0).length : null}
        medianUsd={salarySnapshot?.median ?? null}
      />

      {priorityFeaturedCompanies.length > 0 && (
        <section className="mb-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Priority company pages
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Each company hub lists that employer&apos;s current $100k+ openings. Start with
            the employers that consistently show transparent high-salary demand.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {priorityFeaturedCompanies.map((company) => (
              <Link
                key={company.id}
                href={`/company/${company.slug}`}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-foreground/40"
              >
                {company.name} ({company.activeHighPayingJobs.toLocaleString()})
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Explore Six Figure Jobs by Role
        </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_LINKS.roles.map((role) => (
              <Link
                key={role.href}
                href={role.href}
                className="group inline-flex items-center gap-1.5 max-md:min-h-11 rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary hover:bg-card"
              >
                <span className="text-foreground group-hover:text-foreground">
                  {role.name}
                </span>
              </Link>
            ))}
          <Link
            href="/companies"
            className="inline-flex items-center gap-2 max-md:min-h-11 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/40"
          >
            Explore companies →
          </Link>
          <Link
            href="/remote"
            className="inline-flex items-center gap-2 max-md:min-h-11 rounded-full border border-primary bg-primary/10 px-4 py-2 text-sm text-foreground transition-colors hover:border-primary"
          >
            Remote $100k+ roles
          </Link>
        </div>
      </section>

      <div className="reveal-on-scroll">
        <TopLocations locations={topLocations} />
      </div>

      <section className="reveal-on-scroll mb-10">
        <BrowseBySalaryTier tiers={salaryTiers} />
      </section>

      <div className="reveal-on-scroll">
        <ExplorePremiumRoles roles={premiumRoles} />
      </div>

      <HomeFAQ />

      <section className="mt-16 border-t border-border pt-8">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
          Popular Six Figure Job Searches
        </h2>
        <div className="grid gap-x-8 gap-y-2 text-xs text-muted-foreground sm:grid-cols-2 md:grid-cols-4">
	          <div className="space-y-2">
	            <p className="font-medium text-foreground">By Role</p>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, roleSlugs: ['software-engineer'] })}
	              className="block hover:text-foreground"
	            >
	              Software Engineer Jobs ($100k+)
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, roleSlugs: ['senior-software-engineer'] })}
	              className="block hover:text-foreground"
	            >
	              Senior Engineer Jobs ($100k+)
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, roleSlugs: ['product-manager'] })}
	              className="block hover:text-foreground"
	            >
	              Product Manager Jobs ($100k+)
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, roleSlugs: ['data-engineer'] })}
	              className="block hover:text-foreground"
	            >
	              Data Engineer Jobs ($100k+)
	            </Link>
	          </div>
	          <div className="space-y-2">
	            <p className="font-medium text-foreground">By Location</p>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, countryCode: 'US' })}
	              className="block hover:text-foreground"
	            >
	              $100k+ Jobs in USA
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, countryCode: 'GB' })}
	              className="block hover:text-foreground"
	            >
	              £75k+/£100k+ Jobs in UK
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, countryCode: 'CA' })}
	              className="block hover:text-foreground"
	            >
	              $100k+/CA$ Jobs in Canada
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, remoteOnly: true })}
	              className="block hover:text-foreground"
	            >
	              Remote $100k+ Jobs
	            </Link>
	          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">By Salary Band</p>
            <Link href="/jobs/100k-plus" className="block hover:text-foreground">
              $100k+ Jobs
            </Link>
            <Link href="/jobs/200k-plus" className="block hover:text-foreground">
              $200k+ Jobs
            </Link>
            <Link href="/jobs/300k-plus" className="block hover:text-foreground">
              $300k+ Jobs
            </Link>
            <Link href="/jobs/400k-plus" className="block hover:text-foreground">
              $400k+ Jobs
            </Link>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Top Companies</p>
            <Link href="/company/stripe" className="block hover:text-foreground">
              Stripe Jobs
            </Link>
            <Link href="/company/anthropic" className="block hover:text-foreground">
              Anthropic Jobs
            </Link>
            <Link href="/company/airbnb" className="block hover:text-foreground">
              Airbnb Jobs
            </Link>
            <Link href="/company/mongodb" className="block hover:text-foreground">
              MongoDB Jobs
            </Link>
          </div>
        </div>
      </section>
    </main>
    </>
    )
  } catch (error) {
    unstable_rethrow(error)
    logRuntimeFallback('home.page', error)
    await skipPrerenderWhileBuilding()
    return <HomePageFallback />
  }
}
