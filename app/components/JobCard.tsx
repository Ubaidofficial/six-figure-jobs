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

  const isRemotePrimary =
    job.remote === true || job.remoteMode === 'remote'

  const postedLabel = formatRelativeTime(
    job.postedAt ?? job.createdAt ?? job.updatedAt ?? null,
  )
  const isNew =
    !!(job.postedAt ?? job.createdAt) &&
    Date.now() - new Date(job.postedAt ?? job.createdAt as any).getTime() < 1000 * 60 * 60 * 48

  const benefits = parseJsonArray(job.benefitsJson).slice(0, 3)
  const techStack = parseJsonArray(job.techStack).slice(0, 3)

  const isHighSalary =
    job.isHighSalary ||
    Number(job.minAnnual ?? 0) >= 100_000 ||
    Number(job.maxAnnual ?? 0) >= 100_000 ||
    false

  return (
    <article
      className={`group rounded-2xl border px-4 py-4 shadow-sm transition hover:border-slate-500/80 hover:bg-slate-900/80 ${
        isFeatured
          ? 'border-amber-500/60 bg-slate-950/90 shadow-amber-500/20'
          : 'border-slate-800 bg-slate-950/80'
      }`}
    >
      <div className="flex gap-4">
        {/* Logo — click→company */}
        {companySlug ? (
          <Link
            href={`/company/${companySlug}`}
            className="mt-1 flex-shrink-0"
          >
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={companyName}
                className="h-10 w-10 rounded-full bg-slate-900 object-contain p-1 hover:ring-2 hover:ring-slate-600"
                onError={(e) => {
                  setLogoFailed(true)
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-slate-300 hover:ring-2 hover:ring-slate-600">
                {companyInitials || '?'}
              </div>
            )}
          </Link>
        ) : (
          <div className="mt-1 flex-shrink-0">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={companyName}
                className="h-10 w-10 rounded-full bg-slate-900 object-contain p-1"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-slate-300">
                {companyInitials || '?'}
              </div>
            )}
          </div>
        )}

        {/* Main */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-slate-50 group-hover:text-slate-100">
                <Link href={buildJobSlugHref(job)}>{job.title}</Link>
              </h3>

              {/* Company info */}
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                {companySlug ? (
                  <Link
                    href={`/company/${companySlug}`}
                    className="font-medium hover:underline"
                  >
                    {companyName}
                  </Link>
                ) : (
                  <span className="font-medium">{companyName}</span>
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

            {/* Right side actions */}
            <div className="flex flex-col items-end gap-2 text-xs">
              {postedLabel && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  {isFeatured && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-200 ring-1 ring-amber-500/60">
                      Featured
                    </span>
                  )}
                  {isNew && (
                    <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-emerald-200 ring-1 ring-emerald-600/60">
                      New
                    </span>
                  )}
                  <span>Posted {postedLabel}</span>
                </span>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {isValidUrl(job.companyRef?.website) && (
                  <a
                    href={cleanUrl(job.companyRef!.website!)}
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

          {/* Badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            {location && <Badge>📍 {location}</Badge>}

            {/* Avoid duplicating Remote */}
            {remoteMode && (!isRemotePrimary || remoteMode !== 'Remote') && (
              <Badge>🌎 {remoteMode}</Badge>
            )}

            {job.type && <Badge>⏱️ {job.type}</Badge>}
            {category && <Badge>{category}</Badge>}
            {seniority && <Badge>{seniority}</Badge>}

              {salaryDisplay && (
                <Badge highlight={isHighSalary || isFeatured}>
                  💵 {salaryDisplay}
                </Badge>
              )}

              {isFeatured && <Badge strong>⭐ Featured</Badge>}

              {benefits.map((b) => (
                <Badge key={b}>🎁 {b}</Badge>
              ))}
            </div>

          {/* Snippet */}
          {snippet && (
            <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-slate-300">
              {snippet}
            </p>
          )}

          {techStack.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full bg-slate-900 px-2 py-1 text-slate-300 ring-1 ring-slate-700"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/* Badge Component                                                             */
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
    classes +=
      ' bg-emerald-500/15 text-emerald-200 ring-emerald-500/60 font-semibold'
  } else if (strong) {
    classes += ' bg-slate-900 text-slate-50 ring-slate-500 font-semibold'
  } else {
    classes += ' bg-slate-900 text-slate-300 ring-slate-700'
  }

  return <span className={classes}>{children}</span>
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸',
  CA: '🇨🇦',
  GB: '🇬🇧',
  UK: '🇬🇧',
  DE: '🇩🇪',
  NL: '🇳🇱',
  AU: '🇦🇺',
  IE: '🇮🇪',
}

function buildLocation(job: JobCardJob): string | null {
  const rawCode = job.countryCode
  const code = rawCode ? rawCode.toString().toUpperCase() : null
  const city = job.city ?? null
  const isRemote = job.remote === true || job.remoteMode === 'remote'

  const flag = code ? COUNTRY_FLAGS[code] : undefined

  if (isRemote) {
    if (code) return `Remote · ${flag ?? '🌍'} ${code}`
    return 'Remote · 🌍 Worldwide'
  }

  if (city && code) return `${city}, ${flag ? `${flag} ${code}` : code}`
  if (code) return flag ? `${flag} ${code}` : code
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
  if (t.includes('intern')) return '🧑‍🎓 Internship'
  if (t.includes('principal') || t.includes('staff'))
    return '⭐ Staff / Principal'
  if (t.includes('lead') || t.includes('head')) return '⭐ Lead'
  if (t.includes('senior') || t.includes('sr')) return '⭐ Senior'
  if (t.includes('junior') || t.includes('jr')) return '🌱 Junior'
  return null
}

function inferCategoryFromRoleSlug(roleSlug?: string | null) {
  if (!roleSlug) return null
  const s = roleSlug.toLowerCase()
  if (s.includes('data')) return '📊 Data'
  if (s.includes('ml') || s.includes('machine-learning')) return '🤖 ML / AI'
  if (s.includes('engineer') || s.includes('developer')) return '💻 Engineering'
  if (s.includes('product')) return '🧭 Product'
  if (s.includes('design')) return '🎨 Design'
  if (s.includes('ops') || s.includes('operations')) return '⚙️ Operations'
  if (s.includes('sales')) return '💼 Sales'
  if (s.includes('marketing')) return '📣 Marketing'
  if (s.includes('legal') || s.includes('counsel')) return '⚖️ Legal'
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
