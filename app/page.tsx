// app/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  queryJobs,
  type JobWithCompany,
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
  HIGH_SALARY_MIN_CONFIDENCE,
} from '../lib/jobs/queryJobs'
import { SEARCH_ROLE_OPTIONS } from '../lib/roles/searchRoles'
import { TARGET_COUNTRIES } from '../lib/seo/regions'
import { buildSliceCanonicalPath } from '../lib/seo/canonical'
import { HomeFAQ } from './pageFAQ'
import RoleTypeahead from './components/RoleTypeahead'
import { CATEGORY_LINKS } from '@/lib/constants/category-links'
import { LOCATIONS, SALARY_BANDS } from '@/lib/constants/homepage'
import { countryCodeToSlug } from '@/lib/seo/countrySlug'
import { Hero } from '@/components/home/Hero'
import {
  FeaturedCompaniesCarousel,
  type FeaturedCompany,
} from '@/components/home/FeaturedCompaniesCarousel'
import { LatestOpportunities } from '@/components/home/LatestOpportunities'
import { BrowseByRole } from '@/components/home/BrowseByRole'
import { BrowseBySalaryTier, type SalaryTier } from '@/components/home/BrowseBySalaryTier'
import {
  ExplorePremiumRoles,
  type PremiumRoleCard,
} from '@/components/home/ExplorePremiumRoles'
import { HIGH_SALARY_THRESHOLDS } from '@/lib/currency/thresholds'
import { TopLocations, type TopLocationCard } from '@/components/home/TopLocations'
import { WhySixFigureJobs } from '@/components/home/WhySixFigureJobs'

