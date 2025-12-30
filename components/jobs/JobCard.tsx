'use client'

import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/lib/utils'
import { buildJobSlugHref } from '@/lib/jobs/jobSlug'
import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { buildSalaryText } from '@/lib/jobs/salary'
import { formatRelativeTime } from '@/lib/utils/time'
import { buildLogoUrl } from '@/lib/companies/logo'
import { getJobCardSnippet } from '@/lib/jobs/snippet'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Clock,
  Globe,
  Gift,
  MapPin,
  Shuffle,
  TrendingUp,
} from 'lucide-react'

import styles from './JobCard.module.css'

export type JobCardProps = {
  job: JobWithCompany & {
    primaryLocation?: any
    locationsJson?: any
    aiSnippet?: string | null
  }
  onClick?: () => void
  className?: string
}

function countryFlag(code?: string | null): string {
  const cc = String(code ?? '').trim().toUpperCase()
  if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(
    0x1f1e6 + (cc.charCodeAt(0) - 65),
    0x1f1e6 + (cc.charCodeAt(1) - 65),
  )
}

function toKCase(text: string): string {
  return text.replace(/(\d)K\b/g, '$1k').replace(/(\d)M\b/g, '$1M')
}

function getWorkType(job: JobWithCompany): { label: string; Icon: React.ComponentType<any> } | null {
  const mode = (job.remoteMode ?? job.workArrangementNormalized ?? '').toString().toLowerCase()
  if (job.remote === true || mode === 'remote') return { label: 'Remote', Icon: Globe }
  if (mode === 'hybrid') return { label: 'Hybrid', Icon: Shuffle }
  if (mode === 'onsite' || mode === 'on-site') return { label: 'Onsite', Icon: Building2 }
  return null
}

function inferSeniority(job: JobWithCompany): string | null {
  const exp = (job.experienceLevel ?? '').toString().toLowerCase()
  if (exp === 'senior') return 'Senior'
  if (exp === 'lead') return 'Lead'
  if (exp === 'staff') return 'Staff'
  if (exp === 'principal') return 'Principal'
  if (exp === 'junior') return 'Junior'
  if (exp === 'mid') return 'Mid'

  const t = (job.title || '').toLowerCase()
  if (t.includes('principal')) return 'Principal'
  if (t.includes('staff')) return 'Staff'
  if (t.includes('lead') || t.includes('head')) return 'Lead'
  if (t.includes('senior') || /\bsr\b/.test(t)) return 'Senior'
  if (t.includes('junior') || /\bjr\b/.test(t)) return 'Junior'
  return null
}

function parseJsonArray(raw?: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((x) => {
        if (typeof x === 'string') return x
        if (x && typeof x === 'object') {
          const name = (x as any).name ?? (x as any).label ?? (x as any).title
          return typeof name === 'string' ? name : String(x)
        }
        return null
      })
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  }
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parseJsonArray(parsed) : []
  } catch {
    const text = raw.trim()
    if (!text) return []

    // Postgres array style: {"React","Node.js"}
    if (text.startsWith('{') && text.endsWith('}')) {
      const inner = text.slice(1, -1)
      return inner
        .split(',')
        .map((v) => v.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'))
        .filter((v) => v.length > 0)
    }

    // Fallback: comma/pipe/semicolon/newline-separated string
    return text
      .split(/[,\n\r;|]+/g)
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
  }
}

function uniqStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of values) {
    const v = raw.trim()
    const key = v.toLowerCase()
    if (!v) continue
    if (seen.has(key)) continue
    seen.add(key)
    result.push(v)
  }
  return result
}

