'use client'

// One job as a single calm line (logo, title, company · posted, salary, location) that opens in place to show the
// summary, pills and skills. Used by the listing pages; the homepage, company pages and search keep JobCard.
import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { CountryFlag } from '@/components/ui/CountryFlag'
import {
  buildLocationDisplay,
  getWorkType,
  inferSeniority,
  parseJsonArray,
  resolveSkillSlug,
  toKCase,
  uniqStrings,
} from '@/components/jobs/JobCard'
import { cn } from '@/lib/utils'
import { buildLogoUrl } from '@/lib/companies/logo'
import { buildJobSlugHref } from '@/lib/jobs/jobSlug'
import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { buildSalaryText } from '@/lib/jobs/salary'
import { getJobCardSnippet } from '@/lib/jobs/snippet'
import { skillLabel } from '@/lib/jobs/skillLabel'
import { formatRelativeTime } from '@/lib/utils/time'

import styles from './JobRow.module.css'

const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000
const MAX_SUMMARY_CHARS = 320
const MAX_SKILLS = 8

/** Bordered container the rows sit in, separated by thin dividers. */
export function JobRowList({ children }: { children: ReactNode }) {
  return <div className={styles.list}>{children}</div>
}

export function JobRow({
  job,
  headingLevel = 3,
}: {
  job: JobWithCompany & { primaryLocation?: any; locationsJson?: any; aiSnippet?: string | null }
  /** 3 under an H2 section (default); 2 where the page H1 is followed directly by the list. */
  headingLevel?: 2 | 3
}) {
  const TitleTag = headingLevel === 2 ? 'h2' : 'h3'
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const companyName = String(job.companyRef?.name ?? (job as any)?.company ?? 'Company')
  const logo = buildLogoUrl(
    job.companyRef?.logoUrl ?? (job as any)?.companyLogo ?? null,
    job.companyRef?.website ?? null,
    companyName,
  )
  const salaryText = buildSalaryText(job)
  const salary = salaryText ? toKCase(salaryText) : null
  const location = buildLocationDisplay(job)
  const workType = getWorkType(job)
  const seniority = inferSeniority(job)
  const href = buildJobSlugHref(job as any)

  const posted = job.postedAt ?? job.createdAt ?? null
  const isNew = posted ? Date.now() - new Date(posted).getTime() < NEW_WINDOW_MS : false
  const postedLabel = formatRelativeTime(job.postedAt ?? job.updatedAt ?? job.createdAt ?? null)

  const rawSummary = (job as any).aiSnippet || getJobCardSnippet(job as any)
  const summary =
    typeof rawSummary === 'string' && rawSummary.length > MAX_SUMMARY_CHARS
      ? `${rawSummary.slice(0, MAX_SUMMARY_CHARS).trim()}…`
      : typeof rawSummary === 'string'
        ? rawSummary
        : ''
  const skills = uniqStrings([...parseJsonArray((job as any)?.techStack), ...parseJsonArray((job as any)?.skillsJson)])
  const shownSkills = skills.slice(0, MAX_SKILLS)

  return (
    <article className={cn(styles.row, open && styles.open)}>
      <div
        className={styles.main}
        onClick={(e) => {
          // A mouse convenience; the title link and the chevron button are the keyboard and screen-reader targets.
          if ((e.target as HTMLElement | null)?.closest('a, button')) return
          setOpen((v) => !v)
        }}
      >
        <div className={styles.logo}>
          <CompanyLogo name={companyName} src={logo} size="fill" />
        </div>

        <div className={styles.titleBlock}>
          <TitleTag className={styles.title}>
            <Link href={href} className={styles.titleLink}>
              {job.title}
            </Link>
          </TitleTag>
          <p className={styles.sub}>
            {companyName}
            {isNew ? (
              <span className={styles.newTag}>New</span>
            ) : postedLabel ? (
              // Relative to the clock at render, so cached server HTML can differ from the browser's.
              <span suppressHydrationWarning> · {postedLabel}</span>
            ) : null}
          </p>
        </div>

        <div className={styles.right}>
          {salary ? <span className={styles.salary}>{salary}</span> : null}
          {location ? (
            <span className={styles.location}>
              <CountryFlag code={location.countryCode} />
              {location.label}
              {location.hasMultiple ? ` +${location.count - 1}` : ''}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${open ? 'Hide' : 'Show'} details for ${job.title}`}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className={styles.chevron} aria-hidden="true" size={20} />
        </button>
      </div>

      {/* Kept in the page when closed (hidden, not removed) so nothing about the job is lost to crawlers. */}
      <div id={panelId} className={styles.panel} hidden={!open}>
        {summary ? <p className={styles.summary}>{summary}</p> : null}

        {workType || seniority ? (
          <div className={styles.pills}>
            {workType ? (
              <span className={styles.pill}>
                <workType.Icon size={14} aria-hidden="true" />
                {workType.label}
              </span>
            ) : null}
            {seniority ? <span className={styles.pill}>{seniority}</span> : null}
          </div>
        ) : null}

        {shownSkills.length > 0 ? (
          <div className={styles.skills} aria-label="Skills">
            {shownSkills.map((s) => {
              const slug = resolveSkillSlug(s)
              return slug ? (
                <Link key={s} href={`/jobs/skills/${slug}`} className={styles.skill} title={`Browse ${skillLabel(s)} jobs`}>
                  {skillLabel(s)}
                </Link>
              ) : (
                <span key={s} className={styles.skill}>
                  {skillLabel(s)}
                </span>
              )
            })}
          </div>
        ) : null}

        <Link href={href} className={styles.viewJob}>
          View job <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
