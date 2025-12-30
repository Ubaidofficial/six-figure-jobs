// app/components/JobCard.tsx

'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { buildJobSlugHref } from '../../lib/jobs/jobSlug'
import type { JobWithCompany } from '../../lib/jobs/queryJobs'
import { buildSalaryText } from '../../lib/jobs/salary'
import { formatRelativeTime } from '../../lib/utils/time'
import { buildLogoUrl } from '../../lib/companies/logo'

import styles from './JobCard.module.css'

export type JobCardJob = JobWithCompany & {
  snippet?: string | null
  description?: string | null
  benefitsJson?: string | null
  postedAt?: string | Date | null
  requirementsJson?: string | null
  techStack?: string | null
  primaryLocation?: any
  locationsJson?: any
  aiSnippet?: string | null
  experienceLevel?: string | null
}

export default function JobCard({
  job,
  variant = 'full',
}: {
  job: JobCardJob
  variant?: 'full' | 'compact'
}) {
  const [logoFailed, setLogoFailed] = useState(false)
  const companyName = job.companyRef?.name ?? job.company ?? 'Unknown company'
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

  const logo = buildLogoUrl(
    job.companyRef?.logoUrl ?? job.companyLogo ?? null,
    job.companyRef?.website ?? null,
  )
  const showLogo = Boolean(logo) && !logoFailed

  const companySlug = job.companyRef?.slug ?? null
  const snippet = buildSnippet(job)
  const techStack = parseJsonArray(job.techStack).slice(0, variant === 'compact' ? 0 : 5)

  // Enhanced location handling with primaryLocation
  const locationData = buildLocationData(job)
  
  const salaryText = buildSalaryText(job)
  const salaryDisplay =
    salaryText &&
    /\d/.test(salaryText) &&
    !salaryText.includes('<') &&
    isReasonableSalary(job)
      ? salaryText
      : null

  const seniority = job.experienceLevel || inferSeniorityFromTitle(job.title)
  const remoteMode = getRemoteMode(job)

  const postedLabel = formatRelativeTime(
    job.postedAt ?? job.createdAt ?? job.updatedAt ?? null,
  )

  const isNew =
    !!(job.postedAt ?? job.createdAt) &&
    Date.now() - new Date((job.postedAt ?? job.createdAt) as any).getTime() < 1000 * 60 * 60 * 48

  return (
    <article className={`${styles.card} ${isFeatured ? styles.featured : ''}`}>
      <div className={styles.cardInner}>
        <div className={styles.logoContainer}>
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
        </div>

        <div className={styles.content}>
          <div className={styles.titleRow}>
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
          </div>

          {/* Enhanced metadata row */}
          <div className={styles.metadata}>
            {/* Location badge */}
            {locationData && (
              <span className={styles.badge}>
                {locationData.flag} {locationData.primary}
                {locationData.hasMultiple && ` +${locationData.count - 1}`}
              </span>
            )}
            
            {/* Remote mode */}
            {remoteMode && (
              <span className={styles.badge}>
                {remoteMode === 'Remote' ? '🌍' : remoteMode === 'Hybrid' ? '🏢' : '📍'} {remoteMode}
              </span>
            )}

            {/* Seniority level */}
            {seniority && (
              <span className={styles.badge}>
                {getSeniorityIcon(seniority)} {seniority}
              </span>
            )}

            {/* Posted time */}
            {postedLabel && (
              <span className={styles.badgeTime}>
                📅 {postedLabel}
              </span>
            )}
          </div>

          {/* Snippet - prioritize AI-generated content */}
          {snippet ? <p className={styles.snippet}>{snippet}</p> : null}
        </div>

        {/* Salary section */}
        <div className={styles.actions}>
          {salaryDisplay ? (
            <div className={styles.salaryBadge}>
              <span className={styles.salaryLabel}>Salary</span>
              <span className={styles.salaryAmount}>{salaryDisplay}</span>
            </div>
          ) : (
            <div className={styles.salaryPlaceholder}>Salary not disclosed</div>
          )}

          <div className={styles.pills}>
            {salaryDisplay && job.salaryValidated && <StatusPill tone="success">Verified</StatusPill>}
            {isNew && <StatusPill tone="neutral">NEW</StatusPill>}
            {isFeatured && <StatusPill tone="warning">FEATURED</StatusPill>}
          </div>
        </div>
      </div>

      {/* Tech stack section */}
      {variant === 'full' && techStack.length > 0 ? (
        <div className={styles.techStack}>
          {techStack.map((tech) => (
            <span key={tech} className={styles.techChip}>
              {tech}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}

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

// Enhanced location builder using primaryLocation and locationsJson
function buildLocationData(job: JobCardJob): {
  primary: string
  flag: string
  hasMultiple: boolean
  count: number
} | null {
  // Country code to name mapping
  const countryNames: Record<string, string> = {
    'US': 'USA', 'GB': 'UK', 'CA': 'Canada', 'AU': 'Australia',
    'DE': 'Germany', 'FR': 'France', 'NL': 'Netherlands', 'ES': 'Spain',
    'IT': 'Italy', 'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark',
    'FI': 'Finland', 'IE': 'Ireland', 'CH': 'Switzerland', 'AT': 'Austria',
    'BE': 'Belgium', 'PT': 'Portugal', 'PL': 'Poland', 'CZ': 'Czech Republic',
    'SG': 'Singapore', 'JP': 'Japan', 'KR': 'South Korea', 'IN': 'India',
    'BR': 'Brazil', 'MX': 'Mexico', 'AR': 'Argentina', 'CL': 'Chile', 'NZ': 'New Zealand',
  }
  // Try primaryLocation first (new field)
  if (job.primaryLocation) {
    const primary = String(job.primaryLocation)
    const locations = parseJsonArray(job.locationsJson)
    const countryCode = job.countryCode || detectCountryCode(primary)
    
    // For primaryLocation that's already descriptive (like "Remote, USA" or "New Jersey, USA"),
    // just return it as-is without adding country name mapping
    // Only map if it's a bare 2-letter code (US, GB, CA, etc.)
    let displayName = primary
    if (primary.length === 2 && primary === primary.toUpperCase()) {
      // It's a 2-letter country code, map it to full name
      displayName = countryNames[primary] || primary
    }
    
    return {
      primary: displayName,
      flag: getCountryFlag(countryCode),
      hasMultiple: locations.length > 1,
      count: locations.length
    }
  }
  // Fallback to existing logic
  const isRemote = job.remote === true || job.remoteMode === 'remote'
  const code = job.countryCode ? job.countryCode.toString().toUpperCase() : null
  if (isRemote) {
    // Only add flag for 2-letter country codes
    // If primaryLocation exists and is descriptive, it was already handled above
    const displayName = code ? (countryNames[code] || code) : 'Worldwide'
    return {
      primary: displayName,
      flag: getCountryFlag(code),
      hasMultiple: false,
      count: 1
    }
  }
  if (job.city && code) {
    return {
      primary: `${job.city}, ${code}`,
      flag: getCountryFlag(code),
      hasMultiple: false,
      count: 1
    }
  }
  if (code) {
    const displayName = countryNames[code] || code
    return {
      primary: displayName,
      flag: getCountryFlag(code),
      hasMultiple: false,
      count: 1
    }
  }
  if (job.locationRaw) {
    const raw = String(job.locationRaw)
    const detectedCode = detectCountryCode(raw)
    return {
      primary: raw.split(/[;,]/)[0].trim(),
      flag: getCountryFlag(detectedCode),
      hasMultiple: raw.includes(';') || raw.includes(','),
      count: raw.split(/[;,]/).length
    }
  }
  return null
}

function buildSnippet(job: JobCardJob): string | null {
  // Priority 1: AI-generated snippet (shortest, most concise)
  if (job.aiSnippet) return job.aiSnippet

  // Priority 2: AI summary from requirementsJson
  const aiSummary = extractSummary(job.requirementsJson)
  if (aiSummary) return aiSummary

  // Priority 3: Job description
  const rawPrimary = job.snippet ?? job.descriptionHtml ?? null
  const rawSecondary = job.description ?? null
  const raw = rawPrimary || rawSecondary

  if (raw) {
    return truncateText(stripTags(decodeHtmlEntities(raw)), 140)
  }

  return null
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
  if (t.includes('principal') || t.includes('staff') || t.includes('distinguished')) return 'Staff+'
  if (t.includes('lead') || t.includes('head') || t.includes('director')) return 'Lead'
  if (t.includes('senior') || t.includes('sr.') || t.includes('sr ')) return 'Senior'
  if (t.includes('junior') || t.includes('jr.') || t.includes('jr ') || t.includes('associate')) return 'Junior'
  if (t.includes('mid-level') || t.includes('mid level') || t.includes('intermediate')) return 'Mid-level'
  return 'Mid-level'
}

function getSeniorityIcon(seniority: string): string {
  const s = seniority.toLowerCase()
  if (s.includes('intern')) return '🎓'
  if (s.includes('junior')) return '🌱'
  if (s.includes('mid')) return '⚡'
  if (s.includes('senior')) return '⭐'
  if (s.includes('staff') || s.includes('lead') || s.includes('principal')) return '🚀'
  return '💼'
}

function getRemoteMode(job: JobCardJob): string | null {
  const mode = job.remoteMode ?? null
  if (job.remote === true) return 'Remote'
  if (mode === 'remote') return 'Remote'
  if (mode === 'hybrid') return 'Hybrid'
  if (mode === 'onsite') return 'On-site'
  return null
}

function parseJsonArray(raw?: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string')
  if (typeof raw !== 'string') return []
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

function detectCountryCode(text: string): string | null {
  const t = text.toLowerCase()
  if (t.includes('usa') || t.includes('united states') || t.includes('🇺🇸')) return 'US'
  if (t.includes('canada') || t.includes('🇨🇦')) return 'CA'
  if (t.includes('uk') || t.includes('united kingdom') || t.includes('🇬🇧')) return 'GB'
  if (t.includes('germany') || t.includes('🇩🇪')) return 'DE'
  if (t.includes('australia') || t.includes('🇦🇺')) return 'AU'
  if (t.includes('france') || t.includes('🇫🇷')) return 'FR'
  if (t.includes('netherlands') || t.includes('🇳🇱')) return 'NL'
  return null
}

function getCountryFlag(countryCode?: string | null): string {
  if (!countryCode) return '🌍'

  const flags: Record<string, string> = {
    US: '🇺🇸', GB: '🇬🇧', UK: '🇬🇧', CA: '🇨🇦', DE: '🇩🇪',
    FR: '🇫🇷', NL: '🇳🇱', AU: '🇦🇺', IE: '🇮🇪', ES: '🇪🇸',
    IT: '🇮🇹', SE: '🇸🇪', CH: '🇨🇭', IN: '🇮🇳', SG: '🇸🇬',
    BR: '🇧🇷', MX: '🇲🇽', PL: '🇵🇱', NO: '🇳🇴', DK: '🇩🇰',
    AT: '🇦🇹', BE: '🇧🇪', FI: '🇫🇮', PT: '🇵🇹', NZ: '🇳🇿',
  }

  return flags[countryCode.toUpperCase()] || '🌍'
}