function buildLocationDisplay(job: JobWithCompany & { primaryLocation?: any; locationsJson?: any }): {
  label: string
  hasMultiple: boolean
  count: number
} | null {
  // Country code to name mapping
  const countryNames: Record<string, string> = {
    'US': 'USA',
    'GB': 'UK',
    'CA': 'Canada',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'NL': 'Netherlands',
    'ES': 'Spain',
    'IT': 'Italy',
    'SE': 'Sweden',
    'NO': 'Norway',
    'DK': 'Denmark',
    'FI': 'Finland',
    'IE': 'Ireland',
    'CH': 'Switzerland',
    'AT': 'Austria',
    'BE': 'Belgium',
    'PT': 'Portugal',
    'PL': 'Poland',
    'CZ': 'Czech Republic',
    'SG': 'Singapore',
    'JP': 'Japan',
    'KR': 'South Korea',
    'IN': 'India',
    'BR': 'Brazil',
    'MX': 'Mexico',
    'AR': 'Argentina',
    'CL': 'Chile',
    'NZ': 'New Zealand',
  }

  // Use primaryLocation if available
  if (job.primaryLocation) {
    const locations = parseJsonArray(job.locationsJson)
    const isRemote = job.remote === true || job.remoteMode === 'remote'

    if (isRemote) {
      const cc = job.countryCode ? String(job.countryCode).toUpperCase() : null
      const flag = countryFlag(cc)
      
      // Get location value
      const locationValue = String(job.primaryLocation).trim()
      
      // Only map 2-letter country codes to full names
      // If it's already descriptive text (like "Remote, USA"), use as-is without flag
      let displayName = locationValue
      if (locationValue.length === 2 && locationValue === locationValue.toUpperCase()) {
        // It's a bare country code like "US" - map to "USA" and add flag
        displayName = countryNames[locationValue] || locationValue
        return {
          label: flag ? `${flag} ${displayName}` : displayName || 'Remote',
          hasMultiple: locations.length > 1,
          count: locations.length
        }
      }
      
      // It's descriptive text - return as-is WITHOUT flag (flag is redundant)
      return {
        label: displayName,
        hasMultiple: locations.length > 1,
        count: locations.length
      }
    }

    const primary = String(job.primaryLocation)
    const cc = job.countryCode ? String(job.countryCode).toUpperCase() : null
    const flag = countryFlag(cc)

    return {
      label: flag ? `${flag} ${primary}` : primary,
      hasMultiple: locations.length > 1,
      count: locations.length
    }
  }

  // Fallback to old logic
  const cc = job.countryCode ? String(job.countryCode).toUpperCase() : null
  const flag = countryFlag(cc)
  const city = job.city ? String(job.city).trim() : ''
  const isRemote = job.remote === true || job.remoteMode === 'remote'

  if (isRemote) {
    const displayName = cc ? (countryNames[cc] || cc) : null
    return {
      label: displayName ? `${flag} ${displayName}` : 'Remote',
      hasMultiple: false,
      count: 1
    }
  }

  if (city && cc) {
    return {
      label: `${flag} ${city}, ${cc}`,
      hasMultiple: false,
      count: 1
    }
  }

  if (cc) {
    return {
      label: `${flag} ${cc}`,
      hasMultiple: false,
      count: 1
    }
  }

  if (job.locationRaw) {
    const raw = String(job.locationRaw)
    return {
      label: raw.split(/[;,]/)[0].trim(),
      hasMultiple: raw.includes(';') || raw.includes(','),
      count: raw.split(/[;,]/).length
    }
  }

  return null
}

