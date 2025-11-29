// app/remote/[role]/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '../../../lib/prisma'
import {
  queryJobs,
  type JobWithCompany,
} from '../../../lib/jobs/queryJobs'
import { buildJobSlugHref } from '../../../lib/jobs/jobSlug'
import JobList from '../../components/JobList'

export const revalidate = 300

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

const PAGE_SIZE = 20

type SearchParams = Record<string, string | string[] | undefined>

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function resolveSearchParams(
  searchParams: SearchParams | Promise<SearchParams>
): Promise<SearchParams> {
  // Works whether searchParams is already resolved or a Promise (Next 16)
  return await searchParams
}

function parsePage(sp: SearchParams): number {
  const raw = (sp.page ?? '1') as string
  const n = Number(raw || '1') || 1
  return Math.max(1, n)
}

function normalizeStringParam(
  value?: string | string[]
): string | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function prettyRole(slug: string | undefined): string {
  if (!slug) return ''
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildPageHref(
  basePath: string,
  searchParams: SearchParams,
  page: number
): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'page') continue
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v != null) params.append(key, v)
      }
    } else if (value != null) {
      params.set(key, value)
    }
  }

  params.set('page', String(page))
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function buildFilterHref(
  basePath: string,
  searchParams: SearchParams,
  updates: Partial<{ country: string | null; min: number }>
): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v != null) params.append(key, v)
      }
    } else if (value != null) {
      params.set(key, value)
    }
  }

  // reset page
  params.set('page', '1')

  if (updates.country !== undefined) {
    if (!updates.country) {
      params.delete('country')
    } else {
      params.set('country', updates.country)
    }
  }

  if (updates.min !== undefined) {
    if (!updates.min || updates.min <= 0) {
      params.delete('min')
    } else {
      params.set('min', String(updates.min))
    }
  }

  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function buildJobListJsonLd(
  roleSlug: string,
  jobs: JobWithCompany[],
  page: number
) {
  const roleName = prettyRole(roleSlug)

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Remote ${roleName} jobs paying $100k+`,
    itemListElement: jobs.map((job, index) => {
      const href = buildJobSlugHref(job)

      return {
        '@type': 'ListItem',
        position: (page - 1) * PAGE_SIZE + index + 1,
        item: {
          '@type': 'JobPosting',
          title: job.title,
          description: job.descriptionHtml || undefined,
          datePosted: job.postedAt?.toISOString(),
          employmentType: (job as any).type || undefined,
          hiringOrganization: {
            '@type': 'Organization',
            name: job.companyRef?.name || job.company,
            sameAs: job.companyRef?.website || undefined,
          },
          jobLocationType: job.remote ? 'TELECOMMUTE' : undefined,
          jobLocation: job.city
            ? {
                '@type': 'Place',
                address: {
                  '@type': 'PostalAddress',
                  addressLocality: job.city,
                  addressCountry: job.countryCode || undefined,
                },
              }
            : undefined,
          baseSalary:
            job.minAnnual || job.maxAnnual
              ? {
                  '@type': 'MonetaryAmount',
                  currency: job.currency || 'USD',
                  value: {
                    '@type': 'QuantitativeValue',
                    minValue: job.minAnnual
                      ? Number(job.minAnnual)
                      : undefined,
                    maxValue: job.maxAnnual
                      ? Number(job.maxAnnual)
                      : undefined,
                    unitText: 'YEAR',
                  },
                }
              : undefined,
          url: `${SITE_URL}${href}`,
        },
      }
    }),
  }
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { role: string } | Promise<{ role: string }>
  searchParams: SearchParams | Promise<SearchParams>
}): Promise<Metadata> {
  const p = await params
  const sp = await resolveSearchParams(searchParams)

  const roleSlug = p.role
  const roleName = prettyRole(roleSlug)
  const page = parsePage(sp)

  const selectedCountry = normalizeStringParam(sp.country)
  const minParam = normalizeStringParam(sp.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : 100_000

  const result = await queryJobs({
    roleSlugs: [roleSlug],
    countryCode: selectedCountry || undefined,
    minAnnual,
    page,
    pageSize: 1,
  })

  const totalJobs = result.total

  const baseTitle = `Remote ${roleName} jobs paying $100k+`
  const title =
    totalJobs > 0
      ? `${baseTitle} (${totalJobs.toLocaleString()} roles) | Remote100k`
      : `${baseTitle} | Remote100k`

  const description = `Search remote ${roleName} jobs paying $100k+ across top tech and SaaS companies. Filter by country and salary band.`

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/remote/${roleSlug}`,
    },
    openGraph: {
      title: `${baseTitle} | Remote100k`,
      description,
      url: `${SITE_URL}/remote/${roleSlug}`,
      siteName: 'Remote100k',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${baseTitle} | Remote100k`,
      description,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function RemoteRolePage({
  params,
  searchParams,
}: {
  params: { role: string } | Promise<{ role: string }>
  searchParams: SearchParams | Promise<SearchParams>
}) {
  const p = await params
  const sp = await resolveSearchParams(searchParams)

  const roleSlug = p.role
  const roleName = prettyRole(roleSlug)
  const page = parsePage(sp)
  const basePath = `/remote/${roleSlug}`

  const selectedCountry = normalizeStringParam(sp.country)
  const minParam = normalizeStringParam(sp.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : 100_000

  const data = await queryJobs({
    roleSlugs: [roleSlug],
    countryCode: selectedCountry || undefined,
    minAnnual,
    page,
    pageSize: PAGE_SIZE,
  })

  const jobs = data.jobs as JobWithCompany[]
  const totalPages =
    data.total > 0
      ? Math.max(1, Math.ceil(data.total / PAGE_SIZE))
      : 1

  const jsonLd = buildJobListJsonLd(roleSlug, jobs, page)

  const availableCountries = Array.from(
    new Set(
      jobs
        .map((j) => j.countryCode)
        .filter((c): c is string => Boolean(c))
    )
  )

  const salaryOptions = [100_000, 150_000, 200_000]

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      {/* -------------------------------- Breadcrumbs -------------------------------- */}
      <nav
        aria-label="Breadcrumb"
        className="mb-4 text-xs text-slate-400"
      >
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link
              href="/"
              className="hover:text-slate-200 hover:underline"
            >
              Home
            </Link>
          </li>
          <li className="px-1 text-slate-600">/</li>
          <li>
            <Link
              href="/jobs/100k-plus"
              className="hover:text-slate-200 hover:underline"
            >
              $100k+ jobs
            </Link>
          </li>
          <li className="px-1 text-slate-600">/</li>
          <li aria-current="page" className="text-slate-200">
            Remote {roleName}
          </li>
        </ol>
      </nav>

      {/* --------------------------------- Header ---------------------------------- */}
      <header className="mb-6 space-y-3">
        <h1 className="text-2xl font-semibold text-slate-50">
          Remote {roleName} jobs paying $100k+
        </h1>
        <p className="text-sm text-slate-300">
          Find remote and flexible {roleName} roles paying at least
          $100k in local currency. Filter by country and salary band.
        </p>
      </header>

      {/* --------------------------------- Filters --------------------------------- */}
      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs text-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          {/* Country filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Country:</span>
            <Link
              href={buildFilterHref(basePath, sp, {
                country: null,
              })}
              className={`rounded-full px-2 py-1 ${
                !selectedCountry
                  ? 'bg-slate-200 text-slate-900'
                  : 'bg-slate-900 text-slate-200'
              }`}
            >
              Any
            </Link>
            {availableCountries.map((cc) => (
              <Link
                key={cc}
                href={buildFilterHref(basePath, sp, {
                  country: cc,
                })}
                className={`rounded-full px-2 py-1 ${
                  selectedCountry === cc
                    ? 'bg-slate-200 text-slate-900'
                    : 'bg-slate-900 text-slate-200'
                }`}
              >
                {cc.toUpperCase()}
              </Link>
            ))}
          </div>

          {/* Salary filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Min salary:</span>
            {salaryOptions.map((s) => (
              <Link
                key={s}
                href={buildFilterHref(basePath, sp, {
                  min: s,
                })}
                className={`rounded-full px-2 py-1 ${
                  minAnnual === s
                    ? 'bg-slate-200 text-slate-900'
                    : 'bg-slate-900 text-slate-200'
                }`}
              >
                ${Math.round(s / 1000)}k+
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------- Job list -------------------------------- */}
      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">
          No remote {roleName} jobs match your filters yet. Try
          relaxing the filters or check back soon.
        </p>
      ) : (
        <>
          <JobList jobs={jobs} />

          {/* ------------------------------- Pagination ------------------------------- */}
          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-6 flex items-center justify-between gap-3 text-xs"
            >
              <div className="text-slate-400">
                Page{' '}
                <span className="font-semibold text-slate-100">
                  {page}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-100">
                  {totalPages}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link
                    href={buildPageHref(
                      basePath,
                      sp,
                      page - 1
                    )}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-slate-200 hover:border-slate-700 hover:bg-slate-900"
                  >
                    Previous
                  </Link>
                )}

                {page < totalPages && (
                  <Link
                    href={buildPageHref(
                      basePath,
                      sp,
                      page + 1
                    )}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-slate-200 hover:border-slate-700 hover:bg-slate-900"
                  >
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}

      {/* -------------------------------- JSON-LD -------------------------------- */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />
    </main>
  )
}
