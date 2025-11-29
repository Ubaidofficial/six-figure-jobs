// app/components/JobList.tsx

import Link from 'next/link'
import type { ReactNode } from 'react'
import { buildJobSlugHref } from '../../lib/jobs/jobSlug'

export type JobListProps = {
  jobs: any[] // expects JobWithCompany (from queryJobs)
}

/**
 * Job list used on the homepage and slice pages.
 */
export default function JobList({ jobs }: JobListProps) {
  if (!jobs || jobs.length === 0) {
    return (
      <p className="py-6 text-sm text-slate-400">
        No jobs found yet. Try again soon — we&apos;re still ingesting
        feeds.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {jobs.map((job: any) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Card                                     */
/* -------------------------------------------------------------------------- */

function JobCard({ job }: { job: any }) {
  const companyName =
    job.companyRef?.name ?? job.company ?? 'Unknown company'
  const logo =
    job.companyRef?.logoUrl ?? job.companyLogo ?? null
  const companySlug = job.companyRef?.slug
  const companySize = job.companyRef?.sizeBucket || null
  const companyTags = parseJsonArray(job.companyRef?.tagsJson)

  const location = job.remote ? 'Remote' : buildLocation(job)
  const salaryText = buildSalaryText(job)
  const snippet = buildSnippet(job)
  const seniority = inferSeniorityFromTitle(job.title)
  const category = inferCategoryFromRoleSlug(job.roleSlug)
  const remoteMode = getRemoteMode(job)
  const postedLabel = job.postedAt
    ? `Posted ${new Date(job.postedAt).toLocaleDateString()}`
    : null

  const benefits = parseJsonArray(job.benefitsJson).slice(0, 3)

  return (
    <article className="group rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4 shadow-sm transition hover:border-slate-500/80 hover:bg-slate-900/80">
      <div className="flex gap-4">
        {/* Logo */}
        <div className="mt-1 flex-shrink-0">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={companyName}
              className="h-10 w-10 rounded-full bg-slate-900 object-contain p-1"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-slate-300">
              {companyName?.charAt(0) ?? '?'}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Title + company row */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-slate-50 group-hover:text-slate-100">
                <Link href={buildJobSlugHref(job)}>
                  {job.title}
                </Link>
              </h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                {companySlug ? (
                  <Link
                    href={`/company/${companySlug}`}
                    className="font-medium hover:underline"
                  >
                    {companyName}
                  </Link>
                ) : (
                  <span className="font-medium">
                    {companyName}
                  </span>
                )}

                {companySize && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300">
                      {companySize} employees
                    </span>
                  </>
                )}

                {companyTags.length > 0 && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="flex flex-wrap gap-1">
                      {companyTags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Company actions */}
            <div className="flex flex-col items-end gap-2 text-xs">
              {postedLabel && (
                <span className="text-[11px] text-slate-400">
                  {postedLabel}
                </span>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {job.companyRef?.website && (
                  <a
                    href={job.companyRef.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-100 hover:border-slate-500"
                  >
                    Website
                  </a>
                )}
                {companySlug && (
                  <Link
                    href={`/company/${companySlug}`}
                    className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-100 hover:border-slate-500"
                  >
                    All job openings
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Badges row */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            {location && (
              <Badge>
                📍 {location}
              </Badge>
            )}

            {remoteMode && (
              <Badge>
                🌎 {remoteMode}
              </Badge>
            )}

            {job.type && (
              <Badge>
                ⏱️ {job.type}
              </Badge>
            )}

            {category && (
              <Badge>
                {category}
              </Badge>
            )}

            {seniority && (
              <Badge>
                {seniority}
              </Badge>
            )}

            {salaryText && (
              <Badge highlight>
                💵 {salaryText}
              </Badge>
            )}

            {benefits.map((benefit) => (
              <Badge key={benefit}>
                🎁 {benefit}
              </Badge>
            ))}
          </div>

          {/* Snippet */}
          {snippet && (
            <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-slate-300">
              {snippet}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Badge                                    */
/* -------------------------------------------------------------------------- */

function Badge({
  children,
  strong,
  highlight,
}: {
  children: ReactNode
  strong?: boolean
  highlight?: boolean
}) {
  let classes =
    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 ring-1 text-[11px]'

  if (highlight) {
    // salary highlight → green
    classes +=
      ' bg-emerald-500/15 text-emerald-200 ring-emerald-500/60 font-semibold'
  } else if (strong) {
    classes +=
      ' bg-slate-900 text-slate-50 ring-slate-500 font-semibold'
  } else {
    classes += ' bg-slate-900 text-slate-300 ring-slate-700'
  }

  return <span className={classes}>{children}</span>
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function buildSalaryText(job: any): string | null {
  // Accept BigInt or number
  const rawMin = job.minAnnual
  const rawMax = job.maxAnnual

  let min =
    rawMin !== null && rawMin !== undefined
      ? Number(rawMin)
      : null
  let max =
    rawMax !== null && rawMax !== undefined
      ? Number(rawMax)
      : null

  // Drop zero / negative / non-finite values
  if (min !== null && (!Number.isFinite(min) || min <= 0)) min = null
  if (max !== null && (!Number.isFinite(max) || max <= 0)) max = null

  // Guard against obviously broken data (e.g. 62,400,000k etc)
  const tooLarge =
    (min !== null && min > 2_000_000) ||
    (max !== null && max > 2_000_000)

  if (tooLarge) {
    min = null
    max = null
  }

  const sym =
    job.currency === 'USD' || !job.currency
      ? '$'
      : job.currency + ' '

  const fmt = (v: number) => `${Math.round(v / 1000)}k`

  // Range
  if (min !== null && max !== null) {
    if (min === max) {
      return `${sym}${fmt(min)}`
    }
    return `${sym}${fmt(min)}–${fmt(max)}`
  }

  // Min only → "Xk+"
  if (min !== null) {
    return `${sym}${fmt(min)}+`
  }

  // Max only → "up to Xk"
  if (max !== null) {
    return `up to ${sym}${fmt(max)}`
  }

  // Fallback: raw salary text from boards (truncated + cleaned)
  if (job.salaryRaw) {
    const text = truncateText(
      stripTags(decodeHtmlEntities(String(job.salaryRaw))),
      60
    )
    if (text.trim().length > 0) {
      return text
    }
  }

  // If no salary data, return null (don't show badge)
  return null
}


function buildLocation(job: any): string | null {
  if (job.city && job.countryCode)
    return `${job.city}, ${String(job.countryCode).toUpperCase()}`
  if (job.countryCode)
    return String(job.countryCode).toUpperCase()
  if (job.locationRaw) return String(job.locationRaw)
  return null
}

function buildSnippet(job: any): string | null {
  const raw =
    (job.snippet as string | null | undefined) ??
    (job.descriptionHtml as string | null | undefined) ??
    null

  if (!raw) return null

  return truncateText(
    stripTags(decodeHtmlEntities(raw)),
    160
  )
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripTags(str: string): string {
  return str.replace(/<\/?[^>]+(>|$)/g, '')
}

function truncateText(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str
  const truncated = str.slice(0, maxChars)
  const lastDot = truncated.lastIndexOf('.')
  const lastSpace = truncated.lastIndexOf(' ')
  const cutoff =
    lastDot > maxChars * 0.6
      ? lastDot + 1
      : lastSpace > 0
      ? lastSpace
      : maxChars
  return truncated.slice(0, cutoff) + ' …'
}

function inferSeniorityFromTitle(title: string): string | null {
  const t = title.toLowerCase()

  if (t.includes('intern')) return '🧑‍🎓 Internship'
  if (t.includes('principal') || t.includes('staff'))
    return '⭐ Staff / Principal'
  if (t.includes('lead') || t.includes('head'))
    return '⭐ Lead'
  if (t.includes('senior') || t.includes('sr'))
    return '⭐ Senior'
  if (t.includes('junior') || t.includes('jr'))
    return '🌱 Junior'

  return null
}

function inferCategoryFromRoleSlug(
  roleSlug?: string | null
): string | null {
  if (!roleSlug) return null
  const s = roleSlug.toLowerCase()

  if (s.includes('data')) return '📊 Data'
  if (s.includes('ml') || s.includes('machine-learning'))
    return '🤖 ML / AI'
  if (s.includes('engineer') || s.includes('developer'))
    return '💻 Engineering'
  if (s.includes('product')) return '🧭 Product'
  if (s.includes('design')) return '🎨 Design'
  if (s.includes('ops') || s.includes('operations'))
    return '⚙️ Operations'
  if (s.includes('sales')) return '💼 Sales'
  if (s.includes('marketing')) return '📣 Marketing'
  if (s.includes('legal') || s.includes('counsel'))
    return '⚖️ Legal'

  return null
}

function getRemoteMode(job: any): string | null {
  const mode = job.remoteMode as
    | 'remote'
    | 'hybrid'
    | 'onsite'
    | null
    | undefined

  if (mode === 'remote') return 'Remote'
  if (mode === 'hybrid') return 'Hybrid'
  if (mode === 'onsite') return 'On-site'

  if (job.remote === true) return 'Remote'
  return null
}

function parseJsonArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x) => typeof x === 'string')
        .map((x) => x as string)
    }
  } catch {
    return []
  }
  return []
}
