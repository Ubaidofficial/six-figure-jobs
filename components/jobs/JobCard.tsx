'use client'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { CountryFlag } from '@/components/ui/CountryFlag'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import { countryName, normalizeCountryCode } from '@/lib/location/country'
import { describeJobLocation } from '@/lib/location/jobLocation'
import { skillLabel } from '@/lib/jobs/skillLabel'
import { buildJobSlugHref } from '@/lib/jobs/jobSlug'
import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { buildSalaryText } from '@/lib/jobs/salary'
import { formatRelativeTime } from '@/lib/utils/time'
import { buildLogoUrl } from '@/lib/companies/logo'
import { getJobCardSnippet } from '@/lib/jobs/snippet'
import { SKILL_TARGETS } from '@/lib/seo/pseoTargets'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
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
  variant?: 'listing' | 'homepage' | 'grid'
}

function toKCase(text: string): string {
  return text.replace(/(\d)K\b/g, '$1k').replace(/(\d)M\b/g, '$1M')
}

function humanizeLocationText(value: string): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''

  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(trimmed)) {
    return trimmed
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  return trimmed
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

function normalizeSkillKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const SKILL_KEY_TO_SLUG = new Map<string, string>()
for (const target of SKILL_TARGETS) {
  SKILL_KEY_TO_SLUG.set(normalizeSkillKey(target.slug), target.slug)
  SKILL_KEY_TO_SLUG.set(normalizeSkillKey(target.label), target.slug)
}

const SKILL_ALIASES: Record<string, string> = {
  c: 'c-plus-plus',
  cpp: 'c-plus-plus',
  node: 'node-js',
  nodejs: 'node-js',
  next: 'nextjs',
  postgres: 'postgresql',
  ml: 'machine-learning',
  machinelearning: 'machine-learning',
  go: 'golang',
}

function resolveSkillSlug(value: string): string | null {
  const key = normalizeSkillKey(value.trim())
  if (!key) return null
  const alias = SKILL_ALIASES[key]
  if (alias) return alias
  return SKILL_KEY_TO_SLUG.get(key) ?? null
}

function buildLocationDisplay(job: JobWithCompany & { primaryLocation?: any; locationsJson?: any }): {
  label: string
  /** For the flag; the name is always in `label`. */
  countryCode: string | null
  hasMultiple: boolean
  count: number
} | null {
  const isRemote = job.remote === true || job.remoteMode === 'remote'
  const stored = normalizeCountryCode(job.countryCode)

  // Use primaryLocation if available
  if (job.primaryLocation) {
    const locations = parseJsonArray(job.locationsJson)
    const multi = { hasMultiple: locations.length > 1, count: locations.length }
    const value = String(job.primaryLocation).trim()

    if (isRemote) {
      // A bare country code ("US") becomes the country's name; descriptive text ("Remote, USA") is kept as is, without
      // a flag (the text already says where).
      if (value.length === 2 && value === value.toUpperCase()) {
        const code = stored ?? normalizeCountryCode(value)
        return { label: countryName(value, { short: true }) || 'Remote', countryCode: code, ...multi }
      }
      return { label: humanizeLocationText(value), countryCode: null, ...multi }
    }

    return { label: humanizeLocationText(value), countryCode: stored, ...multi }
  }

  // Fallback to old logic
  const view = describeJobLocation(job)
  const cc = stored ?? view.countryCode
  const city = job.city ? humanizeLocationText(String(job.city)) : ''
  const name = cc ? countryName(cc, { short: true }) : null

  if (isRemote) {
    // Without a country there is nothing to add: the work-type pill beside it already says "Remote".
    return name ? { label: name, countryCode: cc, hasMultiple: false, count: 1 } : null
  }

  if (city && stored && name) {
    return { label: `${city}, ${name}`, countryCode: stored, hasMultiple: false, count: 1 }
  }

  if (stored && name) {
    return { label: name, countryCode: stored, hasMultiple: false, count: 1 }
  }

  if (job.locationRaw) {
    // "A; B; C" is several places. "City, State" is one: its commas are not a count.
    const multiple = view.count > 1
    return {
      label: multiple ? view.first : view.text,
      countryCode: view.countryCode,
      hasMultiple: multiple,
      count: view.count,
    }
  }

  return null
}

export function JobCard({ job, onClick, className, variant = 'listing' }: JobCardProps) {
  const router = useRouter()
  const isHomepage = variant === 'homepage'
  const isGrid = variant === 'grid'
  const companyName = String(job.companyRef?.name ?? (job as any)?.company ?? 'Company')
  const companyLogo = buildLogoUrl(
    job.companyRef?.logoUrl ?? (job as any)?.companyLogo ?? null,
    job.companyRef?.website ?? null,
    companyName,
  )

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

  const shownSkills = skills.slice(0, isHomepage ? 5 : isGrid ? 4 : 6)
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
  const jobHref = buildJobSlugHref(job as any)

  // "NEW" badge: show for jobs posted within the last 3 days
  const postedDate = job.postedAt ?? job.createdAt ?? null
  const isNew = postedDate
    ? Date.now() - new Date(postedDate).getTime() < 3 * 24 * 60 * 60 * 1000
    : false

  const navigateToJob = () => {
    onClick?.()
    router.push(jobHref)
  }

  return (
    <article
      className={cn(styles.card, isHomepage && styles.homepageCard, isGrid && styles.gridCard, className)}
      onClick={(e) => {
        // Whole-card click is a mouse convenience; the title link is the keyboard/AT target.
        const el = e.target as HTMLElement | null
        if (el?.closest('a')) return
        navigateToJob()
      }}
    >
      {isNew ? (
        <div className={styles.newBadge} aria-label="New posting">
          NEW
        </div>
      ) : null}

      <header className={styles.header}>
        <div className={styles.logoWrap}>
          <CompanyLogo name={companyName} src={companyLogo} size="fill" />
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
          <h3 className={styles.title}>
            <Link
              href={jobHref}
              className={styles.titleLink}
              onClick={(e) => e.stopPropagation()}
            >
              {job.title}
            </Link>
          </h3>

          {hasSalary ? (
            <div className={styles.salaryStack}>
              <div className={styles.salaryPill} aria-label={`Salary ${salary}`}>
                <Banknote className={styles.salaryIcon} aria-hidden="true" />
                <span className={styles.salaryValue}>{salary}</span>
              </div>

              <span className={styles.verified} aria-label="Salary verified">
                <BadgeCheck className={styles.verifiedIcon} aria-hidden="true" />
                Salary shown
              </span>
            </div>
          ) : null}
        </div>

        <div className={styles.metaRow} aria-label="Job metadata">
          {locationData ? (
            <span className={styles.metaPill}>
              <MapPin className={styles.metaIcon} aria-hidden="true" />
              <CountryFlag code={locationData.countryCode} />
              {locationData.label}
              {locationData.hasMultiple ? ` +${locationData.count - 1}` : ''}
            </span>
          ) : null}

          {workType ? (
            <span className={styles.metaPill}>
              <workType.Icon className={styles.metaIcon} aria-hidden="true" />
              {workType.label}
            </span>
          ) : null}

          {seniority ? (
            <span className={styles.metaPill}>
              <TrendingUp className={styles.metaIcon} aria-hidden="true" />
              {seniority}
            </span>
          ) : null}

        </div>

        {truncatedSnippet ? (
          <p className={styles.snippet}>{truncatedSnippet}</p>
        ) : null}

        {shownSkills.length > 0 ? (
          <div className={styles.skills} aria-label="Skills">
            {shownSkills.map((s) => {
              const skillSlug = resolveSkillSlug(s)
              if (!skillSlug) {
                return (
                  <span key={s} className={styles.skill} title={skillLabel(s)}>
                    {skillLabel(s)}
                  </span>
                )
              }

              return (
                <Link
                  key={s}
                  href={`/jobs/skills/${skillSlug}`}
                  className={styles.skill}
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                  title={`Browse ${skillLabel(s)} jobs`}
                >
                  {skillLabel(s)}
                </Link>
              )
            })}
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
    </article>
  )
}
