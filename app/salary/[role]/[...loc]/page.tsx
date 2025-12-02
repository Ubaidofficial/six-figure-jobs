// app/salary/[role]/[...loc]/page.tsx
// Programmatic salary guides by role + country + optional city, band-aware.

import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '../../../../lib/prisma'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { formatSalaryBandLabel } from '../../../../lib/utils/salaryLabels'
import { formatNumberCompact } from '../../../../lib/utils/number'
import type { Job } from '@prisma/client'

export const revalidate = 1800

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

const PAGE_SIZE = 40

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

function formatMoney(value: number, currency = 'USD'): string {
  const sym = currency === 'USD' || !currency ? '$' : currency + ' '
  return (
    sym +
    value.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })
  )
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

function humanizeCountry(code?: string | null): string {
  if (!code) return ''
  const map: Record<string, string> = {
    US: 'United States',
    CA: 'Canada',
    GB: 'United Kingdom',
    IE: 'Ireland',
    DE: 'Germany',
    FR: 'France',
    ES: 'Spain',
    NL: 'Netherlands',
    SE: 'Sweden',
    NO: 'Norway',
    DK: 'Denmark',
    BE: 'Belgium',
    AT: 'Austria',
    FI: 'Finland',
    CH: 'Switzerland',
    SG: 'Singapore',
    AU: 'Australia',
    NZ: 'New Zealand',
  }
  return map[code.toUpperCase()] || code.toUpperCase()
}