export const revalidate = 300 // 5min instead of 10min
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '6 Figure Jobs & Six Figure Jobs | High Paying $100k+ Positions Without Degree',
  description:
    'Find 5,945+ verified jobs paying $100k+ USD (or local equivalent). Premium roles from 333 verified companies. Updated daily.',
  keywords:
    '6 figure jobs, six figure jobs, 6 figure salary jobs, six-figure jobs, high paying jobs, easy 6 figure jobs, 6 figure remote jobs, 6 figure jobs no degree, 6 figure jobs without college degree, six-figure salary jobs, best 6 figure jobs',
  alternates: {
    canonical: 'https://www.6figjobs.com',
  },
  openGraph: {
    title: 'Six Figure Jobs & High Paying $100k+ Positions',
    description:
      'Find six-figure jobs and high-paying positions with verified $100k+ salaries. ' +
      'Explore 5,945+ premium opportunities from 333 verified companies.',
    url: 'https://www.6figjobs.com',
    siteName: '6FigJobs - Six Figure Jobs',
    type: 'website',
    images: [
      {
        url: 'https://www.6figjobs.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Six Figure Jobs - Find High Paying $100k+ Positions',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Six Figure Jobs | High Paying $100k+ Positions',
    description:
      'Find six-figure jobs with verified salaries. Explore 5,945+ high-paying opportunities.',
    images: ['https://www.6figjobs.com/og-image.png'],
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

const PAGE_SIZE = 40

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
  { code: 'US', flag: '🇺🇸', thresholdLabel: '$100k USD' },
  { code: 'GB', flag: '🇬🇧', thresholdLabel: '£80k GBP' },
  { code: 'CA', flag: '🇨🇦', thresholdLabel: '$100k CAD' },
  { code: 'DE', flag: '🇩🇪', thresholdLabel: '€90k EUR' },
  { code: 'AU', flag: '🇦🇺', thresholdLabel: '$150k AUD' },
  { code: 'NL', flag: '🇳🇱', thresholdLabel: '€85k EUR' },
] as const satisfies ReadonlyArray<{ code: string; flag: string; thresholdLabel: string }>

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
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Six Figure Jobs',
    alternateName: ['6FigJobs', '6 Figure Jobs', 'SixFigJobs'],
    url: 'https://www.6figjobs.com',
    description:
      'The exclusive job board for six figure jobs and high paying $100k+ positions. ' +
      'Find lucrative careers with verified salaries.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://www.6figjobs.com/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Six Figure Jobs',
    legalName: 'Six Figure Jobs LLC',
    alternateName: ['6FigJobs', '6 Figure Jobs'],
    url: 'https://www.6figjobs.com',
    logo: 'https://www.6figjobs.com/logo.png',
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

export default async function HomePage() {
  const [
    jobsData,
    totalJobs,
    totalCompanies,
    featuredCompanyGroups,
    salaryBandCounts,
    locationCounts,
    locationCityCounts,
    premiumRoleRows,
    schemaTotalJobs,
    schemaTotalCompanies,
    schemaNewThisWeek,
    topRoles,
  ] = await Promise.all([
    queryJobs({
      isHundredKLocal: true, // Use PPP-adjusted threshold
      page: 1,
      pageSize: PAGE_SIZE,
      sortBy: 'date',
      excludeInternships: true,
    }),
    prisma.job.count({
      where: {
        isExpired: false,
        OR: [
          { minAnnual: { gte: BigInt(100_000) } },
          { maxAnnual: { gte: BigInt(100_000) } },
          { isHundredKLocal: true },
        ],
      },
    }),
    prisma.company.count({
      where: {
        jobs: {
          some: {
            isExpired: false,
            OR: [{ minAnnual: { gte: BigInt(100_000) } }, { isHundredKLocal: true }],
          },
        },
      },
    }),
    prisma.job.groupBy({
      by: ['companyId'],
      where: {
        companyId: { not: null },
        isExpired: false,
        AND: [buildHighSalaryEligibilityWhere(), buildGlobalExclusionsWhere()],
      },
      _count: { _all: true },
      orderBy: { _count: { companyId: 'desc' } },
      take: 20,
    }),
    Promise.all(
      SALARY_BANDS.map(async (band) => {
        const count = await prisma.job.count({
          where: {
            isExpired: false,
            AND: [
              buildHighSalaryEligibilityWhere(),
              buildGlobalExclusionsWhere(),
              {
                OR: [
                  { maxAnnual: { gte: BigInt(band.min) } },
                  { minAnnual: { gte: BigInt(band.min) } },
                ],
              },
            ],
          },
        })

        return { ...band, count }
      })
    ),
    prisma.job.groupBy({
      by: ['countryCode'],
      where: {
        isExpired: false,
        countryCode: { in: TOP_LOCATION_DEFS.map((c) => c.code) },
        AND: [buildHighSalaryEligibilityWhere(), buildGlobalExclusionsWhere()],
      },
      _count: { _all: true },
    }),
    prisma.job.groupBy({
      by: ['countryCode', 'city'],
      where: {
        isExpired: false,
        countryCode: { in: TOP_LOCATION_DEFS.map((c) => c.code) },
        city: { not: null },
        AND: [
          buildHighSalaryEligibilityWhere(),
          buildGlobalExclusionsWhere(),
          { city: { not: '' } },
        ],
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
    prisma.job.count({
      where: { isExpired: false, AND: [buildHighSalaryEligibilityWhere(), buildGlobalExclusionsWhere()] },
    }),
    prisma.company.count(),
    prisma.job.count({
      where: {
        isExpired: false,
        AND: [buildHighSalaryEligibilityWhere(), buildGlobalExclusionsWhere()],
        postedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.job.groupBy({
      by: ['roleSlug'],
      where: {
        isExpired: false,
        ...buildHighSalaryEligibilityWhere(),
      },
      _count: { _all: true },
      orderBy: { _count: { roleSlug: 'desc' } },
      take: 12,
    }),
  ])

  const stats = {
    totalJobs: schemaTotalJobs,
    totalCompanies: schemaTotalCompanies,
    newThisWeek: schemaNewThisWeek,
  }

  const roleCards = topRoles
    .filter((r) => r.roleSlug)
    .map((r) => ({
      slug: r.roleSlug!,
      name: roleSlugToName(r.roleSlug!),
      count: r._count._all,
    }))

  const featuredCompanyIds = featuredCompanyGroups
    .map((g) => g.companyId)
    .filter((id): id is string => typeof id === 'string')

  const featuredCompaniesRaw = featuredCompanyIds.length
    ? await prisma.company.findMany({
        where: { id: { in: featuredCompanyIds } },
        select: { id: true, name: true, slug: true, logoUrl: true },
      })
    : []

  const featuredCompaniesById = new Map(featuredCompaniesRaw.map((c) => [c.id, c]))

  const featuredCompanies: FeaturedCompany[] = featuredCompanyGroups
    .map((g) => {
      if (!g.companyId) return null
      const company = featuredCompaniesById.get(g.companyId)
      if (!company?.slug) return null
      return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logoUrl: company.logoUrl ?? null,
        activeHighPayingJobs: g._count._all,
      }
    })
    .filter((c): c is FeaturedCompany => Boolean(c))

  const jobs = jobsData.jobs as JobWithCompany[]
  const salaryTiers: SalaryTier[] = [
    {
      slug: '100k-plus',
      label: '$100k+',
      count: salaryBandCounts.find((b) => b.slug === '100k-plus')?.count ?? 0,
      icon: '💰',
    },
    {
      slug: '200k-plus',
      label: '$200k+',
      count: salaryBandCounts.find((b) => b.slug === '200k-plus')?.count ?? 0,
      icon: '💎',
    },
    {
      slug: '300k-plus',
      label: '$300k+',
      count: salaryBandCounts.find((b) => b.slug === '300k-plus')?.count ?? 0,
      icon: '🏆',
    },
    {
      slug: '400k-plus',
      label: '$400k+',
      count: salaryBandCounts.find((b) => b.slug === '400k-plus')?.count ?? 0,
      icon: '👑',
    },
  ]

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
      emoji: def.emoji,
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
      flag: def.flag,
      thresholdLabel: def.thresholdLabel,
      jobCount: locationCountsByCode.get(def.code) ?? 0,
      topCity: topCityByCode.get(def.code) ?? null,
    }
  })

  return (
    <main className="mx-auto max-w-6xl px-4 pb-14 pt-10">
      <HomepageSchemas
        jobCount={stats.totalJobs}
        companyCount={stats.totalCompanies}
      />
      <Hero
        jobCount={totalJobs}
        companyCount={totalCompanies}
        countryCount={TARGET_COUNTRIES.length}
        newThisWeek={stats.newThisWeek}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="role"
              className="mb-1.5 block text-[11px] font-medium text-slate-400"
            >
              Role
            </label>
            <RoleTypeahead
              options={ROLE_OPTIONS}
              name="role"
              placeholder="Start typing a $100k+ role…"
            />
          </div>

          <div>
            <label
              htmlFor="location"
              className="mb-1.5 block text-[11px] font-medium text-slate-400"
            >
              Location
            </label>
            <select
              id="location"
              name="location"
              className="focus-ring w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">All locations</option>
              {LOCATIONS.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.flag} {loc.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="remoteMode"
              className="mb-1.5 block text-[11px] font-medium text-slate-400"
            >
              Work arrangement
            </label>
            <select
              id="remoteMode"
              name="remoteMode"
              className="focus-ring w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Any</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="remoteRegion"
              className="mb-1.5 block text-[11px] font-medium text-slate-400"
            >
              Remote region
            </label>
            <select
              id="remoteRegion"
              name="remoteRegion"
              className="focus-ring w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            >
              {REMOTE_REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="salary"
              className="mb-1.5 block text-[11px] font-medium text-slate-400"
            >
              Minimum Salary
            </label>
            <select
              id="salary"
              name="minSalary"
              className="focus-ring w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              defaultValue="100000"
            >
              <option value="100000">$100k+</option>
              <option value="200000">$200k+</option>
              <option value="300000">$300k+</option>
              <option value="400000">$400k+</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href="/jobs/100k-plus"
            className="focus-ring inline-flex w-full items-center justify-center rounded-xl border border-slate-700/80 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/5 sm:w-auto"
          >
            Explore $100k+ opportunities
          </Link>
        </div>

        <div className="mt-2 text-xs text-slate-400">
          AI search tips: Try “remote $100k engineer”, “$200k staff roles”, or “no-degree $100k
          jobs” to see curated results.
        </div>
      </Hero>

      <FeaturedCompaniesCarousel companies={featuredCompanies} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          Explore Six Figure Jobs by Role
        </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_LINKS.roles.map((role) => (
              <Link
                key={role.href}
                href={role.href}
                className="group inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-4 py-2 text-sm transition-colors hover:border-slate-600 hover:bg-slate-900"
              >
                <span className="text-slate-200 group-hover:text-white">
                  {role.name}
                </span>
              </Link>
            ))}
          <Link
            href="/companies"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500"
          >
            🏢 Explore companies →
          </Link>
          <Link
            href="/jobs/location/remote"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-sm text-emerald-200 transition-colors hover:border-emerald-500"
          >
            🌍 Remote $100k+ roles
          </Link>
        </div>
      </section>

      <TopLocations locations={topLocations} />

      <section className="mb-10">
        <BrowseBySalaryTier tiers={salaryTiers} />
      </section>

      <ExplorePremiumRoles roles={premiumRoles} />

      <WhySixFigureJobs />

      <LatestOpportunities jobs={jobs} totalJobs={totalJobs} />

      <BrowseByRole roles={roleCards} />

      <HomeFAQ />

      <section className="mt-16 border-t border-slate-800 pt-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-400">
          Popular Six Figure Job Searches
        </h2>
        <div className="grid gap-x-8 gap-y-2 text-xs text-slate-500 sm:grid-cols-2 md:grid-cols-4">
	          <div className="space-y-2">
	            <p className="font-medium text-slate-400">By Role</p>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, roleSlugs: ['software-engineer'] })}
	              className="block hover:text-slate-300"
	            >
	              Software Engineer Jobs ($100k+)
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, roleSlugs: ['senior-software-engineer'] })}
	              className="block hover:text-slate-300"
	            >
	              Senior Engineer Jobs ($100k+)
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, roleSlugs: ['product-manager'] })}
	              className="block hover:text-slate-300"
	            >
	              Product Manager Jobs ($100k+)
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, roleSlugs: ['data-engineer'] })}
	              className="block hover:text-slate-300"
	            >
	              Data Engineer Jobs ($100k+)
	            </Link>
	          </div>
	          <div className="space-y-2">
	            <p className="font-medium text-slate-400">By Location</p>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, countryCode: 'US' })}
	              className="block hover:text-slate-300"
	            >
	              $100k+ Jobs in USA
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, countryCode: 'GB' })}
	              className="block hover:text-slate-300"
	            >
	              £75k+/£100k+ Jobs in UK
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, countryCode: 'CA' })}
	              className="block hover:text-slate-300"
	            >
	              $100k+/CA$ Jobs in Canada
	            </Link>
	            <Link
	              href={buildSliceCanonicalPath({ isHundredKLocal: true, remoteOnly: true })}
	              className="block hover:text-slate-300"
	            >
	              Remote $100k+ Jobs
	            </Link>
	          </div>
          <div className="space-y-2">
            <p className="font-medium text-slate-400">By Salary Band</p>
            <Link href="/jobs/100k-plus" className="block hover:text-slate-300">
              $100k+ Jobs
            </Link>
            <Link href="/jobs/200k-plus" className="block hover:text-slate-300">
              $200k+ Jobs
            </Link>
            <Link href="/jobs/300k-plus" className="block hover:text-slate-300">
              $300k+ Jobs
            </Link>
            <Link href="/jobs/400k-plus" className="block hover:text-slate-300">
              $400k+ Jobs
            </Link>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-slate-400">Top Companies</p>
            <Link href="/company/stripe" className="block hover:text-slate-300">
              Stripe Jobs
            </Link>
            <Link href="/company/anthropic" className="block hover:text-slate-300">
              Anthropic Jobs
            </Link>
            <Link href="/company/airbnb" className="block hover:text-slate-300">
              Airbnb Jobs
            </Link>
            <Link href="/company/mongodb" className="block hover:text-slate-300">
              MongoDB Jobs
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
