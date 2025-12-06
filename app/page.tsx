// app/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '../lib/prisma'
import { queryJobs, type JobWithCompany } from '../lib/jobs/queryJobs'
import JobList from './components/JobList'
import { buildJobsPath } from '../lib/jobs/searchSlug'
import { SEARCH_ROLE_OPTIONS } from '../lib/roles/searchRoles'
import { TARGET_COUNTRIES } from '../lib/seo/regions'
import { HomeFAQ } from './pageFAQ'
import RoleTypeahead from './components/RoleTypeahead'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Verified $100k+ Remote & Hybrid Tech Jobs | Six Figure Jobs',
  description:
    'Only verified $100k+ (or local equivalent) tech roles from ATS and trusted boards. Remote, hybrid, and on-site openings across engineering, product, data, design, and more. Updated daily.',
  openGraph: {
    title: 'Verified $100k+ Remote & Hybrid Tech Jobs | Six Figure Jobs',
    description:
      'Curated high-salary tech jobs from top companies. No lowball ranges, no spam.',
    type: 'website',
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

export const CATEGORY_LINKS = [
  { href: '/jobs/category/engineering', label: 'Engineering', emoji: '💻' },
  { href: '/jobs/category/product', label: 'Product', emoji: '🧭' },
  { href: '/jobs/category/data', label: 'Data', emoji: '📊' },
  { href: '/jobs/category/design', label: 'Design', emoji: '🎨' },
  { href: '/jobs/category/devops', label: 'DevOps', emoji: '⚙️' },
  { href: '/jobs/category/mlai', label: 'ML / AI', emoji: '🤖' },
  { href: '/jobs/category/sales', label: 'Sales', emoji: '💼' },
  { href: '/jobs/category/marketing', label: 'Marketing', emoji: '📣' },
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

export const LOCATIONS = [
  { code: 'united-states', label: 'United States', flag: '🇺🇸' },
  { code: 'united-kingdom', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'canada', label: 'Canada', flag: '🇨🇦' },
  { code: 'germany', label: 'Germany', flag: '🇩🇪' },
  { code: 'ireland', label: 'Ireland', flag: '🇮🇪' },
  { code: 'switzerland', label: 'Switzerland', flag: '🇨🇭' },
  { code: 'singapore', label: 'Singapore', flag: '🇸🇬' },
  { code: 'australia', label: 'Australia', flag: '🇦🇺' },
  { code: 'new-zealand', label: 'New Zealand', flag: '🇳🇿' },
  { code: 'remote', label: 'Remote Only', flag: '🌍' },
] as const

const REMOTE_REGIONS = [
  { value: '', label: 'Any remote region' },
  { value: 'global', label: 'Global' },
  { value: 'us-only', label: 'US only' },
  { value: 'canada', label: 'Canada' },
  { value: 'emea', label: 'EMEA' },
  { value: 'apac', label: 'APAC' },
  { value: 'uk-ireland', label: 'UK & Ireland' },
] as const

export const SALARY_BANDS = [
  {
    min: 100_000,
    label: '$100k+',
    slug: '100k-plus',
    description: 'Entry to mid-level high-salary roles',
  },
  {
    min: 200_000,
    label: '$200k+',
    slug: '200k-plus',
    description: 'Senior & staff-level positions',
  },
  {
    min: 300_000,
    label: '$300k+',
    slug: '300k-plus',
    description: 'Principal & lead roles',
  },
  {
    min: 400_000,
    label: '$400k+',
    slug: '400k-plus',
    description: 'Executive & top-comp band',
  },
] as const

export default async function HomePage() {
  const [jobsData, totalJobs, totalCompanies, salaryBandCounts, roleCounts] =
    await Promise.all([
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
          OR: [
            { maxAnnual: { gte: BigInt(100_000) } },
            { minAnnual: { gte: BigInt(100_000) } },
            { isHighSalary: true },
            { isHundredKLocal: true },
          ],
        },
      }),
      prisma.company.count({
        where: {
          jobs: {
            some: {
              isExpired: false,
              OR: [
                { maxAnnual: { gte: BigInt(100_000) } },
                { minAnnual: { gte: BigInt(100_000) } },
                { isHighSalary: true },
                { isHundredKLocal: true },
              ],
            },
          },
        },
      }),
      // UPDATED: make 100k+ band use isHighSalary / isHundredKLocal as well,
      // so it matches QA + our currency-aware thresholds.
      Promise.all(
        SALARY_BANDS.map(async (band) => {
          let count: number

          if (band.min === 100_000) {
            // $100k+ band: treat as "high-salary" in any local currency
            count = await prisma.job.count({
              where: {
                isExpired: false,
                OR: [
                  { isHighSalary: true },
                  { isHundredKLocal: true },
                  { maxAnnual: { gte: BigInt(100_000) } },
                  { minAnnual: { gte: BigInt(100_000) } },
                ],
              },
            })
          } else {
            // Higher bands rely on normalized annual fields
            count = await prisma.job.count({
              where: {
                isExpired: false,
                OR: [
                  { maxAnnual: { gte: BigInt(band.min) } },
                  { minAnnual: { gte: BigInt(band.min) } },
                ],
              },
            })
          }

          return { ...band, count }
        }),
      ),
      Promise.all(
        ROLE_CATEGORIES.map(async (role) => ({
          ...role,
          count: await prisma.job.count({
            where: {
              isExpired: false,
              isHighSalary: true,
              roleSlug: { contains: role.slug },
            },
          }),
        })),
      ),
    ])

  const jobs = jobsData.jobs as JobWithCompany[]

  return (
    <main className="mx-auto max-w-6xl px-4 pb-14 pt-10">
      <section className="mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
          CURATED JOBS PAYING $100K+ ONLY
        </p>

        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-50 md:text-[3.2rem] lg:text-[3.4rem]">
              Find remote &amp; hybrid tech jobs paying $100k+ 💰
            </h1>
            <p className="text-[15px] leading-relaxed text-slate-200 md:text-base">
              Six Figure Jobs surfaces verified six-figure roles directly from ATS-powered company job boards. AI-ranked and human-reviewed—no lowball ranges, no spam. Remote, hybrid, and on-site roles across engineering, product, data, design, and more.
            </p>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-lg shadow-slate-900/60">
              <form action="/search" method="get" className="space-y-4">
                <div>
                  <label
                    htmlFor="q"
                    className="mb-1.5 block text-[11px] font-medium text-slate-400"
                  >
                    Search jobs
                  </label>
                  <input
                    id="q"
                    name="q"
                    type="text"
                    placeholder="e.g. Senior ML Engineer, Stripe, React..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
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
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
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
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
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
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="100000">$100k+</option>
                      <option value="200000">$200k+</option>
                      <option value="300000">$300k+</option>
                      <option value="400000">$400k+</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 sm:w-auto"
                >
                  Search $100k+ jobs
                </button>

                <div className="text-xs text-slate-400">
                  AI search tips: Try “remote $100k engineer”, “$200k staff roles”, or “no-degree $100k jobs” to see curated results.
                </div>
              </form>
            </div>
          </div>

          <div className="w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Live on Six Figure Jobs
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-400">$100k+ jobs</span>
                <span className="text-xl font-bold text-slate-50">
                  {totalJobs.toLocaleString()}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-400">Companies</span>
                <span className="text-xl font-bold text-slate-50">
                  {totalCompanies.toLocaleString()}
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
          Browse by role
        </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_LINKS.map((role) => (
              <Link
                key={role.href}
                href={role.href}
                className="group inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-4 py-2 text-sm transition-colors hover:border-slate-600 hover:bg-slate-900"
              >
                <span>{role.emoji}</span>
                <span className="text-slate-200 group-hover:text-white">
                  {role.label}
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
          Browse by location
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
            Explore by salary
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
            Latest $100k+ jobs
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
          Popular $100k+ searches (remote, hybrid, on-site)
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
