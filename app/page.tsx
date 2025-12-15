// app/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '../lib/prisma'
import {
  queryJobs,
  type JobWithCompany,
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
} from '../lib/jobs/queryJobs'
import JobList from './components/JobList'
import { buildJobsPath } from '../lib/jobs/searchSlug'
import { SEARCH_ROLE_OPTIONS } from '../lib/roles/searchRoles'
import { TARGET_COUNTRIES } from '../lib/seo/regions'
import { HomeFAQ } from './pageFAQ'
import RoleTypeahead from './components/RoleTypeahead'
import { CATEGORY_LINKS } from '@/lib/constants/category-links'
import { LOCATIONS, SALARY_BANDS } from '@/lib/constants/homepage'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Six Figure Jobs | 6 Figure Jobs & High Paying $100k+ Positions | 6FigJobs',
  description:
    'Find six figure jobs and 6 figure jobs paying $100k+ with verified salaries. ' +
    'Browse 21,000+ high paying jobs from top companies. The #1 job board for ' +
    'lucrative, well-paying positions. Updated daily.',
  keywords:
    'six figure jobs, 6 figure jobs, high paying jobs, $100k jobs, 100k jobs, ' +
    'six figure salary, high paying careers, lucrative jobs, well paying jobs, ' +
    '$100k+ jobs, six figure positions, high salary jobs',
  alternates: {
    canonical: 'https://www.6figjobs.com',
  },
  openGraph: {
    title: 'Six Figure Jobs & High Paying $100k+ Positions',
    description:
      'Find 6 figure jobs and high paying positions with verified $100k+ salaries. ' +
      '21,000+ lucrative jobs from top companies.',
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
      'Find 6 figure jobs with verified salaries. 21,000+ high paying positions.',
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

const ROLE_CATEGORIES = [
  { slug: 'software-engineer', label: 'Engineering', emoji: '💻', color: 'blue' },
  { slug: 'product-manager', label: 'Product', emoji: '🧭', color: 'purple' },
  { slug: 'data-engineer', label: 'Data', emoji: '📊', color: 'green' },
  { slug: 'designer', label: 'Design', emoji: '🎨', color: 'pink' },
  { slug: 'devops', label: 'DevOps', emoji: '⚙️', color: 'orange' },
  { slug: 'machine-learning', label: 'ML / AI', emoji: '🤖', color: 'cyan' },
  { slug: 'sales', label: 'Sales', emoji: '💼', color: 'yellow' },
  { slug: 'marketing', label: 'Marketing', emoji: '📣', color: 'red' },
] as const

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
    salaryBandCounts,
    roleCounts,
    schemaTotalJobs,
    schemaTotalCompanies,
    schemaNewThisWeek,
  ] = await Promise.all([
    queryJobs({
      minAnnual: 100_000,
      page: 1,
      pageSize: PAGE_SIZE,
      sortBy: 'date', // newest first
      excludeInternships: true, // explicit
    }),
    prisma.job.count({
      where: {
        isExpired: false,
        AND: [buildHighSalaryEligibilityWhere(), buildGlobalExclusionsWhere()],
      },
    }),
    prisma.company.count({
      where: {
        jobs: {
          some: {
            isExpired: false,
            AND: [buildHighSalaryEligibilityWhere(), buildGlobalExclusionsWhere()],
          },
        },
      },
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
    Promise.all(
      ROLE_CATEGORIES.map(async (role) => ({
        ...role,
        count: await prisma.job.count({
          where: {
            isExpired: false,
            AND: [buildHighSalaryEligibilityWhere(), buildGlobalExclusionsWhere()],
            roleSlug: { contains: role.slug },
          },
        }),
      }))
    ),
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
  ])

  const stats = {
    totalJobs: schemaTotalJobs,
    totalCompanies: schemaTotalCompanies,
    newThisWeek: schemaNewThisWeek,
  }

  const jobs = jobsData.jobs as JobWithCompany[]

  return (
    <main className="mx-auto max-w-6xl px-4 pb-14 pt-10">
      <HomepageSchemas
        jobCount={stats.totalJobs}
        companyCount={stats.totalCompanies}
      />
      <section className="premium-gradient soft-shadow mb-12 rounded-3xl border border-slate-800/70 bg-slate-950/40 p-6 md:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
          THE #1 JOB BOARD FOR SIX FIGURE & HIGH PAYING POSITIONS
        </p>

        <div className="mt-5 flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-5">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-50 md:text-[3.2rem] lg:text-[3.4rem]">
              Find <span className="text-emerald-300">Six Figure Jobs</span> &{' '}
              High Paying <span className="text-emerald-300">$100k+</span>{' '}
              Careers
            </h1>
            <p className="text-lg leading-relaxed text-slate-200 md:text-xl">
              Browse <strong>{totalJobs.toLocaleString()}</strong> six figure jobs and 6 figure jobs
              with verified high paying salaries from $100k to $500k+.
              Find lucrative, well-paying positions at top companies.
            </p>
            <p className="text-sm leading-relaxed text-slate-400 md:text-base">
              Curated high paying careers from real company postings.
              Only six figure salary positions. Updated daily.
            </p>
            <p className="text-xs text-slate-400">
              ✅ Verified six figure salaries • 🛡️ No entry-level jobs • ↗️ Direct company applications
            </p>

            <div className="surface soft-shadow p-5">
              <form action="/search" method="get" className="space-y-4">
                <div>
                  <label
                    htmlFor="q"
                    className="mb-1.5 block text-[11px] font-medium text-slate-400"
                  >
                    Search six figure jobs & high paying positions
                  </label>
                  <input
                    id="q"
                    name="q"
                    type="text"
                    placeholder="e.g. Senior ML Engineer, Stripe, React..."
                    className="focus-ring w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                  />
                </div>

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
                    >
                      <option value="100000">$100k+</option>
                      <option value="200000">$200k+</option>
                      <option value="300000">$300k+</option>
                      <option value="400000">$400k+</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    className="focus-ring inline-flex w-full items-center justify-center rounded-xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_40px_rgba(16,185,129,0.22)] transition hover:bg-emerald-300 sm:w-auto"
                  >
                    Find My Six Figure Job
                  </button>

                  <Link
                    href="/jobs/100k-plus"
                    className="focus-ring inline-flex w-full items-center justify-center rounded-xl border border-slate-700/80 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/5 sm:w-auto"
                  >
                    Browse premium roles
                  </Link>
                </div>

                <div className="text-xs text-slate-400">
                  AI search tips: Try “remote $100k engineer”, “$200k staff roles”, or “no-degree $100k jobs” to see curated results.
                </div>
              </form>
            </div>
          </div>

          <div className="surface w-full max-w-xs p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Live Six Figure Jobs Stats
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-400">Six figure jobs</span>
                <span className="text-xl font-bold text-slate-50">
                  {totalJobs.toLocaleString()}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-400">High paying companies</span>
                <span className="text-xl font-bold text-slate-50">
                  {totalCompanies.toLocaleString()}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-400">New this week</span>
                <span className="text-xl font-bold text-emerald-300">
                  {stats.newThisWeek.toLocaleString()}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-400">Updated</span>
                <span className="text-sm font-medium text-emerald-400">
                  Daily
                </span>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-800 pt-4">
              <p className="text-[11px] leading-relaxed text-slate-500">
                Jobs are pulled directly from company ATS feeds, deduped, and
                ranked by salary.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          Browse Six Figure Jobs by Role
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
            🏢 Browse companies →
          </Link>
          <Link
            href="/jobs/location/remote"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-sm text-emerald-200 transition-colors hover:border-emerald-500"
          >
            🌍 Remote $100k+ roles
          </Link>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          High Paying Jobs by Location
        </h2>
        <div className="flex flex-wrap gap-2">
          {LOCATIONS.map((loc) => (
            <Link
              key={loc.code}
              href={
                loc.code === 'remote'
                  ? '/jobs/location/remote'
                  : `/jobs/location/${loc.code}`
              }
              className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-4 py-2 text-sm transition-colors hover:border-slate-600 hover:bg-slate-900"
            >
              <span>{loc.flag}</span>
              <span className="text-slate-200">{loc.label}</span>
            </Link>
          ))}
          {/* Salary band quick links */}
          <Link
            href="/jobs/location/united-states?min=200000"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-sm text-emerald-200 transition-colors hover:border-emerald-500"
          >
            🇺🇸 $200k+ in US
          </Link>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-50">
            Explore Six Figure Salaries
          </h2>
          <Link
            href={buildJobsPath({ salaryMin: 100_000 })}
            className="text-[11px] text-blue-400 hover:underline"
          >
            View all jobs →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {salaryBandCounts.map((band, idx) => (
            <Link
              key={band.slug}
              href={buildJobsPath({ salaryMin: band.min })}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5 transition-all hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/50"
            >
              <div
                className={`absolute inset-0 opacity-10 ${
                  idx === 0
                    ? 'bg-gradient-to-br from-emerald-500 to-transparent'
                    : idx === 1
                    ? 'bg-gradient-to-br from-blue-500 to-transparent'
                    : idx === 2
                    ? 'bg-gradient-to-br from-purple-500 to-transparent'
                    : 'bg-gradient-to-br from-amber-500 to-transparent'
                }`}
              />

              <div className="relative">
                <p
                  className={`text-2xl font-bold ${
                    idx === 0
                      ? 'text-emerald-400'
                      : idx === 1
                      ? 'text-blue-400'
                      : idx === 2
                      ? 'text-purple-400'
                      : 'text-amber-400'
                  }`}
                >
                  {band.label}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {band.description}
                </p>
                <p className="mt-3 text-lg font-semibold text-slate-100">
                  {band.count.toLocaleString()}
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    jobs
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-50">
            Latest High Paying $100k+ Jobs
          </h2>
          <p className="text-[11px] text-slate-400">
            Showing{' '}
            <span className="font-semibold text-slate-200">
              {jobs.length}
            </span>{' '}
            most recent roles
          </p>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center">
            <p className="text-slate-400">
              No jobs found. Scrapers may still be running.
            </p>
          </div>
        ) : (
          <JobList jobs={jobs} />
        )}

        {jobs.length >= PAGE_SIZE && (
          <div className="pt-4 text-center">
            <Link
              href={buildJobsPath({ salaryMin: 100_000 })}
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-6 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800"
            >
              View all {totalJobs.toLocaleString()} jobs →
            </Link>
          </div>
        )}
      </section>

      <HomeFAQ />

      <section className="mt-16 border-t border-slate-800 pt-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-400">
          Popular Six Figure Job Searches
        </h2>
        <div className="grid gap-x-8 gap-y-2 text-xs text-slate-500 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-2">
            <p className="font-medium text-slate-400">By Role</p>
            <Link href="/jobs/software-engineer/100k-plus" className="block hover:text-slate-300">
              Software Engineer Jobs ($100k+)
            </Link>
            <Link href="/jobs/senior-software-engineer/100k-plus" className="block hover:text-slate-300">
              Senior Engineer Jobs ($100k+)
            </Link>
            <Link href="/jobs/product-manager/100k-plus" className="block hover:text-slate-300">
              Product Manager Jobs ($100k+)
            </Link>
            <Link href="/jobs/data-engineer/100k-plus" className="block hover:text-slate-300">
              Data Engineer Jobs ($100k+)
            </Link>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-slate-400">By Location</p>
            <Link href="/jobs/us/100k-plus" className="block hover:text-slate-300">
              $100k+ Jobs in USA
            </Link>
            <Link href="/jobs/gb/100k-plus" className="block hover:text-slate-300">
              £75k+/£100k+ Jobs in UK
            </Link>
            <Link href="/jobs/ca/100k-plus" className="block hover:text-slate-300">
              $100k+/CA$ Jobs in Canada
            </Link>
            <Link href="/jobs/remote/100k-plus" className="block hover:text-slate-300">
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
