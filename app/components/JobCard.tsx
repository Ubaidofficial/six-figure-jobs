// app/components/JobCard.tsx

'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { buildJobSlugHref } from '../../lib/jobs/jobSlug'
import type { JobWithCompany } from '../../lib/jobs/queryJobs'
import { buildSalaryText } from '../../lib/jobs/salary' // ← unified helper
import { formatRelativeTime } from '../../lib/utils/time'
import { buildLogoUrl } from '../../lib/companies/logo'

/** Extend queryJobs result with UI-only optional fields */
export type JobCardJob = JobWithCompany & {
  snippet?: string | null
  description?: string | null
  benefitsJson?: string | null
  postedAt?: string | Date | null
  requirementsJson?: string | null
  techStack?: string | null
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function JobCard({ job }: { job: JobCardJob }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const companyName =
    job.companyRef?.name ?? job.company ?? 'Unknown company'
  const companyInitials = companyName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isFeatured =
    Boolean((job as any)?.featured) ||
    (job as any)?.featureExpiresAt
      ? new Date((job as any).featureExpiresAt).getTime() > Date.now()
      : false

  // Prefer DB logo first, fallback to Clearbit from website
  // Stronger logo fallback: prefer stored logo → Clearbit/logo.dev → initials
  const logo = buildLogoUrl(
    job.companyRef?.logoUrl ?? job.companyLogo ?? null,
    job.companyRef?.website ?? null,
  )
  const showLogo = logo && !logoFailed

  const companySlug = job.companyRef?.slug ?? null
  const companySize = job.companyRef?.sizeBucket || null
  const companyTags = parseJsonArray(job.companyRef?.tagsJson)
  const companyDesc = getCompanyBlurb(job.companyRef?.description)

  const location = buildLocation(job)
  const salaryText = buildSalaryText(job) // ← UNIFIED salary logic
  const salaryDisplay =
    salaryText &&
    /\d/.test(salaryText) &&
    !salaryText.includes('<') &&
    isReasonableSalary(job)
      ? salaryText
      : null
  const snippet = buildSnippet(job, companyDesc)

  const seniority = inferSeniorityFromTitle(job.title)
  const category = inferCategoryFromRoleSlug(job.roleSlug)
  const remoteMode = getRemoteMode(job)

  const postedLabel = formatRelativeTime(
    job.postedAt ?? job.createdAt ?? job.updatedAt ?? null,
  )
  const isNew =
    !!(job.postedAt ?? job.createdAt) &&
    Date.now() - new Date(job.postedAt ?? job.createdAt as any).getTime() < 1000 * 60 * 60 * 48

  const techStack = parseJsonArray(job.techStack).slice(0, 3)

  return (
    <article
      className={`group relative rounded-3xl border p-5 transition-all duration-200 focus-within:ring-2 focus-within:ring-emerald-400/70 focus-within:ring-offset-2 focus-within:ring-offset-background ${
        isFeatured
          ? 'border-amber-400/50 bg-slate-950/55 ring-1 ring-amber-300/20 hover:-translate-y-0.5 hover:border-amber-300/60 hover:shadow-[0_18px_60px_rgba(251,191,36,0.12)]'
          : 'border-slate-800/70 bg-slate-950/55 hover:-translate-y-0.5 hover:border-emerald-400/30 hover:shadow-[0_18px_60px_rgba(16,185,129,0.12)]'
      }`}
    >
      <div className="flex gap-4">
        {companySlug ? (
          <Link
            href={`/company/${companySlug}`}
            className="focus-ring mt-0.5 inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900/60 ring-1 ring-slate-800/70"
          >
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo ?? ''}
                alt={`${companyName} logo`}
                className="h-12 w-12 rounded-xl object-contain p-2"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="text-xs font-semibold text-slate-200">
                {companyInitials || '?'}
              </span>
            )}
          </Link>
        ) : (
          <div className="mt-0.5 inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900/60 ring-1 ring-slate-800/70">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo ?? ''}
                alt={`${companyName} logo`}
                className="h-12 w-12 rounded-xl object-contain p-2"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="text-xs font-semibold text-slate-200">
                {companyInitials || '?'}
              </span>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-base font-semibold text-slate-50">
                <Link
                  href={buildJobSlugHref(job)}
                  className="focus-ring rounded-md text-slate-50 transition-colors hover:text-white"
                >
                  {job.title}
                </Link>
              </h3>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-300">
                {companySlug ? (
                  <Link
                    href={`/company/${companySlug}`}
                    className="focus-ring rounded-md font-medium text-slate-200 hover:text-white hover:underline"
                  >
                    {companyName}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-200">{companyName}</span>
                )}

                {companySize && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs text-slate-400">
                      {companySize} employees
                    </span>
                  </>
                )}

                {companyTags.length > 0 && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs text-slate-400">
                      {companyTags.slice(0, 2).join(' • ')}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                {remoteMode && <span>{remoteMode}</span>}
                {location && (
                  <>
                    {remoteMode && <span className="text-slate-600">•</span>}
                    <span>{location}</span>
                  </>
                )}
                {job.type && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span>{job.type}</span>
                  </>
                )}
                {category && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span>{category}</span>
                  </>
                )}
                {seniority && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span>{seniority}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              {salaryDisplay ? (
                <div className="inline-flex rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 font-mono text-lg font-semibold text-emerald-200">
                  {salaryDisplay}
                </div>
              ) : (
                <div className="text-xs text-slate-500">Salary disclosed in posting</div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {salaryDisplay && (
                  <StatusPill tone="success">VERIFIED SALARY</StatusPill>
                )}
                {isNew && <StatusPill tone="neutral">NEW</StatusPill>}
                {isFeatured && <StatusPill tone="warning">FEATURED</StatusPill>}
              </div>
            </div>
          </div>

          {snippet && (
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-300">
              {snippet}
            </p>
          )}

          {techStack.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full bg-slate-900/60 px-3 py-1 text-slate-300 ring-1 ring-slate-800/70"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/60 pt-4">
            <p className="text-xs text-slate-400">
              Apply on company site
              {postedLabel ? (
                <>
                  <span className="text-slate-600"> • </span>
                  Posted {postedLabel}
                </>
              ) : null}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {isValidUrl(job.companyRef?.website) && (
                <a
                  href={cleanUrl(job.companyRef!.website!)}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring inline-flex h-11 items-center rounded-xl border border-slate-700/80 bg-slate-950/40 px-4 text-xs font-semibold text-slate-100 transition hover:bg-white/5"
                >
                  Company site
                </a>
              )}
              {companySlug && (
                <Link
                  href={`/company/${companySlug}`}
                  className="focus-ring inline-flex h-11 items-center rounded-xl border border-slate-700/80 bg-slate-950/40 px-4 text-xs font-semibold text-slate-100 transition hover:bg-white/5"
                >
                  More roles
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/* Status Pill                                                                 */
/* -------------------------------------------------------------------------- */

function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning'
}) {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1'

  const classes =
    tone === 'success'
      ? `${base} bg-emerald-500/10 text-emerald-300 ring-emerald-500/20`
      : tone === 'warning'
      ? `${base} bg-amber-500/10 text-amber-300 ring-amber-500/20`
      : `${base} bg-slate-900/60 text-slate-200 ring-slate-800/70`

  return <span className={classes}>{children}</span>
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function buildLocation(job: JobCardJob): string | null {
  const rawCode = job.countryCode
  const code = rawCode ? rawCode.toString().toUpperCase() : null
  const city = job.city ?? null
  const isRemote = job.remote === true || job.remoteMode === 'remote'

  if (isRemote) {
    if (code) return code
    return 'Worldwide'
  }

  if (city && code) return `${city}, ${code}`
  if (code) return code
  if (job.locationRaw) return String(job.locationRaw)

  return null
}

function buildSnippet(job: JobCardJob, companyDesc?: string | null): string | null {
  const aiSummary = extractSummary(job.requirementsJson)
  if (aiSummary) return aiSummary

  const rawPrimary = job.snippet ?? job.descriptionHtml ?? null
  const rawSecondary = job.description ?? null
  const raw = rawPrimary || rawSecondary || companyDesc || null
  if (!raw) return null
  return truncateText(stripTags(decodeHtmlEntities(raw)), 160)
}

function isReasonableSalary(job: JobCardJob) {
  const min = Number(job.minAnnual ?? 0)
  const max = Number(job.maxAnnual ?? 0)
  if (max && max > 1_000_000) return false
  if (min && min > 1_000_000) return false
  if (min && max && max < min) return false
  return true
}

function decodeHtmlEntities(str: string) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripTags(str: string) {
  return str.replace(/<\/?[^>]+(>|$)/g, '')
}

function truncateText(str: string, maxChars: number) {
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
  if (t.includes('intern')) return 'Internship'
  if (t.includes('principal') || t.includes('staff')) return 'Staff / Principal'
  if (t.includes('lead') || t.includes('head')) return 'Lead'
  if (t.includes('senior') || t.includes('sr')) return 'Senior'
  if (t.includes('junior') || t.includes('jr')) return 'Junior'
  return null
}

function inferCategoryFromRoleSlug(roleSlug?: string | null) {
  if (!roleSlug) return null
  const s = roleSlug.toLowerCase()
  if (s.includes('data')) return 'Data'
  if (s.includes('ml') || s.includes('machine-learning')) return 'ML / AI'
  if (s.includes('engineer') || s.includes('developer')) return 'Engineering'
  if (s.includes('product')) return 'Product'
  if (s.includes('design')) return 'Design'
  if (s.includes('ops') || s.includes('operations')) return 'Operations'
  if (s.includes('sales')) return 'Sales'
  if (s.includes('marketing')) return 'Marketing'
  if (s.includes('legal') || s.includes('counsel')) return 'Legal'
  return null
}

function getRemoteMode(job: JobCardJob): string | null {
  const mode = job.remoteMode ?? null
  if (job.remote === true) return 'Remote'
  if (mode === 'remote') return 'Remote'
  if (mode === 'hybrid') return 'Hybrid'
  if (mode === 'onsite') return 'On-site'
  return null
}

function parseJsonArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((x) => typeof x === 'string')
    }
  } catch {
    return []
  }
  return []
}

function extractSummary(requirementsJson?: string | null): string | null {
  if (!requirementsJson) return null
  try {
    const parsed = JSON.parse(requirementsJson)
    if (typeof parsed?.summary === 'string' && parsed.summary.trim()) {
      return parsed.summary.trim()
    }
  } catch {
    return null
  }
  return null
}

function getCompanyBlurb(description?: string | null): string | null {
  if (!description) return null
  const clean = stripTags(decodeHtmlEntities(description)).trim()
  if (!clean) return null
  // take first sentence-ish
  const cutoff = clean.indexOf('.')
  if (cutoff > 50 && cutoff < 220) {
    return clean.slice(0, cutoff + 1)
  }
  return clean.slice(0, 220)
}

function isValidUrl(url?: string | null) {
  if (!url) return false
  try {
    // new URL will throw if invalid; we also reject localhost/file protocols
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

function cleanUrl(url: string) {
  if (!url) return '#'
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}