export function JobCard({ job, onClick, className }: JobCardProps) {
  const companyName = String(job.companyRef?.name ?? (job as any)?.company ?? 'Company')
  const companyLogo = buildLogoUrl(
    job.companyRef?.logoUrl ?? (job as any)?.companyLogo ?? null,
    job.companyRef?.website ?? null,
  )
  const initials = companyName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const size = job.companyRef?.sizeBucket ?? null
  const industry = job.companyRef?.industry ?? job.industry ?? null
  const hasBenefits = Boolean((job as any)?.benefitsJson) || Boolean((job as any)?.aiBenefits)

  const salaryText = buildSalaryText(job)
  const salary = salaryText ? toKCase(salaryText) : null
  const hasSalary = Boolean(salary)

  const workType = getWorkType(job)
  const seniority = inferSeniority(job)

  const locationData = buildLocationDisplay(job)

  // Prioritize aiSnippet over default snippet
  const snippet = (job as any).aiSnippet || getJobCardSnippet(job as any)
  const truncatedSnippet =
    typeof snippet === 'string' && snippet.length > 120
      ? `${snippet.slice(0, 120).trim()}...`
      : snippet

  const skills = uniqStrings([
    ...parseJsonArray((job as any)?.techStack),
    ...parseJsonArray((job as any)?.skillsJson),
  ])

  const shownSkills = skills.slice(0, 10)
  const extraSkills = Math.max(0, skills.length - shownSkills.length)

  if (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_DEBUG_JOB_SKILLS === '1' &&
    !(window as any).__debugSkills
  ) {
    console.log('Job tech stack debug:', {
      jobId: job.id,
      techStack: (job as any)?.techStack,
      skillsJson: (job as any)?.skillsJson,
      parsed: skills,
      shown: shownSkills,
    })
    ;(window as any).__debugSkills = true
  }

  const postedLabel = formatRelativeTime(job.postedAt ?? job.updatedAt ?? job.createdAt ?? null)

  return (
    <Link
      href={buildJobSlugHref(job as any)}
      onClick={onClick}
      className={cn(styles.card, className)}
    >
      <header className={styles.header}>
        <div className={styles.logoWrap} aria-hidden="true">
          {companyLogo ? (
            <Image
              src={companyLogo}
              alt=""
              width={48}
              height={48}
              className={styles.logoImg}
              loading="lazy"
              unoptimized={companyLogo.includes('clearbit.com')}
            />
          ) : (
            <span className={styles.logoFallback}>{initials || 'C'}</span>
          )}
        </div>

        <div className={styles.company}>
          <div className={styles.companyName}>{companyName}</div>
          <div className={styles.companyMeta}>
            {size ? <span className={styles.sizeBadge}>{size}</span> : null}
            {industry ? <span className={styles.metaText}>{industry}</span> : null}
            {hasBenefits ? (
              <span className={styles.benefits} title="Benefits available">
                <Gift className={styles.benefitsIcon} aria-hidden="true" />
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.hero}>
          <h3 className={styles.title}>{job.title}</h3>

          <div className={styles.salaryStack}>
            <div className={styles.salaryPill} aria-label={hasSalary ? `Salary ${salary}` : 'High salary role'}>
              <span className={styles.salaryIcon} aria-hidden="true">
                💰
              </span>
              <span className={styles.salaryValue}>{salary ?? 'High salary role'}</span>
            </div>

            {hasSalary ? (
              <span className={styles.verified} aria-label="Salary verified">
                <BadgeCheck className={styles.verifiedIcon} aria-hidden="true" />
                Verified salary
              </span>
            ) : null}
          </div>
        </div>

        <div className={styles.metaRow} aria-label="Job metadata">
          <span className={styles.metaPill}>
            <MapPin className={styles.metaIcon} aria-hidden="true" />
            {locationData?.label ?? '—'}
            {locationData?.hasMultiple ? ` +${locationData.count - 1}` : ''}
          </span>

          <span className={styles.metaPill}>
            {workType ? <workType.Icon className={styles.metaIcon} aria-hidden="true" /> : null}
            {workType?.label ?? '—'}
          </span>

          <span className={styles.metaPill}>
            <TrendingUp className={styles.metaIcon} aria-hidden="true" />
            {seniority ?? '—'}
          </span>
        </div>

        {truncatedSnippet ? (
          <p className={styles.snippet}>{truncatedSnippet}</p>
        ) : null}

        {shownSkills.length > 0 ? (
          <div className={styles.skills} aria-label="Skills">
            {shownSkills.map((s) => (
              <span key={s} className={styles.skill}>
                {s}
              </span>
            ))}
            {extraSkills > 0 ? (
              <span className={cn(styles.skill, styles.moreSkill)}>+{extraSkills} more</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <footer className={styles.footer}>
        <div className={styles.posted}>
          <Clock className={styles.footerIcon} aria-hidden="true" />
          <span>{postedLabel ? `Posted ${postedLabel}` : 'Recently posted'}</span>
        </div>

        <div className={styles.cta} aria-hidden="true">
          View Details <ArrowRight className={styles.ctaIcon} />
        </div>
      </footer>
    </Link>
  )
}
