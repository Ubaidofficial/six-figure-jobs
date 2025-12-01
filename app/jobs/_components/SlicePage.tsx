// app/jobs/_components/SlicePage.tsx

import Link from 'next/link'
import type { JobSlice } from '../../../lib/slices/types'
import type { JobQueryResult } from '../../../lib/jobs/queryJobs'
import JobList from '../../components/JobList'
import { TARGET_COUNTRIES } from '../../../lib/seo/regions'
import { buildJobSlugHref } from '../../../lib/jobs/jobSlug'

type SliceForPage = JobSlice

type Props = {
  slice: SliceForPage
  data: JobQueryResult
}

export function SlicePage({ slice, data }: Props) {
  const { jobs, total, page, totalPages } = data
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://six-figure-jobs.vercel.app'

  const heading = slice.h1 || slice.title || defaultTitleFromSlug(slice.slug)
  const description =
    slice.description ||
    defaultDescriptionFromSlug(slice.slug, slice.filters?.minAnnual ?? null)

  const showingLabel = buildShowingLabel(total, slice.jobCount ?? null)

  const roleSlug = slice.filters?.roleSlugs?.[0]
  const countryCode = (slice.filters as any)?.countryCode || (slice.filters as any)?.country
  const minAnnual = slice.filters?.minAnnual ?? null
  const countryLabel =
    TARGET_COUNTRIES.find((c) => c.code.toLowerCase() === (countryCode ?? '').toLowerCase())?.label ||
    countryCode ||
    null
  const salaryBand =
    minAnnual && minAnnual >= 400_000
      ? '$400k+'
      : minAnnual && minAnnual >= 300_000
      ? '$300k+'
      : minAnnual && minAnnual >= 200_000
      ? '$200k+'
      : '$100k+'
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
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-50">
          {heading}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-slate-300">
            {description}
          </p>
        )}

        {showingLabel && (
          <p className="text-xs text-slate-400">
            {showingLabel}
          </p>
        )}
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
        <p>
          {roleLabel ? `Verified ${salaryBand} ${roleLabel.toLowerCase()}` : `Verified ${salaryBand} tech`} roles
          {countryLabel ? ` in ${countryLabel}` : ''}. Remote, hybrid, and on-site options from ATS feeds and trusted boards,
          refreshed daily and ranked by salary.
        </p>
      </section>

      {/* Job list */}
      <section>
        <JobList jobs={jobs} />

        {jobs.length === 0 && (
          <p className="py-6 text-sm text-slate-400">
            No jobs found for this slice yet.
          </p>
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
                  💵 {band >= 1000 ? `$${band / 1000}k+` : `$${band}+`}
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
  minAnnual: number | null
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

  // Very simple heuristics – we only care about the salary band text.
  return `Browse tech jobs paying ${salaryBand} at top companies worldwide.`
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
