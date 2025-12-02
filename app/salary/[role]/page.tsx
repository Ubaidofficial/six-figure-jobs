// app/salary/[role]/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '../../../lib/prisma'
import {
  queryJobs,
  type JobWithCompany,
} from '../../../lib/jobs/queryJobs'
import JobList from '../../components/JobList'
import type { Job } from '@prisma/client'

export const revalidate = 1800

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

const PAGE_SIZE = 50

type SearchParams = Record<string, string | string[] | undefined>

const BAND_MAP: Record<string, number> = {
  '100k-plus': 100_000,
  '200k-plus': 200_000,
  '300k-plus': 300_000,
  '400k-plus': 400_000,
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function resolveSearchParams(
  input?: SearchParams | Promise<SearchParams>,
): Promise<SearchParams> {
  if (!input) return {}
  if (typeof (input as any).then === 'function') {
    const resolved = (await input) || {}
    return resolved as SearchParams
  }
  return input as SearchParams
}

function parsePage(searchParams?: SearchParams): number {
  const raw = (searchParams?.page ?? '1') as string
  const n = Number(raw || '1') || 1
  return Math.max(1, n)
}

function prettyRole(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildPageHref(
  basePath: string,
  searchParams: SearchParams | undefined,
  page: number,
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

function formatMoney(value: number, currency = 'USD'): string {
  const sym = currency === 'USD' || !currency ? '$' : currency + ' '
  return (
    sym +
    value.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })
  )
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
  const { role } = await params
  const sp = searchParams ? await resolveSearchParams(searchParams) : {}
  const roleSlug = role
  const roleName = prettyRole(roleSlug)
  const bandSlug = typeof sp.band === 'string' ? sp.band : undefined
  const minAnnual =
    bandSlug && BAND_MAP[bandSlug] ? BAND_MAP[bandSlug] : 100_000
  const bandLabel =
    minAnnual >= 400_000
      ? '$400k+'
      : minAnnual >= 300_000
      ? '$300k+'
      : minAnnual >= 200_000
      ? '$200k+'
      : '$100k+'

  // Pull some salary stats for SEO description
  const raw = await prisma.job.findMany({
    where: {
      isExpired: false,
      roleSlug: roleSlug,
      OR: [
        { maxAnnual: { gte: BigInt(minAnnual) } },
        { minAnnual: { gte: BigInt(minAnnual) } },
        { isHundredKLocal: true },
      ],
    },
    select: {
      minAnnual: true,
      maxAnnual: true,
      currency: true,
    },
  })

  let description =
    `Explore ${roleName} salary data from ${bandLabel} tech jobs. ` +
    `See current ranges based on live ATS-powered job listings.`

  if (raw.length > 0) {
    const values: number[] = []
    for (const r of raw) {
      if (r.minAnnual != null) values.push(Number(r.minAnnual))
      if (r.maxAnnual != null) values.push(Number(r.maxAnnual))
    }
    if (values.length > 0) {
      values.sort((a, b) => a - b)
      const min = values[0]
      const max = values[values.length - 1]
      const mid = values[Math.floor(values.length / 2)]
      description =
        `${roleName} salary guide using live ${bandLabel} jobs. ` +
        `Typical base ranges from about ${formatMoney(
          min,
        )} to ${formatMoney(max)} / year, ` +
        `with a median around ${formatMoney(mid)} (based on ${
          raw.length
        } listings).`
    }
  }

  const allowIndex = raw.length >= 3
  const title = `${roleName} salary guide (${bandLabel}) | Six Figure Jobs`
  const canonical = `${SITE_URL}/salary/${roleSlug}${bandSlug ? `?band=${bandSlug}` : ''}`

  return {
    title,
    description,
    alternates: { canonical },
    robots: allowIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Remote100k',
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

type PageProps = {
  params: Promise<{ role: string }>
  searchParams?: SearchParams | Promise<SearchParams>
}

function StructuredData({
  jobs,
  roleName,
}: {
  jobs: (JobWithCompany | Job)[]
  roleName: string
}) {
  if (!jobs.length) return null
  const items = jobs.slice(0, 10).map((job) => ({
    '@type': 'JobPosting',
    title: job.title,
    description: job.descriptionHtml
      ? job.descriptionHtml.slice(0, 1000)
      : undefined,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company || job.companyRef?.name || 'Unknown company',
    },
    datePosted: job.postedAt || job.createdAt,
    employmentType: job.type || 'FULL_TIME',
    jobLocationType: job.remote === true ? 'TELECOMMUTE' : undefined,
    applicantLocationRequirements: job.remote === true ? 'REMOTE' : undefined,
    identifier: {
      '@type': 'PropertyValue',
      name: job.source,
      value: job.id,
    },
  }))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${roleName} job openings`,
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export default async function SalaryRolePage(props: PageProps) {
  const { role } = await props.params
  const sp = await resolveSearchParams(props.searchParams)
  const roleSlug = role
  const roleName = prettyRole(roleSlug)
  const page = parsePage(sp)
  const basePath = `/salary/${roleSlug}`
  const bandSlug = typeof sp.band === 'string' ? sp.band : undefined
  const minAnnual =
    bandSlug && BAND_MAP[bandSlug] ? BAND_MAP[bandSlug] : 100_000
  const bandLabel =
    minAnnual >= 400_000
      ? '$400k+'
      : minAnnual >= 300_000
      ? '$300k+'
      : minAnnual >= 200_000
      ? '$200k+'
      : '$100k+'

  // Live salary data for this role
  const raw = await prisma.job.findMany({
    where: {
      isExpired: false,
      roleSlug: roleSlug,
      OR: [
        { maxAnnual: { gte: BigInt(minAnnual) } },
        { minAnnual: { gte: BigInt(minAnnual) } },
        { isHundredKLocal: true },
      ],
    },
    select: {
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      countryCode: true,
    },
  })

  const values: number[] = []
  const byCountry: Record<string, number[]> = {}

  for (const r of raw) {
    const vMin = r.minAnnual != null ? Number(r.minAnnual) : null
    const vMax = r.maxAnnual != null ? Number(r.maxAnnual) : null
    const cc = r.countryCode || 'GLOBAL'

    if (vMin != null) {
      values.push(vMin)
      ;(byCountry[cc] ||= []).push(vMin)
    }
    if (vMax != null) {
      values.push(vMax)
      ;(byCountry[cc] ||= []).push(vMax)
    }
  }

  values.sort((a, b) => a - b)

  const statCount = values.length
  const statMin = statCount ? values[0] : null
  const statMax = statCount ? values[statCount - 1] : null
  const statMedian = statCount
    ? values[Math.floor(statCount / 2)]
    : null

  const totalListings = raw.length
  const allowIndex = totalListings >= 3

  // Jobs list for this role (live $100k+)
  const data = await queryJobs({
    roleSlugs: [roleSlug],
    minAnnual,
    page,
    pageSize: PAGE_SIZE,
  })

  const jobs = data.jobs as JobWithCompany[]
  const totalPages =
    data.total > 0
      ? Math.max(1, Math.ceil(data.total / PAGE_SIZE))
      : 1

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://six-figure-jobs.vercel.app'
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${siteUrl}/jobs/100k-plus` },
      { '@type': 'ListItem', position: 3, name: `${roleName} salary`, item: `${siteUrl}/salary/${roleSlug}` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How much does a ${roleName} make?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Live six-figure salary data for ${roleName} roles based on $100k+ job listings. Typical ranges update as new jobs are published.`,
        },
      },
      {
        '@type': 'Question',
        name: `Are remote or hybrid ${roleName} jobs included?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Listings are tagged remote, hybrid, or on-site, and remote roles include region filters (US-only, EMEA, APAC, global).',
        },
      },
      {
        '@type': 'Question',
        name: `Do you show local currencies?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'We normalize to USD for bands like $100k+, and display local currency when provided (e.g., CHF, GBP, EUR, CAD, AUD, SGD).',
        },
      },
    ],
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <StructuredData jobs={jobs} roleName={roleName} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* Breadcrumb */}
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
            {roleName} salary
          </li>
        </ol>
      </nav>

      {/* Header + stats */}
      <header className="mb-8 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-50">
          {roleName} salary guide
        </h1>
        <p className="max-w-2xl text-sm text-slate-300">
          Live six-figure salary ranges for {roleName.toLowerCase()} roles, based on verified $100k+ job listings from top tech and SaaS companies. Remote, hybrid, and on-site pay data—across USD and local currencies—updated regularly.
        </p>
        <p className="text-xs text-slate-400">
          Data freshness: updated from live $100k+ listings; thin pages stay noindex until more roles are available.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            <p className="text-xs text-slate-400">Median base salary</p>
            <p className="mt-2 text-xl font-semibold text-slate-50">
              {statMedian
                ? `${formatMoney(statMedian)}/yr`
                : 'Not enough data yet'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Calculated from live $100k+ job listings.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            <p className="text-xs text-slate-400">Typical range</p>
            <p className="mt-2 text-xl font-semibold text-slate-50">
              {statMin && statMax
                ? `${formatMoney(statMin)}–${formatMoney(
                    statMax,
                  )}/yr`
                : 'Not enough data yet'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Based on min / max ranges across all roles.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            <p className="text-xs text-slate-400">
              Sample size (live jobs)
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-50">
              {totalListings.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Only includes roles with $100k+ local base compensation.
            </p>
          </div>
        </div>
      </header>

      {/* Country breakdown (simple) */}
      {Object.keys(byCountry).length > 0 && (
        <section className="mb-8 space-y-3">
          <h2 className="text-sm font-semibold text-slate-50">
            Salary snapshot by country
          </h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(byCountry).map(([cc, arr]) => {
              arr.sort((a, b) => a - b)
              const cMin = arr[0]
              const cMax = arr[arr.length - 1]
              const cMed =
                arr[Math.floor(arr.length / 2)]
              return (
                <div
                  key={cc}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2"
                >
                  <p className="font-semibold text-slate-100">
                    {cc === 'GLOBAL' ? 'Global / unknown' : cc}
                  </p>
                  <p className="text-slate-300">
                    {formatMoney(cMed)} median ·{' '}
                    {formatMoney(cMin)}–{formatMoney(cMax)} range
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {arr.length} datapoints
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Job list */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-50">
          {roleName} job openings ({bandLabel})
        </h2>
        {!allowIndex && (
          <p className="text-xs text-amber-300">
            We’ll index this page once more live $100k+ {roleName.toLowerCase()} jobs are available. Check back soon.
          </p>
        )}

        {jobs.length === 0 ? (
          <p className="text-sm text-slate-400">
            No live $100k+ jobs for this role yet. Check back soon — new
            roles are imported from ATS job boards regularly.
          </p>
        ) : (
          <>
            <JobList jobs={jobs} />

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
                        page - 1,
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
                        page + 1,
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
      </section>
    </main>
  )
}