function buildBandHref(
  basePath: string,
  sp: SearchParams | undefined,
  bandSlug: string,
): string {
  const params = new URLSearchParams()
  if (sp) {
    for (const [key, val] of Object.entries(sp)) {
      if (key === 'page') continue
      if (key === 'band') continue
      if (Array.isArray(val)) {
        val.forEach((v) => v != null && params.append(key, v))
      } else if (val != null) {
        params.set(key, val)
      }
    }
  }
  params.set('band', bandSlug)
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ role: string; loc?: string[] }>
  searchParams?: Promise<SearchParams>
}): Promise<Metadata> {
  const { role, loc = [] } = await params
  const sp = searchParams ? await resolveSearchParams(searchParams) : {}
  const roleSlug = role
  const roleName = prettyRole(roleSlug)
  const countryCode = loc[0]?.toUpperCase()
  const citySlug = loc[1]
  const locationLabel = citySlug
    ? `${prettyRole(citySlug)}, ${humanizeCountry(countryCode)}`
    : humanizeCountry(countryCode)

  const bandSlug = typeof sp.band === 'string' ? sp.band : undefined
  const minAnnual =
    bandSlug && BAND_MAP[bandSlug] ? BAND_MAP[bandSlug] : 100_000
  const bandLabel = formatSalaryBandLabel(minAnnual, countryCode)

  const title = `${roleName} salary in ${locationLabel || 'your region'}`
  const canonicalBase = `${SITE_URL}/salary/${roleSlug}${loc.length ? `/${loc.join('/')}` : ''}`
  const canonical = `${canonicalBase}${bandSlug ? `?band=${bandSlug}` : ''}`

  return {
    title,
    description: `Live ${roleName} salary data in ${locationLabel || 'top regions'} using verified ${bandLabel} tech jobs. Includes remote, hybrid, and on-site roles with real pay ranges.`,
    alternates: { canonical },
    openGraph: {
      title,
      description: `Median and range for ${roleName} in ${locationLabel || 'top regions'} using live ${bandLabel} job data.`,
      url: canonical,
      siteName: 'Remote100k',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: `Data-backed ${roleName} salary guide for ${locationLabel || 'top regions'} at ${bandLabel}.`,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

type PageProps = {
  params: Promise<{ role: string; loc?: string[] }>
  searchParams?: SearchParams | Promise<SearchParams>
}

export default async function SalaryRoleLocationPage(props: PageProps) {
  const { role, loc = [] } = await props.params
  const sp = await resolveSearchParams(props.searchParams)
  const roleSlug = role
  const roleName = prettyRole(roleSlug)
  const countryCode = loc[0]?.toUpperCase()
  const citySlug = loc[1] || null
  const locationLabel = citySlug
    ? `${prettyRole(citySlug)}, ${humanizeCountry(countryCode)}`
    : humanizeCountry(countryCode)
  const page = parsePage(sp)
  const basePath = `/salary/${roleSlug}${loc.length ? `/${loc.join('/')}` : ''}`
  const bandSlug = typeof sp.band === 'string' ? sp.band : undefined
  const minAnnual =
    bandSlug && BAND_MAP[bandSlug] ? BAND_MAP[bandSlug] : 100_000
  const bandLabel = formatSalaryBandLabel(minAnnual, countryCode)

  // Live salary data for this role+location
  const raw = await prisma.job.findMany({
    where: {
      isExpired: false,
      roleSlug: roleSlug,
      ...(countryCode ? { countryCode } : {}),
      ...(citySlug ? { citySlug } : {}),
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
    if (r.minAnnual != null) values.push(Number(r.minAnnual))
    if (r.maxAnnual != null) values.push(Number(r.maxAnnual))
    const cc = (r.countryCode || '').toUpperCase()
    if (!byCountry[cc]) byCountry[cc] = []
    if (r.minAnnual != null) byCountry[cc].push(Number(r.minAnnual))
    if (r.maxAnnual != null) byCountry[cc].push(Number(r.maxAnnual))
  }

  values.sort((a, b) => a - b)

  const median = values.length
    ? values[Math.floor(values.length / 2)]
    : null
  const minVal = values.length ? values[0] : null
  const maxVal = values.length ? values[values.length - 1] : null

  const countryStats = Object.entries(byCountry).map(([cc, vals]) => {
    vals.sort((a, b) => a - b)
    const med = vals[Math.floor(vals.length / 2)]
    return {
      country: cc,
      median: med,
      min: vals[0],
      max: vals[vals.length - 1],
      sample: vals.length,
    }
  })

  const jobsResult = await queryJobs({
    roleSlugs: [roleSlug],
    countryCode,
    citySlug: citySlug || undefined,
    minAnnual,
    page,
    pageSize: PAGE_SIZE,
  })

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-8 space-y-8">
      <StructuredData jobs={jobsResult.jobs} roleName={roleName} locationLabel={locationLabel} />
      <nav
        aria-label="Breadcrumb"
        className="text-xs text-slate-400"
      >
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-slate-200 hover:underline">
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
            {roleName} salary in {locationLabel || 'All regions'}
          </li>
        </ol>
      </nav>

      <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
              Salary guide · {bandLabel}
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-slate-50 md:text-3xl">
              {roleName} salary in {locationLabel || 'top regions'}
            </h1>
            <p className="max-w-3xl text-sm text-slate-300">
              Live salary signals from verified {bandLabel} roles. Remote, hybrid, and on-site jobs included; refreshed daily with $100k+ openings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-200">
            <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
              Sample size: {formatNumberCompact(raw.length)}
            </span>
            <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
              Verified companies
            </span>
            <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
              Updated daily
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
              Median base salary
            </p>
            <p className="text-xl font-semibold text-slate-50">
              {median ? formatMoney(median) + '/yr' : 'N/A'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
              Typical range
            </p>
            <p className="text-xl font-semibold text-slate-50">
              {minVal && maxVal
                ? `${formatMoney(minVal)}–${formatMoney(maxVal)}/yr`
                : 'N/A'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
              Salary band
            </p>
            <p className="text-xl font-semibold text-slate-50">{bandLabel}</p>
          </div>
        </div>
      </header>

      {/* Band switcher */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-50">
          Salary bands
        </h2>
        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          {Object.keys(BAND_MAP).map((slug) => (
            <Link
              key={slug}
              href={buildBandHref(basePath, sp, slug)}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 ${
                bandSlug === slug || (!bandSlug && slug === '100k-plus')
                  ? 'border-blue-500 bg-blue-600/20 text-blue-100'
                  : 'border-slate-800 bg-slate-900 hover:border-slate-600'
              }`}
            >
              {formatSalaryBandLabel(BAND_MAP[slug], countryCode)}
            </Link>
          ))}
        </div>
      </section>

      {/* Country snapshots */}
      {countryStats.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-50">
            Salary snapshot by country
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {countryStats.map((stat) => (
              <div
                key={stat.country}
                className="rounded-xl bg-slate-900/60 p-3 text-sm text-slate-200"
              >
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                  {humanizeCountry(stat.country)}
                </p>
                <p className="text-base font-semibold text-slate-50">
                  {formatMoney(stat.median)}/yr median
                </p>
                <p className="text-xs text-slate-400">
                  {formatMoney(stat.min)}–{formatMoney(stat.max)} range · {stat.sample} datapoints
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Job list */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-50">
          {roleName} job openings in {locationLabel || 'top regions'}
        </h2>
        <JobList jobs={jobsResult.jobs as JobWithCompany[]} />
      </section>

      {/* Pagination */}
      {jobsResult.totalPages > 1 && (
        <nav className="flex items-center justify-between text-xs text-slate-300">
          <span>
            Page {page} of {jobsResult.totalPages}
          </span>
          <div className="space-x-2">
            {page > 1 && (
              <Link
                href={buildPageHref(basePath, sp, page - 1)}
                className="rounded-full border border-slate-700 px-3 py-1 hover:border-slate-500"
              >
                Previous
              </Link>
            )}
            {page < jobsResult.totalPages && (
              <Link
                href={buildPageHref(basePath, sp, page + 1)}
                className="rounded-full border border-slate-700 px-3 py-1 hover:border-slate-500"
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </main>
  )
}

function StructuredData({
  jobs,
  roleName,
  locationLabel,
}: {
  jobs: (JobWithCompany | Job)[]
  roleName: string
  locationLabel: string | null
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
      name:
        job.company ||
        (job as any).companyRef?.name ||
        'Unknown company',
    },
    datePosted: job.postedAt || job.createdAt,
    employmentType: job.type || 'FULL_TIME',
    jobLocationType: job.remote === true ? 'TELECOMMUTE' : undefined,
    applicantLocationRequirements: job.remote === true ? 'REMOTE' : undefined,
    jobLocation: job.countryCode
      ? {
          '@type': 'Country',
          addressCountry: job.countryCode,
        }
      : undefined,
    identifier: {
      '@type': 'PropertyValue',
      name: job.source,
      value: job.id,
    },
  }))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${roleName} job openings${locationLabel ? ` in ${locationLabel}` : ''}`,
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
