// app/remote/[role]/country/[country]/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '../../../../../lib/prisma'
import {
  queryJobs,
  type JobWithCompany,
} from '../../../../../lib/jobs/queryJobs'
import { buildJobSlugHref } from '../../../../../lib/jobs/jobSlug'
import JobList from '../../../../components/JobList'
import { SITE_NAME, getSiteUrl } from '../../../../../lib/seo/site'

export const revalidate = 300

const SITE_URL = getSiteUrl()

const PAGE_SIZE = 20

type SearchParams = Record<string, string | string[] | undefined>

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function resolveSearchParams(
  searchParams: SearchParams | Promise<SearchParams>
): Promise<SearchParams> {
  // Handles both plain objects and Promise-based searchParams (Next 16)
  return await searchParams
}

function parsePage(sp: SearchParams): number {
  const raw = (sp.page ?? '1') as string
  const n = Number(raw || '1') || 1
  return Math.max(1, n)
}

function buildCanonicalPath(roleSlug: string, countryParam: string, sp: SearchParams) {
  const base = `/remote/${roleSlug}/country/${countryParam}`
  const params = new URLSearchParams()

  const minParam = normalizeStringParam(sp.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : null
  if (minAnnual) params.set('min', String(minAnnual))

  const page = parsePage(sp)
  if (page > 1) params.set('page', String(page))

  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
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

function prettyCountryCode(code: string | undefined): string {
  if (!code) return ''
  return code.toUpperCase()
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
  updates: Partial<{ min: number }>
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

  // Reset page on filter change
  params.set('page', '1')

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
  countryCode: string,
  jobs: JobWithCompany[],
  page: number
) {
  const roleName = prettyRole(roleSlug)
  const cc = prettyCountryCode(countryCode)

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Remote ${roleName} jobs in ${cc} paying $100k+`,
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
          jobLocation: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressCountry: job.countryCode || countryCode,
              addressLocality: job.city || undefined,
            },
          },
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
  params: { role: string; country: string } | Promise<{ role: string; country: string }>
  searchParams: SearchParams | Promise<SearchParams>
}): Promise<Metadata> {
  const p = await params
  const sp = await resolveSearchParams(searchParams)

  const roleSlug = p.role
  const roleName = prettyRole(roleSlug)
  const countryParam = p.country
  const countryCode = prettyCountryCode(countryParam)
  const page = parsePage(sp)
  const canonicalPathname = buildCanonicalPath(roleSlug, countryParam, sp)
  const requestedParams = new URLSearchParams()
  Object.entries(sp).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      v.forEach((val) => val != null && requestedParams.append(k, val))
    } else if (v != null) {
      requestedParams.set(k, v)
    }
  })
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page
  if (!rawPage || Number(rawPage) <= 1) requestedParams.delete('page')
  const requested = (() => {
    const qs = requestedParams.toString()
    return qs ? `/remote/${roleSlug}/country/${countryParam}?${qs}` : `/remote/${roleSlug}/country/${countryParam}`
  })()
  if (requested !== canonicalPathname) {
    redirect(canonicalPathname)
  }

  const minParam = normalizeStringParam(sp.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : 100_000

  const result = await queryJobs({
    roleSlugs: [roleSlug],
    countryCode,
    minAnnual,
    page,
    pageSize: 1,
  })

  const totalJobs = result.total
  const titleBase = `Remote ${roleName} jobs in ${countryCode} paying $100k+`
  const canonicalUrl = `${SITE_URL}${canonicalPathname}`

  return {
    title:
      totalJobs > 0
        ? `${titleBase} (${totalJobs.toLocaleString()} roles) | ${SITE_NAME}`
        : `${titleBase} | ${SITE_NAME}`,
    description: `Search remote ${roleName} jobs in ${countryCode} paying $100k+ across top companies. Filter by salary bands and explore the best high-paying roles.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${titleBase} | ${SITE_NAME}`,
      description: `Find remote ${roleName} roles in ${countryCode} with at least $100k total compensation.`,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${titleBase} | ${SITE_NAME}`,
      description: `Remote ${roleName} jobs in ${countryCode} paying $100k+.`,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function RemoteRoleCountryPage({
  params,
  searchParams,
}: {
  params: { role: string; country: string } | Promise<{ role: string; country: string }>
  searchParams: SearchParams | Promise<SearchParams>
}) {
  const p = await params
  const sp = await resolveSearchParams(searchParams)

  const roleSlug = p.role
  const roleName = prettyRole(roleSlug)
  const countryParam = p.country
  const countryCode = prettyCountryCode(countryParam)

  const page = parsePage(sp)
  const basePath = `/remote/${roleSlug}/country/${countryParam}`

  const minParam = normalizeStringParam(sp.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : 100_000

  // Sanity check: does this combination exist at all?
  const hasAnyJobs = await prisma.job.count({
    where: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...( { roleSlug } as any ),
      countryCode,
    },
  })

  if (!hasAnyJobs) {
    return notFound()
  }

  const data = await queryJobs({
    roleSlugs: [roleSlug],
    countryCode,
    minAnnual,
    page,
    pageSize: PAGE_SIZE,
  })

  const jobs = data.jobs as JobWithCompany[]
  const totalPages =
    data.total > 0
      ? Math.max(1, Math.ceil(data.total / PAGE_SIZE))
      : 1

  const jsonLd = buildJobListJsonLd(roleSlug, countryCode, jobs, page)
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
          <li>
            <Link
              href={`/remote/${roleSlug}`}
              className="hover:text-slate-200 hover:underline"
            >
              Remote {roleName}
            </Link>
          </li>
          <li className="px-1 text-slate-600">/</li>
          <li aria-current="page" className="text-slate-200">
            {countryCode}
          </li>
        </ol>
      </nav>

      {/* --------------------------------- Header ---------------------------------- */}
      <header className="mb-6 space-y-3">
        <h1 className="text-2xl font-semibold text-slate-50">
          Remote {roleName} jobs in {countryCode} paying $100k+
        </h1>
        <p className="text-sm text-slate-300">
          Browse high-paying remote {roleName} roles based in{' '}
          {countryCode}. All jobs are filtered for at least $100k
          local total compensation.
        </p>
      </header>

      {/* --------------------------------- Filters --------------------------------- */}
      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs text-slate-200">
        <div className="flex flex-wrap items-center gap-4">
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

          <p className="text-slate-500">
            Showing roles tagged with {countryCode} and estimated
            $100k+ compensation.
          </p>
        </div>
      </section>

      {/* -------------------------------- Job list -------------------------------- */}
      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">
          No remote {roleName} roles in {countryCode} match your
          current filters. Try lowering the salary filter or check
          back soon.
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
