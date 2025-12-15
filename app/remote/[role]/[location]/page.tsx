// app/remote/[role]/[city]/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '../../../../lib/prisma'
import {
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
  type JobWithCompany,
} from '../../../../lib/jobs/queryJobs'
import { buildJobSlugHref } from '../../../../lib/jobs/jobSlug'
import JobList from '../../../components/JobList'
import { SITE_NAME, getSiteUrl } from '../../../../lib/seo/site'
import { buildItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'

export const revalidate = 300

const SITE_URL = getSiteUrl()

const PAGE_SIZE = 20

type SearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  params: Promise<{ role: string; location: string }>
  searchParams?: Promise<SearchParams>
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
    AND: [
      buildHighSalaryEligibilityWhere(),
      buildGlobalExclusionsWhere(),
      { OR: [{ remote: true }, { remoteMode: 'remote' }] },
      {
        OR: [
          { maxAnnual: { gte: threshold } },
          { minAnnual: { gte: threshold } },
        ],
      },
    ],
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
  const { role: roleSlug, location: cityParam } = await params
  const sp = (await searchParams) || {}
  const citySlug = cityParam.toLowerCase()
  const page = parsePage(sp)

  const minParam = normalizeStringParam(sp.min)
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
  const canonicalPath = buildCanonicalPath(roleSlug, cityParam, sp)
  const canonicalUrl = `${SITE_URL}${canonicalPath}`
  const title =
    totalJobs > 0
      ? `${baseTitle} (${totalJobs.toLocaleString()} roles) | ${SITE_NAME}`
      : `${baseTitle} | ${SITE_NAME}`

  return {
    title,
    description: `Search ${totalJobs.toLocaleString()} remote ${prettyRole(
      roleSlug
    )} jobs in ${cityName} paying $100k+ at leading tech and SaaS companies.`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots:
      totalJobs >= 3
        ? { index: true, follow: true }
        : { index: false, follow: true },
    openGraph: {
      title,
      description: `Find remote ${prettyRole(
        roleSlug
      )} roles in ${cityName} with at least $100k total compensation.`,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
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
  const { role: roleSlug, location: cityParam } = await params
  const sp = (await searchParams) || {}
  const citySlug = cityParam.toLowerCase()

  const page = parsePage(sp)
  const basePath = `/remote/${roleSlug}/${cityParam}`
  const canonicalPath = buildCanonicalPath(roleSlug, cityParam, sp)
  const requestedParams = new URLSearchParams()
  Object.entries(sp).forEach(([k, v]) => {
    if (Array.isArray(v))
      v.forEach((val) => val != null && requestedParams.append(k, val))
    else if (v != null) requestedParams.set(k, v)
  })
  const rawPage = sp.page ? (Array.isArray(sp.page) ? sp.page[0] : sp.page) : null
  if (!rawPage || Number(rawPage) <= 1) requestedParams.delete('page')
  const requested = (() => {
    const qs = requestedParams.toString()
    return qs ? `${basePath}?${qs}` : basePath
  })()
  if (requested !== canonicalPath) {
    redirect(canonicalPath)
  }

  const minParam = normalizeStringParam(sp.min)
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
  const totalJobs = total

  const sampleJob = jobs[0] ?? null
  const cityName = prettyCity(sampleJob?.city || citySlug)
  const countryCode = sampleJob?.countryCode ?? null

  const jsonLd = buildItemListJsonLd({
    name: 'High-paying jobs on Six Figure Jobs',
    jobs,
    page,
    pageSize: PAGE_SIZE,
  })
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    roleSlug,
    cityParam,
    cityName
  )
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Are these ${prettyRole(roleSlug)} jobs really $100k+?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. We only include remote roles with published or inferred $100k+ compensation (or local equivalent) from ATS feeds and trusted boards.',
        },
      },
      {
        '@type': 'Question',
        name: `How often do you refresh remote ${prettyRole(roleSlug)} jobs in ${cityName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Listings refresh frequently and expire automatically when closed, so stale postings are removed.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do you tag remote eligibility and currency?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. We surface remote/hybrid signals and keep local currency where provided for transparent salary context.',
        },
      },
    ],
  }
  const speakableJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SpeakableSpecification',
    cssSelector: ['main h1', '[data-speakable="summary"]'],
  }

  const salaryOptions = [100_000, 200_000, 300_000, 400_000]

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
          Remote {prettyRole(roleSlug)} jobs in {cityName} paying $100k+ ({totalJobs.toLocaleString()})
        </h1>
        <p className="text-sm text-slate-300" data-speakable="summary">
          Browse high-paying remote {prettyRole(
            roleSlug
          )} roles based in {cityName}. All jobs are filtered for
          at least $100k local total compensation.
        </p>
        <ul className="grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            Salary-first: $100k+ roles only, pulled from ATS and vetted boards.
          </li>
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            Eligibility clarity: remote/hybrid flagged; local currency kept when provided.
          </li>
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            Freshness: stale roles expire automatically to avoid dead applies.
          </li>
        </ul>
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
            Showing roles tagged with {cityName} and estimated $100k+
            compensation.
          </p>
        </div>
      </section>

      <section className="mb-6 space-y-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold text-slate-50">
          Explore related high-paying pages
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-blue-300">
          <li>
            <Link href={`/jobs/100k-plus/${roleSlug}`} className="hover:underline">
              $100k+ {prettyRole(roleSlug)} jobs →
            </Link>
          </li>
          <li>
            <Link href={`/jobs/200k-plus/${roleSlug}`} className="hover:underline">
              $200k+ {prettyRole(roleSlug)} jobs →
            </Link>
          </li>
          <li>
            <Link href={`/salary/${roleSlug}`} className="hover:underline">
              {prettyRole(roleSlug)} salary guide →
            </Link>
          </li>
          <li>
            <Link href={`/remote/${roleSlug}`} className="hover:underline">
              Remote {prettyRole(roleSlug)} jobs (all regions) →
            </Link>
          </li>
        </ul>
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(speakableJsonLd),
        }}
      />
    </main>
  )
}
