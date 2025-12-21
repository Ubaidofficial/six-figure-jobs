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
  job: JobWithCompany
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

function parseStringArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
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

  const workType = getWorkType(job)
  const seniority = inferSeniority(job)

  const cc = job.countryCode ? String(job.countryCode).toUpperCase() : null
  const flag = countryFlag(cc)
  const city = job.city ? String(job.city).trim() : ''
  const locationLabel =
    job.remote === true || job.remoteMode === 'remote'
      ? 'Remote'
      : city && cc
        ? `${flag ? `${flag} ` : ''}${city}, ${cc}`
        : cc
          ? `${flag ? `${flag} ` : ''}${cc}`
          : job.locationRaw
            ? String(job.locationRaw)
            : null

  const snippet = getJobCardSnippet(job as any)
  const skills = parseStringArray((job as any)?.skillsJson).filter(Boolean)
  const shownSkills = skills.slice(0, 5)
  const extraSkills = Math.max(0, skills.length - shownSkills.length)

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
                🎁
              </span>
            ) : null}
          </div>
        </div>

        <div className={styles.badges}>
          <span className={styles.verified} aria-label="Salary verified">
            <BadgeCheck className={styles.verifiedIcon} aria-hidden="true" />
            ✓ Salary Verified
          </span>
        </div>
      </header>

      <div className={styles.body}>
        <h3 className={styles.title}>{job.title}</h3>

        <div className={styles.metaGrid} aria-label="Job metadata">
          <div className={styles.metaItem}>
            <MapPin className={styles.metaIcon} aria-hidden="true" />
            <span className={styles.metaLabel}>📍 Location</span>
            <span className={styles.metaValue}>{locationLabel ?? '—'}</span>
          </div>

          <div className={styles.metaItem}>
            {workType ? <workType.Icon className={styles.metaIcon} aria-hidden="true" /> : null}
            <span className={styles.metaLabel}>🌍 Work type</span>
            <span className={styles.metaValue}>{workType?.label ?? '—'}</span>
          </div>

          <div className={styles.metaItem}>
            <TrendingUp className={styles.metaIcon} aria-hidden="true" />
            <span className={styles.metaLabel}>Seniority</span>
            <span className={styles.metaValue}>{seniority ?? '—'}</span>
          </div>

          <div className={cn(styles.metaItem, styles.salaryBox)}>
            <span className={styles.salaryTop}>
              <span className={styles.salaryIcon} aria-hidden="true">
                💰
              </span>
              <span className={styles.metaLabel}>Salary</span>
            </span>
            <span className={styles.salaryValue}>{salary ?? 'High salary role'}</span>
          </div>
        </div>

        <p className={styles.snippet}>
          {snippet || 'Verified compensation and direct application links from company ATS systems.'}
        </p>

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
