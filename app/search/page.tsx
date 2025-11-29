// app/search/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '../../lib/prisma'
import type { JobWithCompany } from '../../lib/jobs/queryJobs'
import JobList from '../components/JobList'

export const dynamic = "force-dynamic"

const PAGE_SIZE = 40

type SearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function resolveSearchParams(
  input?: SearchParams | Promise<SearchParams>
): Promise<SearchParams> {
  if (!input) return {}
  if (typeof (input as any).then === 'function') {
    return (input as Promise<SearchParams>) || {}
  }
  return input as SearchParams
}

function getParam(sp: SearchParams, key: string): string | undefined {
  const value = sp[key]
  if (Array.isArray(value)) return value[0]
  return value
}

function buildSearchHref(sp: SearchParams, page: number): string {
  const params = new URLSearchParams()

  const q = getParam(sp, 'q')
  const role = getParam(sp, 'role')
  const location = getParam(sp, 'location')
  const minSalary = getParam(sp, 'minSalary')

  if (q) params.set('q', q)
  if (role) params.set('role', role)
  if (location) params.set('location', location)
  if (minSalary) params.set('minSalary', minSalary)
  if (page > 1) params.set('page', String(page))

  const qs = params.toString()
  return qs ? `/search?${qs}` : '/search'
}

function buildTitle(sp: SearchParams): string {
  const q = getParam(sp, 'q')
  const location = getParam(sp, 'location')
  const minSalary = Number(getParam(sp, 'minSalary') || '100000') || 100000

  const salaryLabel =
    minSalary >= 250000
      ? '$250k+'
      : minSalary >= 200000
        ? '$200k+'
        : minSalary >= 150000
          ? '$150k+'
          : '$100k+'

  if (q && location) {
    return `${salaryLabel} ${q} jobs in ${location.toUpperCase()} | Remote100k`
  }
  if (q) {
    return `${salaryLabel} ${q} jobs | Remote100k`
  }
  if (location) {
    return `${salaryLabel} jobs in ${location.toUpperCase()} | Remote100k`
  }
  return `${salaryLabel} tech jobs search | Remote100k`
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = await resolveSearchParams(searchParams)
  const title = buildTitle(sp)

  const description =
    'Search curated $100k+ tech jobs from top companies. Filter by role, location, and salary band across remote, hybrid, and on-site roles.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await resolveSearchParams(searchParams)

  const q = getParam(sp, 'q')?.trim() || ''
  const role = getParam(sp, 'role')?.trim() || ''
  const location = getParam(sp, 'location')?.trim() || ''
  const minSalaryRaw = Number(getParam(sp, 'minSalary') || '100000')
  const page = Math.max(1, Number(getParam(sp, 'page') || '1') || 1)

  const minAnnual = Math.max(100_000, isNaN(minSalaryRaw) ? 100_000 : minSalaryRaw)

  const andConditions: any[] = []

  // High-salary enforcement
  andConditions.push({
    OR: [
      { maxAnnual: { gte: BigInt(minAnnual) } },
      { minAnnual: { gte: BigInt(minAnnual) } },
      { isHighSalary: true },
    ],
  })

  if (q) {
    andConditions.push({
      OR: [
        { title: { contains: q } },
        { company: { contains: q } },
        { locationRaw: { contains: q } },
      ],
    })
  }

  if (role) {
    andConditions.push({
      roleSlug: { contains: role },
    })
  }

  if (location) {
    if (location === 'remote') {
      andConditions.push({
        OR: [{ remote: true }, { remoteMode: 'remote' }],
      })
    } else if (location.length === 2) {
      andConditions.push({
        countryCode: location.toUpperCase(),
      })
    }
  }

  const where: any =
    andConditions.length > 0
      ? { isExpired: false, AND: andConditions }
      : { isExpired: false }

  const [jobsRaw, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [
        { isHighSalary: 'desc' },
        { maxAnnual: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { companyRef: true },
    }),
    prisma.job.count({ where }),
  ])

  const jobs = jobsRaw as JobWithCompany[]
  const hasNextPage = page * PAGE_SIZE < total
  const hasPrevPage = page > 1

  const title = buildTitle(sp)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      {/* Search Form */}
      <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
        <form action="/search" method="GET" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search Query */}
            <div className="md:col-span-2">
              <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-slate-400">
                Search
              </label>
              <input
                type="text"
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Job title, company, or keyword..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="mb-1.5 block text-xs font-medium text-slate-400">
                Location
              </label>
              <select
                id="location"
                name="location"
                defaultValue={location}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All locations</option>
                <option value="remote">Remote Only</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="DE">Germany</option>
                <option value="AU">Australia</option>
              </select>
            </div>

            {/* Min Salary */}
            <div>
              <label htmlFor="minSalary" className="mb-1.5 block text-xs font-medium text-slate-400">
                Minimum Salary
              </label>
              <select
                id="minSalary"
                name="minSalary"
                defaultValue={minSalaryRaw}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="100000">$100k+</option>
                <option value="150000">$150k+</option>
                <option value="200000">$200k+</option>
                <option value="250000">$250k+</option>
                <option value="300000">$300k+</option>
                <option value="400000">$400k+</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Search Jobs
            </button>
            {(q || role || location || minSalaryRaw > 100000) && (
              <Link
                href="/search"
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Clear filters
              </Link>
            )}
          </div>
        </form>
      </div>

      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-50 md:text-2xl">
              {q ? `Results for "${q}"` : 'All $100k+ Jobs'}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {total.toLocaleString()} jobs found
              {location && ` in ${location === 'remote' ? 'Remote' : location.toUpperCase()}`}
              {minAnnual > 100000 && ` paying $${(minAnnual / 1000).toFixed(0)}k+`}
            </p>
          </div>
        </div>
      </header>

      {/* Results */}
      {jobs.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-8 text-center">
          <p className="text-slate-300">No jobs matched your search.</p>
          <p className="mt-2 text-sm text-slate-500">
            Try a different keyword, broaden your location, or reduce the minimum salary.
          </p>
          <div className="mt-4">
            <Link
              href="/search"
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
            >
              Clear all filters
            </Link>
          </div>
        </div>
      ) : (
        <>
          <JobList jobs={jobs} />

          {/* Pagination */}
          <div className="mt-8 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
            <span className="text-sm text-slate-400">
              Page <span className="font-semibold text-slate-200">{page}</span> of{' '}
              <span className="font-semibold text-slate-200">
                {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
            </span>

            <div className="flex gap-2">
              {hasPrevPage && (
                <Link
                  href={buildSearchHref(sp, page - 1)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
                >
                  ← Previous
                </Link>
              )}
              {hasNextPage && (
                <Link
                  href={buildSearchHref(sp, page + 1)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  )
}
