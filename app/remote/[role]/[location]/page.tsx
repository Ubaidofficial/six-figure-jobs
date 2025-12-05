// app/remote/[role]/[city]/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '../../../../lib/prisma'
import type { JobWithCompany } from '../../../../lib/jobs/queryJobs'
import { buildJobSlugHref } from '../../../../lib/jobs/jobSlug'
import JobList from '../../../components/JobList'
import { SITE_NAME, getSiteUrl } from '../../../../lib/seo/site'

export const revalidate = 300

const SITE_URL = getSiteUrl()

const PAGE_SIZE = 20

type SearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  params: { role: string; city: string }
  searchParams?: SearchParams
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function parsePage(searchParams?: SearchParams): number {
  const raw = (searchParams?.page ?? '1') as string
  const n = Number(raw || '1') || 1
  return Math.max(1, n)
}

function buildCanonicalPath(roleSlug: string, cityParam: string, sp: SearchParams | undefined) {
  const base = `/remote/${roleSlug}/${cityParam}`
  const params = new URLSearchParams()

  const minParam = normalizeStringParam(sp?.min)
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

function prettyRole(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function prettyCity(slugOrName: string): string {
  if (!slugOrName) return ''
  // If it's already spaced, just capitalize first letters
  if (slugOrName.includes(' ')) {
    return slugOrName
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return slugOrName
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function buildPageHref(
  basePath: string,
  searchParams: SearchParams | undefined,
  page: number
): string {
  const params = new URLSearchParams()

  if (searchParams) {
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
  }

  params.set('page', String(page))
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function buildFilterHref(
  basePath: string,
  searchParams: SearchParams | undefined,
  updates: Partial<{ min: number }>
): string {
  const params = new URLSearchParams()

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v != null) params.append(key, v)
        }
      } else if (value != null) {
        params.set(key, value)
      }
    }
  }

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

function buildWhere(
  roleSlug: string,
  citySlug: string,
  minAnnual: number
) {
  const threshold = BigInt(minAnnual)

  return {
    roleSlug,
    citySlug,
    isExpired: false,
    OR: [
      { maxAnnual: { gte: threshold } },
      { minAnnual: { gte: threshold } },
      { isHundredKLocal: true },
    ],
  }
}

function buildJobListJsonLd(
  roleSlug: string,
  cityName: string,
  countryCode: string | null,
  jobs: JobWithCompany[],
  page: number
) {
  const roleName = prettyRole(roleSlug)

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Remote ${roleName} jobs in ${cityName} paying $100k+`,
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
              addressLocality: job.city || cityName,
              addressCountry: job.countryCode || countryCode || undefined,
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

function buildBreadcrumbJsonLd(
  roleSlug: string,
  cityParam: string,
  cityName: string
) {
  const roleName = prettyRole(roleSlug)

  const items: any[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: `${SITE_URL}/`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: '$100k+ jobs',
      item: `${SITE_URL}/jobs/100k-plus`,
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: `Remote ${roleName}`,
      item: `${SITE_URL}/remote/${roleSlug}`,
    },
    {
      '@type': 'ListItem',
      position: 4,
      name: `Remote ${roleName} jobs in ${cityName}`,
      item: `${SITE_URL}/remote/${roleSlug}/${cityParam}`,
    },
  ]

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const roleSlug = params.role
  const cityParam = params.city
  const citySlug = cityParam.toLowerCase()
  const page = parsePage(searchParams)

  const minParam = normalizeStringParam(searchParams?.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : 100_000

  const where = buildWhere(roleSlug, citySlug, minAnnual)

  const [sampleJob, totalJobs] = await Promise.all([
    prisma.job.findFirst({
      where,
      select: {
        city: true,
        countryCode: true,
      },
    }),
    prisma.job.count({ where }),
  ])

  if (!sampleJob && totalJobs === 0) {
    return {
      title: `Page not found – ${SITE_NAME}`,
      description: 'This page does not exist.',
    }
  }

  const cityName = prettyCity(sampleJob?.city || citySlug)

  const baseTitle = `Remote ${prettyRole(
    roleSlug
  )} jobs in ${cityName} paying $100k+`
  const canonicalPath = buildCanonicalPath(roleSlug, cityParam, searchParams)
  const canonicalUrl = `${SITE_URL}${canonicalPath}`

  return {
    title:
      totalJobs > 0
        ? `${baseTitle} (${totalJobs.toLocaleString()} roles) | ${SITE_NAME}`
        : `${baseTitle} | ${SITE_NAME}`,
    description: `Search remote ${prettyRole(
      roleSlug
    )} jobs in ${cityName} paying $100k+ at leading tech and SaaS companies.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${baseTitle} | ${SITE_NAME}`,
      description: `Find remote ${prettyRole(
        roleSlug
      )} roles in ${cityName} with at least $100k total compensation.`,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${baseTitle} | ${SITE_NAME}`,
      description: `Remote ${prettyRole(
        roleSlug
      )} jobs in ${cityName} paying $100k+.`,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function RemoteRoleCityPage({
  params,
  searchParams,
}: PageProps) {
  const roleSlug = params.role
  const cityParam = params.city
  const citySlug = cityParam.toLowerCase()

  const page = parsePage(searchParams)
  const basePath = `/remote/${roleSlug}/${cityParam}`
  const canonicalPath = buildCanonicalPath(roleSlug, cityParam, searchParams)
  const requestedParams = new URLSearchParams()
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((val) => val != null && requestedParams.append(k, val))
      else if (v != null) requestedParams.set(k, v)
    })
  }
  const rawPage = searchParams ? (Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page) : null
  if (!rawPage || Number(rawPage) <= 1) requestedParams.delete('page')
  const requested = (() => {
    const qs = requestedParams.toString()
    return qs ? `${basePath}?${qs}` : basePath
  })()
  if (requested !== canonicalPath) {
    redirect(canonicalPath)
  }

  const minParam = normalizeStringParam(searchParams?.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : 100_000

  // First check if this slice exists at all (ignoring salary)
  const exists = await prisma.job.count({
    where: {
      roleSlug,
      citySlug,
      isExpired: false,
    },
  })

  if (!exists) {
    return notFound()
  }

  const where = buildWhere(roleSlug, citySlug, minAnnual)

  const [rows, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { postedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { companyRef: true },
    }),
    prisma.job.count({ where }),
  ])

  const jobs = rows as JobWithCompany[]
  const totalPages =
    total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1

  const sampleJob = jobs[0] ?? null
  const cityName = prettyCity(sampleJob?.city || citySlug)
  const countryCode = sampleJob?.countryCode ?? null

  const jsonLd = buildJobListJsonLd(
    roleSlug,
    cityName,
    countryCode,
    jobs,
    page
  )
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    roleSlug,
    cityParam,
    cityName
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
          <li>
            <Link
              href={`/remote/${roleSlug}`}
              className="hover:text-slate-200 hover:underline"
            >
              Remote {prettyRole(roleSlug)}
            </Link>
          </li>
          <li className="px-1 text-slate-600">/</li>
          <li aria-current="page" className="text-slate-200">
            {cityName}
          </li>
        </ol>
      </nav>

      {/* --------------------------------- Header ---------------------------------- */}
      <header className="mb-6 space-y-3">
        <h1 className="text-2xl font-semibold text-slate-50">
          Remote {prettyRole(roleSlug)} jobs in {cityName} paying
          $100k+
        </h1>
        <p className="text-sm text-slate-300">
          Browse high-paying remote {prettyRole(
            roleSlug
          )} roles based in {cityName}. All jobs are filtered for
          at least $100k local total compensation.
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
                href={buildFilterHref(basePath, searchParams, {
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
            Showing roles tagged with {cityName} and estimated $100k+
            compensation.
          </p>
        </div>
      </section>

      {/* -------------------------------- Job list -------------------------------- */}
      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">
          No remote {prettyRole(roleSlug)} roles in {cityName} match
          your current filters. Try lowering the salary filter or
          check back soon.
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
                      searchParams,
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
                      searchParams,
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
    </main>
  )
}
