// app/remote/[role]/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '../../../lib/prisma'
import {
  queryJobs,
  type JobWithCompany,
} from '../../../lib/jobs/queryJobs'
import { buildJobSlugHref } from '../../../lib/jobs/jobSlug'
import JobList from '../../components/JobList'
import { SITE_NAME, getSiteUrl } from '../../../lib/seo/site'

export const revalidate = 300

const SITE_URL = getSiteUrl()

const PAGE_SIZE = 20

type SearchParams = Record<string, string | string[] | undefined>

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function resolveSearchParams(
  searchParams?: Promise<SearchParams>
): Promise<SearchParams> {
  return (await searchParams) || {}
}

function parsePage(sp: SearchParams): number {
  const raw = (sp.page ?? '1') as string
  const n = Number(raw || '1') || 1
  return Math.max(1, n)
}

function buildCanonicalPath(roleSlug: string, page: number) {
  const base = `/remote/${roleSlug}`
  return page > 1 ? `${base}?page=${page}` : base
}

function buildRequestedPath(roleSlug: string, sp: SearchParams) {
  const base = `/remote/${roleSlug}`
  const params = new URLSearchParams()
  const page = parsePage(sp)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `${base}?${query}` : base
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
  updates: Partial<{ country: string | null; min: number; remoteRegion: string | null }>
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

function faqItems(roleName: string) {
  const lower = roleName.toLowerCase()
  return [
    {
      q: `Are these remote ${lower} jobs really $100k+?`,
      a: 'Yes. We only include roles with published or inferred compensation at $100k+ (or local equivalent) from ATS feeds and trusted boards.',
    },
    {
      q: `How often do you refresh remote ${lower} jobs?`,
      a: 'We refresh ATS sources daily, expire stale listings, and prioritize the newest high-paying openings.',
    },
    {
      q: `Do you include hybrid/onsite ${lower} roles?`,
      a: 'This page focuses on remote. For hybrid/onsite, use role pages or the work-arrangement filter in search.',
    },
  ]
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
  params: Promise<{ role: string }>
  searchParams?: Promise<SearchParams>
}): Promise<Metadata> {
  const p = await params
  const sp = await resolveSearchParams(searchParams)

  const roleSlug = p.role
  const roleName = prettyRole(roleSlug)
  const page = parsePage(sp)
  const requestedPath = buildRequestedPath(roleSlug, sp)
  const canonicalPath = buildCanonicalPath(roleSlug, page)
  if (requestedPath !== canonicalPath) {
    redirect(canonicalPath)
  }

  const selectedCountry = normalizeStringParam(sp.country)
  const selectedRegion = normalizeStringParam(sp.remoteRegion)
  const minParam = normalizeStringParam(sp.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : 100_000

  const result = await queryJobs({
    roleSlugs: [roleSlug],
    countryCode: selectedCountry || undefined,
    remoteRegion: selectedRegion || undefined,
    minAnnual,
    page,
    pageSize: 1,
  })

  const totalJobs = result.total
  const allowIndex = totalJobs >= 3

  const baseTitle = `Remote ${roleName} jobs paying $100k+`
  const title =
    totalJobs > 0
      ? `${baseTitle} (${totalJobs.toLocaleString()} roles) | ${SITE_NAME}`
      : `${baseTitle} | ${SITE_NAME}`

  const description = `Search remote ${roleName} jobs paying $100k+ across top tech and SaaS companies. Filter by country, remote region, and salary band.`

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/remote/${roleSlug}`,
    },
    robots: allowIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/remote/${roleSlug}`,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
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
  params: Promise<{ role: string }>
  searchParams?: Promise<SearchParams>
}) {
  const p = await params
  const sp = await resolveSearchParams(searchParams)

  const roleSlug = p.role
  const roleName = prettyRole(roleSlug)
  const page = parsePage(sp)
  const basePath = `/remote/${roleSlug}`

  const selectedCountry = normalizeStringParam(sp.country)
  const selectedRegion = normalizeStringParam(sp.remoteRegion)
  const minParam = normalizeStringParam(sp.min)
  const minAnnual =
    minParam && !Number.isNaN(Number(minParam))
      ? Math.max(100_000, Number(minParam))
      : 100_000

  const data = await queryJobs({
    roleSlugs: [roleSlug],
    countryCode: selectedCountry || undefined,
    remoteRegion: selectedRegion || undefined,
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
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems(roleName).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  const speakableJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SpeakableSpecification',
    cssSelector: ['main h1', '[data-speakable="summary"]'],
  }

  const availableCountries = Array.from(
    new Set(
      jobs
        .map((j) => j.countryCode)
        .filter((c): c is string => Boolean(c))
    )
  )

  const salaryOptions = [100_000, 150_000, 200_000]

  const companyCounts = new Map<string, { name: string; count: number; slug?: string | null }>()
  jobs.forEach((job: any) => {
    const key = job.companyId || job.company || job.companyRef?.name
    if (!key) return
    const existing =
      companyCounts.get(key) ?? {
        name: job.companyRef?.name ?? job.company,
        count: 0,
        slug: job.companyRef?.slug ?? null,
      }
    existing.count += 1
    companyCounts.set(key, existing)
  })
  const topCompanies = Array.from(companyCounts.values())
    .filter((c) => !!c.name)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

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
          Remote {roleName} jobs paying $100k+ ({data.total.toLocaleString()})
        </h1>
        <p
          className="text-sm text-slate-300"
          data-speakable="summary"
        >
          Find remote and flexible {roleName} roles paying at least
          $100k in local currency. Filter by country, remote region,
          and salary band.
        </p>
        <ul className="grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            Salary-first: $100k+ compensation only, verified from ATS/boards.
          </li>
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            Eligibility clarity: remote region filters (global, US-only, EMEA, APAC) and country tags.
          </li>
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            Fresh listings: stale roles expire automatically to avoid dead applies.
          </li>
        </ul>
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

          {/* Remote region filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Remote region:</span>
            {['', 'global', 'us-only', 'canada', 'emea', 'apac', 'uk-ireland'].map((slug) => {
              const label =
                slug === ''
                  ? 'Any'
                  : slug === 'global'
                  ? 'Global'
                  : slug === 'us-only'
                  ? 'US only'
                  : slug === 'canada'
                  ? 'Canada'
                  : slug === 'emea'
                  ? 'EMEA'
                  : slug === 'apac'
                  ? 'APAC'
                  : 'UK & Ireland'
              return (
                <Link
                  key={slug || 'any'}
                  href={buildFilterHref(basePath, sp, {
                    remoteRegion: slug || null,
                  })}
                  className={`rounded-full px-2 py-1 ${
                    (selectedRegion || '') === slug
                      ? 'bg-slate-200 text-slate-900'
                      : 'bg-slate-900 text-slate-200'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
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

      <section className="mb-6 space-y-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold text-slate-50">
          Explore related high-paying pages
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-blue-300">
          <li>
            <Link href={`/jobs/100k-plus/${roleSlug}`} className="hover:underline">
              $100k+ {roleName} jobs →
            </Link>
          </li>
          <li>
            <Link href={`/jobs/200k-plus/${roleSlug}`} className="hover:underline">
              $200k+ {roleName} jobs →
            </Link>
          </li>
          <li>
            <Link href={`/salary/${roleSlug}`} className="hover:underline">
              {roleName} salary guide →
            </Link>
          </li>
          <li>
            <Link href={`/jobs/${roleSlug}/100k-plus`} className="hover:underline">
              On-site & hybrid {roleName} jobs ($100k+) →
            </Link>
          </li>
        </ul>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
        <p>
          Browse verified $100k+ remote {roleName.toLowerCase()} roles from ATS feeds and trusted boards.
          We refresh daily and rank by salary first, so you see the strongest offers across regions.
        </p>
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

      {topCompanies.length > 0 && (
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-50">
            Top companies hiring remote {roleName}
          </h2>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            {topCompanies.map((c) => (
              <Link
                key={`${c.name}-${c.slug ?? ''}`}
                href={c.slug ? `/company/${c.slug}` : '#'}
                className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 hover:border-slate-600"
              >
                <span className="font-semibold text-slate-100">{c.name}</span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
                  {c.count} roles
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-sm font-semibold text-slate-50">
          FAQs about remote {roleName} jobs paying $100k+
        </h2>
        <div className="space-y-3 text-sm text-slate-300">
          {faqItems(roleName).map((item) => (
            <div key={item.q}>
              <p className="font-semibold text-slate-100">{item.q}</p>
              <p className="text-slate-300">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

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
