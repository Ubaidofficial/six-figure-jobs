// app/search/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '../../lib/prisma'
import {
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
  type JobWithCompany,
} from '../../lib/jobs/queryJobs'
import JobList from '../components/JobList'
import { parseSearchQuery } from '../../lib/jobs/nlToFilters'
import { SITE_NAME, getSiteUrl } from '../../lib/seo/site'
import { countryCodeToSlug, countrySlugToCode } from '../../lib/seo/countrySlug'

export const dynamic = "force-dynamic"

const PAGE_SIZE = 40

type SearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  searchParams?: Promise<SearchParams>
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function resolveSearchParams(
  input?: Promise<SearchParams>
): Promise<SearchParams> {
  return (await input) || {}
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
  const remoteMode = getParam(sp, 'remoteMode')
  const minSalary = getParam(sp, 'minSalary')
  const remoteRegion = getParam(sp, 'remoteRegion')
  const seniority = getParam(sp, 'seniority')

  if (q) params.set('q', q)
  if (role) params.set('role', role)
  if (location) params.set('location', location)
  if (minSalary) params.set('minSalary', minSalary)
  if (remoteMode) params.set('remoteMode', remoteMode)
  if (remoteRegion) params.set('remoteRegion', remoteRegion)
  if (seniority) params.set('seniority', seniority)
  if (page > 1) params.set('page', String(page))

  const qs = params.toString()
  return qs ? `/search?${qs}` : '/search'
}

function buildTitle(sp: SearchParams): string {
  const q = getParam(sp, 'q')
  const location = getParam(sp, 'location')
  const remoteMode = getParam(sp, 'remoteMode')
  const remoteRegion = getParam(sp, 'remoteRegion')
  const minSalary = Number(getParam(sp, 'minSalary') || '100000') || 100000

  const salaryLabel =
    minSalary >= 300000
      ? '$300k+'
      : minSalary >= 200000
      ? '$200k+'
      : '$100k+'

  if (q && location) {
    return `${salaryLabel} ${q} jobs in ${location.toUpperCase()} | ${SITE_NAME}`
  }
  if (q && remoteRegion) {
    return `${salaryLabel} ${q} jobs (${remoteRegion}) | ${SITE_NAME}`
  }
  if (q) {
    return `${salaryLabel} ${q} jobs | ${SITE_NAME}`
  }
  if (location) {
    return `${salaryLabel} jobs in ${location.toUpperCase()} | ${SITE_NAME}`
  }
  if (remoteRegion) {
    return `${salaryLabel} remote jobs (${remoteRegion}) | ${SITE_NAME}`
  }
  return `${salaryLabel} tech jobs search | ${SITE_NAME}`
}

