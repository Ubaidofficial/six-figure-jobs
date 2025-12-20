// app/components/JobCard.tsx

'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { buildJobSlugHref } from '../../lib/jobs/jobSlug'
import type { JobWithCompany } from '../../lib/jobs/queryJobs'
import { buildSalaryText } from '../../lib/jobs/salary' // ← unified helper
import { formatRelativeTime } from '../../lib/utils/time'
import { buildLogoUrl } from '../../lib/companies/logo'

import styles from './JobCard.module.css'

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

export default function JobCard({
  job,
  variant = 'full',
}: {
  job: JobCardJob
  variant?: 'full' | 'compact'
}) {
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
  const showLogo = Boolean(logo) && !logoFailed

  const companySlug = job.companyRef?.slug ?? null

  const companyDesc = getCompanyBlurb(job.companyRef?.description)
  const snippet = buildSnippet(job, companyDesc)
  const techStack = parseJsonArray(job.techStack).slice(0, variant === 'compact' ? 0 : 3)

  const location = buildLocation(job)
  const salaryText = buildSalaryText(job) // ← UNIFIED salary logic
  const salaryDisplay =
    salaryText &&
    /\d/.test(salaryText) &&
    !salaryText.includes('<') &&
    isReasonableSalary(job)
      ? salaryText
      : null

  const remoteMode = getRemoteMode(job)
  const workType = remoteMode ?? (job.remote === true ? 'Remote' : 'On-site')

  const postedLabel = formatRelativeTime(
    job.postedAt ?? job.createdAt ?? job.updatedAt ?? null,
  )

  const isNew =
    !!(job.postedAt ?? job.createdAt) &&
    Date.now() - new Date((job.postedAt ?? job.createdAt) as any).getTime() < 1000 * 60 * 60 * 48

  return (
    <article
      className={`${styles.card} ${isFeatured ? styles.featured : ''} ${
        variant === 'compact' ? styles.compact : styles.full
      }`}
    >
      <div className={styles.header}>
        {companySlug ? (
          <Link href={`/company/${companySlug}`} className={styles.logoLink}>
            <div className={styles.logoBox} aria-hidden="true">
              {showLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo ?? ''}
                  alt=""
                  className={styles.logoImg}
                  loading="lazy"
                  decoding="async"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className={styles.logoFallback}>{companyInitials || '?'}</span>
              )}
            </div>
          </Link>
        ) : (
          <div className={styles.logoBox} aria-hidden="true">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo ?? ''}
                alt=""
                className={styles.logoImg}
                loading="lazy"
                decoding="async"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className={styles.logoFallback}>{companyInitials || '?'}</span>
            )}
          </div>
        )}

        <div className={styles.main}>
          <h3 className={styles.title}>
            <Link href={buildJobSlugHref(job)} className={styles.titleLink}>
              {job.title}
            </Link>
          </h3>

          <div className={styles.companyRow}>
            {companySlug ? (
              <Link href={`/company/${companySlug}`} className={styles.companyLink}>
                {companyName}
              </Link>
            ) : (
              <span className={styles.companyName}>{companyName}</span>
            )}
          </div>

          <div className={styles.badges}>
            {location ? <span className={styles.badge}>{location}</span> : null}
            {workType ? (
              <span className={`${styles.badge} ${styles.badgeAccent}`}>{workType}</span>
            ) : null}
          </div>
        </div>

        <div className={styles.side}>
          {salaryDisplay ? (
            <div className={styles.salary} aria-label={`Minimum salary ${salaryDisplay}`}>
              Minimum: {salaryDisplay}
            </div>
          ) : (
            <div className={styles.salaryPlaceholder}>Salary listed in posting</div>
          )}

          <div className={styles.pills}>
            {salaryDisplay ? <StatusPill tone="success">Salary verified</StatusPill> : null}
            {isNew ? <StatusPill tone="neutral">NEW</StatusPill> : null}
            {isFeatured ? <StatusPill tone="warning">FEATURED</StatusPill> : null}
          </div>
        </div>
      </div>

      {variant === 'full' && snippet ? (
        <p className={styles.snippet}>{snippet}</p>
      ) : null}

      {variant === 'full' && techStack.length > 0 ? (
        <div className={styles.techStack} aria-label="Tech stack">
          {techStack.map((tech) => (
            <span key={tech} className={styles.techChip}>
              {tech}
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.footer}>
        <span className={styles.footerText}>{postedLabel ? `Posted ${postedLabel}` : 'Recently posted'}</span>

        {variant === 'full' ? (
          <div className={styles.footerActions}>
            {isValidUrl(job.companyRef?.website) ? (
              <a
                href={cleanUrl(job.companyRef!.website!)}
                target="_blank"
                rel="noreferrer"
                className={styles.actionLink}
              >
                Company site
              </a>
            ) : null}
            {companySlug ? (
              <Link href={`/company/${companySlug}`} className={styles.actionLink}>
                Explore roles
              </Link>
            ) : null}
          </div>
        ) : null}
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
  return (
    <span
      className={`${styles.pill} ${
        tone === 'success'
          ? styles.pillSuccess
          : tone === 'warning'
          ? styles.pillWarning
          : styles.pillNeutral
      }`}
    >
      {children}
    </span>
  )
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
