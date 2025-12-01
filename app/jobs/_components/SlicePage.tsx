// app/jobs/_components/SlicePage.tsx

import Link from 'next/link'
import type { JobSlice } from '../../../lib/slices/types'
import type { JobQueryResult } from '../../../lib/jobs/queryJobs'
import JobList from '../../components/JobList'
import { TARGET_COUNTRIES } from '../../../lib/seo/regions'
import { buildJobSlugHref } from '../../../lib/jobs/jobSlug'
import { formatNumberCompact } from '../../../lib/utils/number'
import { formatSalaryBandLabel } from '../../../lib/utils/salaryLabels'

type SliceForPage = JobSlice

type Props = {
  slice: SliceForPage
  data: JobQueryResult
}

export function SlicePage({ slice, data }: Props) {
  const { jobs, total, page, totalPages } = data
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://six-figure-jobs.vercel.app'

  const roleSlug = slice.filters?.roleSlugs?.[0]
  const countryCode = (slice.filters as any)?.countryCode || (slice.filters as any)?.country
  const minAnnual = slice.filters?.minAnnual ?? null
  const allowIndex = total >= 3
  const countryLabel =
    TARGET_COUNTRIES.find((c) => c.code.toLowerCase() === (countryCode ?? '').toLowerCase())?.label ||
    countryCode ||
    null
  const heading = slice.h1 || slice.title || defaultTitleFromSlug(slice.slug)
  const description =
    slice.description ||
    defaultDescriptionFromSlug(slice.slug, slice.filters?.minAnnual ?? null, countryLabel)

  const showingLabel = buildShowingLabel(total, slice.jobCount ?? null)
  const salaryBand = formatSalaryBandLabel(minAnnual ?? 100_000, countryCode)
  const roleLabel = roleSlug ? prettyRole(roleSlug) : null

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

  const relatedSalaryBands = [100_000, 200_000, 300_000, 400_000]

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${siteUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '$100k+ jobs',
        item: `${siteUrl}/jobs/100k-plus`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: heading,
        item: `${siteUrl}${slice.slug.startsWith('/') ? slice.slug : `/${slice.slug}`}`,
      },
    ],
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: jobs.slice(0, 20).map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteUrl}${buildJobSlugHref(job)}`,
      name: job.title,
    })),
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* JSON-LD for breadcrumbs and list */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span>/</span>
        <Link href="/jobs/100k-plus" className="hover:underline">
          $100k+ jobs
        </Link>
        <span>/</span>
        <span className="text-slate-200">{heading}</span>
      </nav>

      {/* Hero */}
      <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-tight text-slate-50 md:text-3xl">
              {heading}
            </h1>
            {description && (
              <p className="max-w-3xl text-sm text-slate-300">
                {description}
              </p>
            )}
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-200">
              <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
                {showingLabel || `${formatNumberCompact(total)} roles`}
              </span>
              <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
                Verified companies
              </span>
              <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
                Updated daily
              </span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href="#jobs"
              className="inline-flex flex-1 items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500"
            >
              Browse $100k+ jobs
            </Link>
            <Link
              href="/jobs/100k-plus"
              className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500"
            >
              View all $100k+ →
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
        <p>
          {roleLabel ? `Verified ${salaryBand} ${roleLabel.toLowerCase()}` : `Verified ${salaryBand} tech`} roles
          {countryLabel ? ` in ${countryLabel}` : ''}. Remote, hybrid, and on-site options from ATS feeds and trusted boards,
          refreshed daily and ranked by salary.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Need another region? Explore remote-only roles, adjacent cities, or sibling salary bands below.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-200">
          {countryCode && roleSlug && (
            <Link
              href={`/jobs/${roleSlug}/remote/${(slice.filters as any)?.remoteRegion || '100k-plus'}`}
              className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 hover:border-slate-600"
            >
              🌎 Remote {roleLabel} roles
            </Link>
          )}
          {roleSlug && (
            <Link
              href={`/jobs/${roleSlug}/remote/${(slice.filters as any)?.remoteRegion || '100k-plus'}`}
              className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 hover:border-slate-600"
            >
              Remote regions →
            </Link>
          )}
        </div>
      </section>

      {/* Job list */}
      <section id="jobs" className="scroll-mt-20">
        {!allowIndex && (
          <p className="mb-3 text-xs text-amber-300">
            We’ll index this page once more live $100k+ jobs are available in this slice.
          </p>
        )}
        {jobs.length === 0 ? (
          <p className="py-6 text-sm text-slate-400">
            No jobs found for this slice yet. Try another salary band or region below.
          </p>
        ) : (
          <JobList jobs={jobs} />
        )}
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-xs text-slate-300">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="space-x-2">
            {page > 1 && (
              <Link
                href={`?page=${page - 1}`}
                className="rounded-full border border-slate-700 px-3 py-1 hover:border-slate-500 hover:text-slate-100"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`?page=${page + 1}`}
                className="rounded-full border border-slate-700 px-3 py-1 hover:border-slate-500 hover:text-slate-100"
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      )}

      {relatedSalaryBands.length > 0 && (
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-50">
          Explore salary bands
        </h2>
        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          {relatedSalaryBands.map((band) => {
            const slug =
              band === 100_000
                ? '100k-plus'
                : band === 200_000
                ? '200k-plus'
                : band === 300_000
                ? '300k-plus'
                : '400k-plus'
            const basePath = roleSlug
              ? countryCode
                ? `/jobs/${roleSlug}/${countryCode}/${slug}`
                : (slice.filters as any)?.remoteOnly || (slice.filters as any)?.remoteRegion
                ? `/jobs/${roleSlug}/remote/${slug}`
                : `/jobs/${roleSlug}/${slug}`
              : countryCode
              ? `/jobs/${countryCode}/${slug}`
              : `/jobs/${slug}`

            return (
              <Link
                key={band}
                href={basePath}
                className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 hover:border-slate-600"
              >
                💵 {formatSalaryBandLabel(band, countryCode)}
              </Link>
            )
          })}
        </div>
      </section>
      )}

      {topCompanies.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-50">
            Top companies hiring {roleLabel ? roleLabel : 'for these roles'}
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

      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          FAQs about {roleLabel ? `${roleLabel} roles` : 'high-paying tech roles'} paying {salaryBand}
        </h2>
        <div className="space-y-3 text-sm text-slate-300">
          {buildFaqs(roleLabel, countryLabel, salaryBand).map((item) => (
            <div key={item.q}>
              <p className="font-semibold text-slate-100">{item.q}</p>
              <p className="text-slate-300">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {jobs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function defaultTitleFromSlug(slug: string): string {
  const clean = slug.replace(/^\/+|\/+$/g, '')
  const parts = clean.split('/')

  // Drop the leading "jobs" part if present
  const main = parts[0] === 'jobs' ? parts.slice(1) : parts

  const title = main
    .join(' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  if (!title) return 'Tech jobs'

  // Special-case salary-first slugs like "100k Plus Jobs"
  if (/\d+k/.test(title)) {
    return `Tech Jobs Paying ${title.replace(/\s+Jobs?$/i, '')}`
  }

  return `${title} Jobs`
}

function defaultDescriptionFromSlug(
  slug: string,
  minAnnual: number | null,
  countryLabel: string | null
): string | null {
  const clean = slug.replace(/^\/+|\/+$/g, '')
  const parts = clean.split('/').filter(Boolean)

  const salaryBand = (() => {
    if (!minAnnual) return '$100k+'
    if (minAnnual >= 400_000) return '$400k+'
    if (minAnnual >= 300_000) return '$300k+'
    if (minAnnual >= 200_000) return '$200k+'
    return '$100k+'
  })()

  const loc = countryLabel ? ` in ${countryLabel}` : ''
  return `Browse verified ${salaryBand} roles${loc}, including remote and hybrid options, refreshed daily from ATS and trusted boards.`
}

function buildShowingLabel(total: number, sliceJobCount: number | null): string | null {
  if (!total && !sliceJobCount) return null

  if (sliceJobCount != null && sliceJobCount > 0) {
    return `Showing ${total} of ${sliceJobCount} jobs in this slice.`
  }

  if (total > 0) {
    return `Showing ${total} jobs in this slice.`
  }

  return null
}

function prettyRole(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildFaqs(
  roleLabel: string | null,
  countryLabel: string | null,
  salaryBand: string,
) {
  const roleText = roleLabel ? roleLabel.toLowerCase() : 'tech'
  const regionText = countryLabel ? ` in ${countryLabel}` : ''
  return [
    {
      q: `Are these ${roleText} jobs${regionText} really ${salaryBand}?`,
      a: `Yes. We include roles with published or inferred compensation of ${salaryBand} (or local equivalent) from ATS feeds and vetted boards, and demote lowball ranges.`,
    },
    {
      q: `Do you include remote or hybrid ${roleText} roles${regionText}?`,
      a: 'Yes. Every listing is tagged as remote, hybrid, or on-site. Use the filters to focus on flexible roles.',
    },
    {
      q: `How fresh are these ${roleText} listings${regionText}?`,
      a: 'We refresh ATS sources daily, expire stale jobs, and rank the newest high-paying openings first.',
    },
  ]
}