function buildCanonicalPath(sp: SearchParams): string {
  const params = new URLSearchParams()

  const q = getParam(sp, 'q')
  const role = getParam(sp, 'role')
  const location = getParam(sp, 'location')
  const remoteMode = getParam(sp, 'remoteMode')
  const minSalary = getParam(sp, 'minSalary')
  const remoteRegion = getParam(sp, 'remoteRegion')
  const seniority = getParam(sp, 'seniority')
  const page = Math.max(1, Number(getParam(sp, 'page') || '1') || 1)

  if (q) params.set('q', q)
  if (role) params.set('role', role)
  if (location) params.set('location', location)
  if (remoteMode) params.set('remoteMode', remoteMode)
  if (remoteRegion) params.set('remoteRegion', remoteRegion)
  if (seniority) params.set('seniority', seniority)
  if (minSalary) params.set('minSalary', minSalary)
  if (page > 1) params.set('page', String(page))

  const qs = params.toString()
  return qs ? `/search?${qs}` : `/search`
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
  const canonical = `${getSiteUrl()}${buildCanonicalPath(sp)}`

  const description =
    'Search curated $100k+ tech jobs from top companies. Filter by role, location, and salary band across remote, hybrid, and on-site roles.'

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index: false,
      follow: true,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await resolveSearchParams(searchParams)
  const canonicalPath = buildCanonicalPath(sp)

  const requestedParams = new URLSearchParams()
  Object.entries(sp).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((val) => val != null && requestedParams.append(k, val))
    else if (v != null) requestedParams.set(k, v)
  })
  const rawPage = getParam(sp, 'page')
  if (!rawPage || Number(rawPage) <= 1) requestedParams.delete('page')
  const requestedPath = (() => {
    const qs = requestedParams.toString()
    return qs ? `/search?${qs}` : '/search'
  })()
  if (requestedPath !== canonicalPath) {
    redirect(canonicalPath)
  }

  const q = getParam(sp, 'q')?.trim() || ''
  const role = getParam(sp, 'role')?.trim() || ''
  const location = getParam(sp, 'location')?.trim() || ''
  const remoteMode = getParam(sp, 'remoteMode')?.trim() || ''
  const remoteRegion = getParam(sp, 'remoteRegion')?.trim() || ''
  const seniority = getParam(sp, 'seniority')?.trim() || ''
  const minSalaryParam = getParam(sp, 'minSalary')
  const minSalaryRaw = Number(minSalaryParam || '100000')
  const page = Math.max(1, Number(getParam(sp, 'page') || '1') || 1)

  const aiFilters = parseSearchQuery(q)

  const minAnnual = Math.max(
    100_000,
    isNaN(minSalaryRaw) ? 100_000 : minSalaryRaw,
    aiFilters.minAnnual ?? 0,
  )

  const resolvedLocation = location || aiFilters.countryCode || ''
  const resolvedRemoteMode = remoteMode || aiFilters.remoteMode || ''
  const resolvedRemoteRegion = remoteRegion || aiFilters.remoteRegion || ''
  const resolvedSeniority = seniority || aiFilters.experienceLevel || ''
  const roleSlugs = aiFilters.roleSlugs?.length
    ? aiFilters.roleSlugs
    : role
    ? [role]
    : []

  const andConditions: any[] = []

  // v2.9 hard gates: eligibility + global exclusions
  andConditions.push(buildHighSalaryEligibilityWhere())
  andConditions.push(buildGlobalExclusionsWhere())

  // Optional user min-salary filter (additional constraint on top of eligibility)
  const hasUserMinSalary = Boolean(minSalaryParam) || aiFilters.minAnnual != null
  if (hasUserMinSalary) {
    andConditions.push({
      OR: [
        { maxAnnual: { gte: BigInt(minAnnual) } },
        { minAnnual: { gte: BigInt(minAnnual) } },
      ],
    })
  }

  if (q) {
    andConditions.push({
      OR: [
        { title: { contains: q } },
        { company: { contains: q } },
        { locationRaw: { contains: q } },
      ],
    })
  }

  if (roleSlugs.length) {
    andConditions.push({
      OR: roleSlugs.map((slug) => ({ roleSlug: { contains: slug } })),
    })
  }

  if (resolvedLocation) {
    if (resolvedLocation === 'remote') {
      andConditions.push({
        OR: [{ remote: true }, { remoteMode: 'remote' }],
      })
    } else if (resolvedLocation.length === 2) {
      const slugFromCode = countryCodeToSlug(resolvedLocation.toUpperCase())
      if (slugFromCode) {
        const code = countrySlugToCode(slugFromCode)
        if (code) {
          andConditions.push({
            countryCode: code.toUpperCase(),
          })
        }
      }
    }
  }

  if (aiFilters.remoteOnly && !resolvedRemoteMode) {
    andConditions.push({
      OR: [{ remote: true }, { remoteMode: 'remote' }],
    })
  }

  if (
    resolvedRemoteMode === 'remote' ||
    resolvedRemoteMode === 'hybrid' ||
    resolvedRemoteMode === 'onsite'
  ) {
    andConditions.push({ remoteMode: resolvedRemoteMode })
  }

  if (resolvedRemoteRegion) {
    andConditions.push({ remoteRegion: resolvedRemoteRegion })
  }

  if (resolvedSeniority) {
    andConditions.push({
      roleInference: {
        seniority: resolvedSeniority,
      },
    })
  }

  const where: any =
    andConditions.length > 0
      ? { isExpired: false, AND: andConditions }
      : { isExpired: false }

  const [jobsRaw, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [
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
  const paginationState: SearchParams = {
    ...sp,
    ...(resolvedLocation ? { location: resolvedLocation } : {}),
    ...(resolvedRemoteMode ? { remoteMode: resolvedRemoteMode } : {}),
    ...(resolvedRemoteRegion ? { remoteRegion: resolvedRemoteRegion } : {}),
    ...(resolvedSeniority ? { seniority: resolvedSeniority } : {}),
    ...(roleSlugs.length === 1 ? { role: roleSlugs[0] } : {}),
    minSalary: String(minAnnual),
  }

  const title = buildTitle(sp)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      {/* Search Form */}
      <div className="glass soft-shadow mb-10 rounded-2xl p-6 md:sticky md:top-24 md:z-30">
        <form action="/search" method="GET" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-6">
            {/* Search Query */}
            <div className="md:col-span-2">
              <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-slate-400">
                Find your next six-figure job
              </label>
              <input
                type="text"
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Role, company, or skill…"
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
                defaultValue={resolvedLocation}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All locations</option>
                <option value="remote">Remote Only</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="DE">Germany</option>
                <option value="IE">Ireland</option>
                <option value="CH">Switzerland</option>
                <option value="SG">Singapore</option>
                <option value="AU">Australia</option>
                <option value="NZ">New Zealand</option>
              </select>
            </div>

            {/* Work arrangement */}
            <div>
              <label htmlFor="remoteMode" className="mb-1.5 block text-xs font-medium text-slate-400">
                Work arrangement
              </label>
              <select
                id="remoteMode"
                name="remoteMode"
                defaultValue={resolvedRemoteMode}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Any</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
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
              <option value="200000">$200k+</option>
              <option value="300000">$300k+</option>
              <option value="400000">$400k+</option>
              </select>
            </div>

            {/* Remote region */}
            <div>
              <label htmlFor="remoteRegion" className="mb-1.5 block text-xs font-medium text-slate-400">
                Remote region
              </label>
              <select
                id="remoteRegion"
                name="remoteRegion"
                defaultValue={resolvedRemoteRegion}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Any</option>
                <option value="global">Global</option>
                <option value="us-only">US only</option>
                <option value="canada">Canada</option>
                <option value="emea">EMEA</option>
                <option value="apac">APAC</option>
                <option value="uk-ireland">UK & Ireland</option>
              </select>
            </div>

            {/* Seniority */}
            <div>
              <label htmlFor="seniority" className="mb-1.5 block text-xs font-medium text-slate-400">
                Seniority
              </label>
              <select
                id="seniority"
                name="seniority"
                defaultValue={resolvedSeniority}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Any</option>
                <option value="entry">Entry</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
                <option value="director">Director</option>
                <option value="vp">VP</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-xl bg-emerald-400 px-6 text-sm font-semibold text-slate-950 shadow-[0_14px_40px_rgba(16,185,129,0.22)] transition hover:bg-emerald-300"
            >
              Find $100k+ roles
            </button>
            {(q || role || location || minSalaryRaw > 100000) && (
              <Link
                href="/search"
                className="focus-ring rounded-md text-xs text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
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
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">
              {q ? `Results for "${q}"` : 'All $100k+ Jobs'}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              <span className="font-semibold text-slate-100">
                {total.toLocaleString()}
              </span>{' '}
              opportunities found
              {resolvedLocation &&
                ` in ${resolvedLocation === 'remote' ? 'Remote' : resolvedLocation.toUpperCase()}`}
              {minAnnual > 100000 && ` paying $${(minAnnual / 1000).toFixed(0)}k+`}
            </p>
          </div>
        </div>
      </header>

      {/* Results */}
      {jobs.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="text-base font-semibold text-slate-100">
            No jobs found.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Try adjusting your filters, or clear them to explore all $100k+ opportunities.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/search"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-950/40 px-6 text-sm font-semibold text-slate-100 transition hover:bg-white/5"
            >
              Clear filters
            </Link>
            <Link
              href="/"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-xl bg-emerald-400 px-6 text-sm font-semibold text-slate-950 shadow-[0_14px_40px_rgba(16,185,129,0.22)] transition hover:bg-emerald-300"
            >
              Explore newest opportunities
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
                  href={buildSearchHref(paginationState, page - 1)}
                  className="focus-ring inline-flex h-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-950/40 px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/5"
                >
                  ← Previous
                </Link>
              )}
              {hasNextPage && (
                <Link
                  href={buildSearchHref(paginationState, page + 1)}
                  className="focus-ring inline-flex h-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-950/40 px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/5"
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
