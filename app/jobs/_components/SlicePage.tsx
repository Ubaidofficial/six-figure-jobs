// app/jobs/_components/SlicePage.tsx

import Link from 'next/link'
import type { JobSlice } from '../../../lib/slices/types'
import type { JobQueryResult } from '../../../lib/jobs/queryJobs'
import JobList from '../../components/JobList'

type SliceForPage = JobSlice

type Props = {
  slice: SliceForPage
  data: JobQueryResult
}

export function SlicePage({ slice, data }: Props) {
  const { jobs, total, page, totalPages } = data

  const heading = slice.h1 || slice.title || defaultTitleFromSlug(slice.slug)
  const description =
    slice.description ||
    defaultDescriptionFromSlug(slice.slug, slice.filters?.minAnnual ?? null)

  const showingLabel = buildShowingLabel(total, slice.jobCount ?? null)

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
