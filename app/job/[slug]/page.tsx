// app/job/[slug]/page.tsx

import type { Metadata } from 'next'
import NextLink from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'
import { prisma } from '../../../lib/prisma'
import { parseJobSlugParam, buildJobSlug } from '../../../lib/jobs/jobSlug'
import { buildJobMetadata } from '../../../lib/seo/jobMeta'
import { buildJobJsonLd } from '../../../lib/seo/jobJsonLd'
import { queryJobs, type JobWithCompany } from '../../../lib/jobs/queryJobs'
import { formatRelativeTime } from '../../../lib/utils/time'
import { buildLogoUrl } from '../../../lib/companies/logo'
import { buildSalaryText } from '../../../lib/jobs/salary'
import { SITE_NAME, getSiteUrl } from '../../../lib/seo/site'
import { buildSliceCanonicalPath } from '../../../lib/seo/canonical'
import {
  countryCodeToSlug,
  countryCodeToName,
  COUNTRY_CODE_TO_NAME,
} from '../../../lib/seo/countrySlug'
import { JobCard } from '@/components/jobs/JobCard'
import {
  BadgeCheck,
  Briefcase,
  Check,
  Clock,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

import { JobActions } from './JobActions'
import styles from './JobDetail.module.css'

export const revalidate = 3600

const SITE_URL = getSiteUrl()

// Feature flag (NO routing/SEO changes)
const AI_UI_ENABLED = process.env.AI_UI_ENABLED === '1'

// During rollout, code may deploy before the DB migration has run.
// Cache `true` once detected; keep re-checking while false.
let cachedHasJobShortIdColumn: true | null = null

async function hasJobShortIdColumn(): Promise<boolean> {
  if (cachedHasJobShortIdColumn) return true
  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND lower(table_name) = 'job'
          AND lower(column_name) = 'shortid'
      ) as "exists"
    `
    const exists = rows?.[0]?.exists === true
    if (exists) cachedHasJobShortIdColumn = true
    return exists
  } catch {
    return false
  }
}

function tryDecodeJidFromSlug(slug: string): string | null {
  const decoded = decodeURIComponent(slug || '')
  const lastSegment = decoded.split('/').pop() || decoded
  const match = lastSegment.match(/-jid-([A-Za-z0-9_-]+)/)
  if (!match?.[1]) return null

  try {
    const b64 = match[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    const jobId = Buffer.from(b64 + pad, 'base64').toString('utf8')
    return jobId || null
  } catch {
    return null
  }
}

function extractExternalIdFromJobId(jobId: string): string | null {
  if (!jobId) return null
  if (!jobId.includes(':')) return null
  const parts = jobId.split(':')
  return parts[parts.length - 1] || null
}

const getJobBySlug = cache(async (slug: string): Promise<JobWithCompany | null> => {
  const { jobId, externalId, shortId } = parseJobSlugParam(slug)

  const ors: any[] = []
  if (jobId) ors.push({ id: jobId })
  if (externalId) ors.push({ externalId })

  // v2.8 shortId lookup (only if DB has the column during rollout)
  const canUseShortId = Boolean(shortId) && (await hasJobShortIdColumn())
  if (shortId && canUseShortId) ors.push({ shortId })

  // Extra fallback for hybrid URLs where shortId is present but DB isn't migrated yet.
  // Only attempt when shortId routing is requested but not available.
  if (shortId && !canUseShortId) {
    const jidJobId = tryDecodeJidFromSlug(slug)
    if (jidJobId) {
      const decodedExternalId = extractExternalIdFromJobId(jidJobId)
      ors.push({ id: jidJobId })
      if (decodedExternalId) ors.push({ externalId: decodedExternalId })
    }
  }

  if (ors.length === 0) return null

  const where =
    ors.length === 1
      ? { ...ors[0], isExpired: false }
      : { OR: ors, isExpired: false }

  const job = await prisma.job.findFirst({
    where,
    include: { companyRef: true },
  })

  return (job as JobWithCompany) || null
})

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const job = await getJobBySlug(slug)
  if (!job) return { title: `Job not found | ${SITE_NAME}` }

  const canonicalSlug = buildJobSlug(job)
  const canonicalUrl = `${SITE_URL}/job/${canonicalSlug}`
  const base = buildJobMetadata(job)

  return {
    ...base,
    alternates: { ...(base.alternates ?? {}), canonical: canonicalUrl },
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function JobPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const typedJob = await getJobBySlug(slug)
  if (!typedJob) return notFound()
  const canonicalSlug = buildJobSlug(typedJob)

  // 301 redirect old slugs -> canonical v2.8 (no loops)
  const incoming = decodeURIComponent(slug || '').split('/').pop() || slug
  const isLegacy =
    incoming.includes('-jid-') || incoming.includes('-job-') || incoming.includes(':')
  const isAlreadyCanonical = incoming === canonicalSlug
  const shouldNormalizeV28 = incoming.includes('-j-') && !isAlreadyCanonical

  if (!isAlreadyCanonical && (isLegacy || shouldNormalizeV28)) {
    permanentRedirect(`/job/${canonicalSlug}`)
  }

  const company = typedJob.companyRef

  // Clean company name - take only the first part before description
  const rawCompanyName = company?.name || typedJob.company || 'Company'
  const companyName = cleanCompanyName(rawCompanyName)

  const logoUrl = buildLogoUrl(
    company?.logoUrl ?? typedJob.companyLogo ?? null,
    company?.website ?? null,
  )

  /* ------------------------------ Derived UI data ------------------------------ */

  const salaryText = buildSalaryText(typedJob)
  const locationText = buildLocationText(typedJob)
  const seniority = inferSeniorityFromTitle(typedJob.title)
  const postedLabel = formatRelativeTime(
    typedJob.postedAt ?? typedJob.createdAt ?? typedJob.updatedAt ?? null,
  )

  const requirements = parseArray(typedJob.requirementsJson)
  const benefitItems = ((): string[] => {
    const fromAi = extractBenefitsFromAi((typedJob as any)?.aiBenefits)
    const fromLegacy = parseArray(typedJob.benefitsJson)
    const raw = fromAi.length > 0 ? fromAi : fromLegacy
    return raw.map((b) => b.trim()).filter((b): b is string => b.length > 0)
  })()

  const showApply = isValidUrl(typedJob.applyUrl)

  // Prefer rich HTML, fallback to raw text
  const rawDescriptionHtml =
    (typedJob as any).descriptionHtml ?? (typedJob as any).description ?? (typedJob as any).body ?? null

  const safeDescriptionHtml = rawDescriptionHtml
    ? sanitizeDescriptionHtml(String(rawDescriptionHtml))
    : null

  const hasDescription = !!safeDescriptionHtml && safeDescriptionHtml.trim().length > 0

  const jsonLd = buildJobJsonLd(typedJob)
  const breadcrumbJsonLd = buildJobBreadcrumbJsonLd(typedJob, canonicalSlug)
  const internalLinks = buildInternalLinks(typedJob)

  // AI snippet / score (feature flagged)
  const aiSnippet =
    AI_UI_ENABLED && typeof (typedJob as any)?.aiSnippet === 'string'
      ? ((typedJob as any).aiSnippet as string)
      : null

  const aiQualityScore =
    AI_UI_ENABLED && typeof (typedJob as any)?.aiQualityScore === 'number'
      ? ((typedJob as any).aiQualityScore as number)
      : null

  const aiOneLiner = (typedJob.aiOneLiner ?? '').toString().trim() || null
  const aiSummaryBullets = (() => {
    const js = typedJob.aiSummaryJson
    if (!js || typeof js !== 'object') return []
    const bullets = (js as any).bullets
    if (!Array.isArray(bullets)) return []
    return bullets
      .map((b) => (typeof b === 'string' ? b : String(b)).trim())
      .filter((b): b is string => b.length > 0)
  })()

  /* --------------------------- Similar jobs -------------------------------- */

  const similarResult = await queryJobs({
    roleSlugs: typedJob.roleSlug ? [typedJob.roleSlug] : undefined,
    countryCode: typedJob.countryCode || undefined,
    isHundredKLocal: true,
    page: 1,
    pageSize: 6,
  })

  const similarJobs = similarResult.jobs.filter((j) => j.id !== typedJob.id).slice(0, 3)

  const companyCountry = company?.countryCode || typedJob.countryCode || 'Global'
  const isSalaryVerified = Boolean((typedJob as any)?.salaryValidated)
  const companyProfileVerified = Boolean(company?.slug)
  const lastUpdatedDays = daysSince(typedJob.updatedAt ?? typedJob.lastSeenAt ?? null)

  const isRemoteRole = typedJob.remote === true || (typedJob as any).remoteMode === 'remote'
  const workTypeLabel = isRemoteRole
    ? null
    : (typedJob as any).remoteMode === 'hybrid'
      ? 'Hybrid'
      : (typedJob as any).remoteMode === 'onsite'
        ? 'Onsite'
        : null

  const employmentType = typedJob.type || (typedJob as any).employmentType || null
  const teamSize =
    company?.sizeBucket ||
    (typeof (company as any)?.employeeCount === 'number'
      ? String((company as any).employeeCount)
      : null)

  const skills = parseSkillsFromJob(typedJob)
  const requiredSkills = skills.slice(0, 10)
  const niceSkills = skills.slice(10, 18)

  const { responsibilities, requirements: resolvedRequirements } = extractRoleLists(
    typedJob,
    requirements,
  )

  /* ------------------------------ Render ----------------------------------- */

  return (
    <main className={styles.page}>
      <div className={styles.bgGlow} />

      <div className={styles.container}>
        <NextLink href="/jobs" className={styles.backLink}>
          <span aria-hidden="true">←</span> Back to jobs
        </NextLink>

        <header className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.logoWrap}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={`${companyName} logo`}
                  className={styles.logoImg}
                  loading="lazy"
                />
              ) : (
                <div className={styles.logoFallback} aria-hidden="true">
                  {companyName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <h1 className={styles.title}>{typedJob.title}</h1>

              {aiOneLiner ? <p className={styles.oneLiner}>{aiOneLiner}</p> : null}

              <div className={styles.companyRow}>
                {company?.slug ? (
                  <NextLink href={`/company/${company.slug}`} className={styles.companyLink}>
                    {companyName}
                  </NextLink>
                ) : (
                  <span className={styles.companyLink}>{companyName}</span>
                )}

                <span className={styles.verifiedBadge}>
                  <BadgeCheck className={styles.metaIcon} aria-hidden="true" />
                  {isSalaryVerified ? 'Salary verified' : 'Verified listing'}
                </span>
              </div>

              <div className={styles.metaBadges}>
                {locationText ? (
                  <span className={styles.metaBadge}>
                    <MapPin className={styles.metaIcon} aria-hidden="true" />
                    {locationText}
                  </span>
                ) : null}
                {workTypeLabel ? (
                  <span className={styles.metaBadge}>
                    <Briefcase className={styles.metaIcon} aria-hidden="true" />
                    {workTypeLabel}
                  </span>
                ) : null}
                {postedLabel ? (
                  <span className={styles.metaBadge}>
                    <Clock className={styles.metaIcon} aria-hidden="true" />
                    Posted {postedLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className={styles.actionBarOuter} aria-label="Action bar">
          <div className={styles.actionBar}>
            <div className={styles.salaryBox}>
              <div className={styles.salaryLabel}>Salary Range</div>
              <div className={styles.salaryValue}>{salaryText || 'Not disclosed'}</div>
              <div className={styles.salaryPeriod}>per year</div>
            </div>

            <div className={styles.actions}>
              {showApply ? (
                <a
                  href={cleanUrl(typedJob.applyUrl!)}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  className={styles.applyButton}
                >
                  Apply Now <ExternalLink aria-hidden="true" />
                </a>
              ) : null}

              <JobActions jobId={typedJob.id} shareUrl={`${SITE_URL}/job/${canonicalSlug}`} />
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <section className={styles.card}>
              <div className={styles.cardTitle}>Job Highlights</div>
              <div className={styles.highlightGrid}>
                <div className={styles.highlightRow}>
                  <div className={styles.highlightLeft}>
                    <div className={styles.iconChip} aria-hidden="true">
                      <Sparkles />
                    </div>
                    <div>
                      <div className={styles.hlLabel}>Seniority</div>
                      <div className={styles.hlValue}>{seniority || '—'}</div>
                    </div>
                  </div>
                </div>

                <div className={styles.highlightRow}>
                  <div className={styles.highlightLeft}>
                    <div className={styles.iconChip} aria-hidden="true">
                      <Users />
                    </div>
                    <div>
                      <div className={styles.hlLabel}>Team size</div>
                      <div className={styles.hlValue}>{teamSize || '—'}</div>
                    </div>
                  </div>
                </div>

                <div className={styles.highlightRow}>
                  <div className={styles.highlightLeft}>
                    <div className={styles.iconChip} aria-hidden="true">
                      <Briefcase />
                    </div>
                    <div>
                      <div className={styles.hlLabel}>Employment type</div>
                      <div className={styles.hlValue}>{employmentType || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>Verification</div>
              <div className={styles.checkList}>
                <div className={styles.checkItem}>
                  <span className={styles.checkCircle} aria-hidden="true">
                    <Check />
                  </span>
                  <span>{isSalaryVerified ? 'Salary verified from ATS' : 'Salary listed in the job posting'}</span>
                </div>
                <div className={styles.checkItem}>
                  <span className={styles.checkCircle} aria-hidden="true">
                    <Check />
                  </span>
                  <span>{companyProfileVerified ? 'Company profile verified' : 'Company profile available'}</span>
                </div>
                <div className={styles.checkItem}>
                  <span className={styles.checkCircle} aria-hidden="true">
                    <Check />
                  </span>
                  <span>
                    Last updated {lastUpdatedDays != null ? `${lastUpdatedDays} days ago` : 'recently'}
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>About Company</div>
              <p className={styles.cardSubtitle}>
                {company?.description
                  ? truncateText(stripTags(decodeHtmlEntities(company.description)), 200)
                  : `${companyName} is hiring six-figure talent across multiple teams.`}
              </p>

              <div className={styles.aboutCompanyMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Country</span>
                  <span>{companyCountry}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Employees</span>
                  <span>{company?.sizeBucket || (company as any)?.employeeCount || '—'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Founded</span>
                  <span>{company?.foundedYear || '—'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Website</span>
                  {isValidUrl(company?.website) ? (
                    <a href={cleanUrl(company!.website!)} target="_blank" rel="nofollow noreferrer">
                      Visit <ExternalLink aria-hidden="true" style={{ width: 14, height: 14 }} />
                    </a>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>Required Skills</div>
              {requiredSkills.length > 0 ? (
                <>
                  <div className={styles.skillsWrap}>
                    {requiredSkills.map((s) => (
                      <span key={s} className={`${styles.skillPill} ${styles.skillRequired}`}>
                        {s}
                      </span>
                    ))}
                  </div>

                  {niceSkills.length > 0 ? (
                    <>
                      <div className={styles.dividerLabel}>Nice to have</div>
                      <div className={styles.skillsWrap}>
                        {niceSkills.map((s) => (
                          <span key={s} className={`${styles.skillPill} ${styles.skillNice}`}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <p className={styles.cardSubtitle}>Skills not listed on the ATS page.</p>
              )}
            </section>
          </aside>

          {/* --------------------------- Job Content --------------------------- */}
          <section className={styles.content}>

            {/* Highlights */}
            {(aiSnippet || aiSummaryBullets.length > 0) && (
              <section className={styles.card}>
                <div className={styles.cardTitle}>
                  <span>✨ Role Highlights</span>
                  {AI_UI_ENABLED && aiQualityScore != null ? (
                    <span className={styles.verifiedBadge}>AI score: {aiQualityScore}/3</span>
                  ) : null}
                </div>

                {aiSnippet ? <p className={styles.cardSubtitle}>{aiSnippet}</p> : null}

                {aiSummaryBullets.length > 0 ? (
                  <div className={styles.checkList}>
                    {aiSummaryBullets.map((line, idx) => (
                      <div key={idx} className={styles.checkItem}>
                        <span className={styles.checkCircle} aria-hidden="true">
                          <Check />
                        </span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            )}

            {/* Full job description (always show when available) */}
            <section className={styles.card}>
              <div className={styles.cardTitle}>
                <span>📋 Full Job Description</span>
              </div>

              {hasDescription ? (
                <div
                  className={`prose prose-invert max-w-none ${styles.richText}`}
                  dangerouslySetInnerHTML={{ __html: safeDescriptionHtml! }}
                />
              ) : (
                <p className={styles.cardSubtitle}>
                  This role is sourced directly from the employer&apos;s careers site. The full job description is available on their ATS.
                </p>
              )}
            </section>

            {responsibilities.length > 0 ? (
              <section className={styles.card}>
                <div className={styles.cardTitle}>Responsibilities</div>
                <div className={styles.checkList}>
                  {responsibilities.slice(0, 10).map((r, i) => (
                    <div key={i} className={styles.checkItem}>
                      <span className={styles.checkCircle} aria-hidden="true">
                        <Check />
                      </span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Requirements */}
            {resolvedRequirements.length > 0 ? (
              <section className={styles.card}>
                <div className={styles.cardTitle}>Requirements</div>
                <div className={styles.checkList}>
                  {resolvedRequirements.slice(0, 12).map((r, i) => (
                    <div key={i} className={styles.checkItem}>
                      <span className={styles.checkCircle} aria-hidden="true">
                        <Check />
                      </span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Benefits */}
            {benefitItems.length > 0 ? (
              <section className={styles.card}>
                <div className={styles.cardTitle}>Benefits</div>
                <div className={styles.benefitsGrid}>
                  {benefitItems.slice(0, 12).map((b, i) => (
                    <div key={i} className={styles.benefitCard}>
                      <div className={styles.benefitIcon} aria-hidden="true">
                        <ShieldCheck />
                      </div>
                      <div className={styles.benefitText}>{formatBenefitPill(b)}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {showApply ? (
              <section className={styles.card}>
                <div className={styles.applyCta}>
                  <div>
                    <div className={styles.cardTitle}>Apply on the company site</div>
                    <p className={styles.cardSubtitle}>
                      Opens in a new tab. Six Figure Jobs doesn&apos;t track your application.
                    </p>
                  </div>
                  <a
                    href={cleanUrl(typedJob.applyUrl!)}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    className={styles.applyButton}
                  >
                    Apply Now <ExternalLink aria-hidden="true" />
                  </a>
                </div>
              </section>
            ) : null}

            {/* Internal Links */}
            {internalLinks.length > 0 ? (
              <section className={styles.card}>
                <div className={styles.cardTitle}>Explore related pages</div>
                <div className={styles.checkList}>
                  {internalLinks.slice(0, 8).map((link) => (
                    <div key={link.href} className={styles.checkItem}>
                      <span className={styles.checkCircle} aria-hidden="true">
                        <Check />
                      </span>
                      <NextLink href={link.href} className={styles.companyLink}>
                        {link.label}
                      </NextLink>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        </div>

        {similarJobs.length > 0 ? (
          <section className={styles.similarGrid}>
            <div className={styles.similarHeader}>
              <div>
                <div className={styles.similarTitle}>Similar Six Figure Opportunities</div>
                <div className={styles.similarSub}>Based on role, country and salary band</div>
              </div>
            </div>
            <div className={styles.similarCards}>
              {similarJobs.map((sj) => (
                <JobCard key={sj.id} job={sj as JobWithCompany} />
              ))}
            </div>
          </section>
        ) : null}

        {/* JSON-LD (keep existing schema) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Clean company name - extract just the company name, not description
 * Handles cases like "InstacartA grocery technology platform..."
 */
function cleanCompanyName(name: string): string {
  if (!name) return 'Company'

  const patterns = [
    /^([A-Z][a-z]+(?:[A-Z][a-z]+)*)[A-Z][a-z]/,
    /^([^.]+?)\s*[.]/,
    /^(.+?)\s+(?:is|are|was|provides|offers|builds|creates|develops)/i,
  ]

  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match && match[1] && match[1].length >= 2 && match[1].length <= 50) {
      return match[1].trim()
    }
  }

  if (name.length > 50) {
    const spaceIdx = name.indexOf(' ', 20)
    if (spaceIdx > 0 && spaceIdx < 50) {
      return name.slice(0, spaceIdx)
    }
    return name.slice(0, 50)
  }

  return name
}

function parseArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p.map(String) : []
  } catch {
    return []
  }
}

function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  const ms = Date.now() - d.getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function parseSkillsFromJob(job: any): string[] {
  const out: string[] = []

  const fromJson = parseArray(job?.skillsJson)
  if (fromJson.length) out.push(...fromJson)

  const rawTech = typeof job?.techStack === 'string' ? job.techStack : ''
  if (rawTech) {
    out.push(
      ...rawTech
        .split(/[,|/•·]/g)
        .map((s: string) => s.trim())
        .filter(Boolean),
    )
  }

  const cleaned = out
    .map((s) => stripTags(decodeHtmlEntities(String(s))).trim())
    .filter((s) => s.length > 0 && s.length <= 40)

  return Array.from(new Set(cleaned))
}

function extractRoleLists(
  job: any,
  fallbackRequirements: string[],
): { responsibilities: string[]; requirements: string[] } {
  const raw = job?.aiRequirements

  const parsed = (() => {
    if (!raw) return null
    if (Array.isArray(raw)) return { requirements: raw.map(String) }
    if (typeof raw === 'string') {
      try {
        const p = JSON.parse(raw)
        return p
      } catch {
        return null
      }
    }
    if (typeof raw === 'object') return raw
    return null
  })()

  const responsibilities = (() => {
    const arr =
      (parsed && Array.isArray((parsed as any).responsibilities) && (parsed as any).responsibilities) ||
      (parsed && Array.isArray((parsed as any).responsibility) && (parsed as any).responsibility) ||
      []
    return Array.isArray(arr) ? arr.map(String) : []
  })()

  const requirements = (() => {
    const arr =
      (parsed && Array.isArray((parsed as any).requirements) && (parsed as any).requirements) ||
      (parsed && Array.isArray((parsed as any).bullets) && (parsed as any).bullets) ||
      null
    if (arr && Array.isArray(arr)) return arr.map(String)
    return fallbackRequirements
  })()

  const normalize = (items: string[]) =>
    Array.from(
      new Set(
        items
          .map((s) => stripTags(decodeHtmlEntities(String(s))).trim())
          .filter((s) => s.length > 0),
      ),
    )

  return {
    responsibilities: normalize(responsibilities),
    requirements: normalize(requirements),
  }
}

function extractBenefitsFromAi(raw: any): string[] {
  if (!raw) return []

  // Prisma Json fields can be objects/arrays, but may also be stored as string in older rows.
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(String)
      if (parsed && typeof parsed === 'object') {
        const items = (parsed as any).benefits ?? (parsed as any).items ?? (parsed as any).bullets
        return Array.isArray(items) ? items.map(String) : []
      }
    } catch {
      return []
    }
  }

  if (raw && typeof raw === 'object') {
    const items = raw.benefits ?? raw.items ?? raw.bullets
    return Array.isArray(items) ? items.map(String) : []
  }

  return []
}

/**
 * Build location text - handles remote vs physical location
 */
function buildLocationText(job: any): string {
  const isRemote = job.remote === true || job.remoteMode === 'remote'

  if (isRemote) {
    const cc = typeof job.countryCode === 'string' ? job.countryCode.trim().toUpperCase() : ''
    if (cc) {
      const flag =
        cc.length === 2 && /^[A-Z]{2}$/.test(cc)
          ? String.fromCodePoint(0x1f1e6 + (cc.charCodeAt(0) - 65), 0x1f1e6 + (cc.charCodeAt(1) - 65))
          : ''
      return `${flag ? `${flag} ` : ''}Remote (${cc})`
    }
    return '🌍 Remote'
  }

  const hasValidCityAndCountry =
    job.city && job.countryCode && isLocationValid(job.city, job.countryCode, job.locationRaw)

  if (hasValidCityAndCountry) return `${job.city}, ${job.countryCode}`

  if (job.locationRaw) return job.locationRaw
  if (job.countryCode) return job.countryCode
  return 'Location not specified'
}

type InternalLink = { href: string; label: string }

function prettyRole(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildInternalLinks(job: JobWithCompany): InternalLink[] {
  const links: InternalLink[] = []
  const companyName = cleanCompanyName(job.companyRef?.name || job.company || '')
  const countryCode = job.countryCode?.toUpperCase() ?? null
  const countryName = countryCode ? countryCodeToName(countryCode) : null
  const hasCountryInfo = Boolean(countryCode && countryName)
  const isCountryMismatch =
    countryName && countryCode ? countryName.toUpperCase() !== countryCode : false
  const isCountryRecognized = hasCountryInfo && isCountryMismatch
  const countrySlug = isCountryRecognized && countryCode ? countryCodeToSlug(countryCode) : null
  const roleSlug = job.roleSlug
  const roleLabel = roleSlug ? prettyRole(roleSlug) : ''

  if (roleSlug && isCountryRecognized && countrySlug) {
    links.push({
      href: `/jobs/${roleSlug}/${countrySlug}/100k-plus`,
      label: `$100k+ ${roleLabel} jobs in ${countryName ?? countryCode ?? 'this country'}`,
    })
  }

  if (isCountryRecognized && countrySlug) {
    links.push({
      href: `/jobs/${countrySlug}/100k-plus`,
      label: `$100k+ jobs in ${countryName}`,
    })
  }

  if (roleSlug) {
    links.push({
      href: `/jobs/${roleSlug}/remote/100k-plus`,
      label: `Remote $100k+ ${roleLabel} jobs`,
    })
  }

  links.push({ href: '/jobs/100k-plus', label: 'All Six Figure Jobs' })

  if (roleSlug) {
    links.push({ href: `/salary/${roleSlug}`, label: `${roleLabel} salary guide` })
  }

  if (job.companyRef?.slug) {
    links.push({ href: `/company/${job.companyRef.slug}`, label: `More jobs at ${companyName}` })
  }

  return links
}

function cleanUrl(url: string): string {
  if (!url) return '#'
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

function isValidUrl(url?: string | null): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

function buildJobBreadcrumbJsonLd(job: JobWithCompany, slug: string): any {
  const items: any[] = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${SITE_URL}/jobs/100k-plus` },
  ]

  if (job.roleSlug && job.countryCode) {
    const roleLabel = prettyRole(job.roleSlug)
    const cc = job.countryCode.toUpperCase()
    const path = buildSliceCanonicalPath({
      isHundredKLocal: true,
      roleSlugs: [job.roleSlug],
      countryCode: job.countryCode,
    })

    items.push({
      '@type': 'ListItem',
      position: 3,
      name: `${roleLabel} jobs in ${cc}`,
      item: `${SITE_URL}${path}`,
    })
  }

  items.push({
    '@type': 'ListItem',
    position: items.length + 1,
    name: job.title,
    item: `${SITE_URL}/job/${slug}`,
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

function decodeHtmlEntities(str: string): string {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function stripTags(str: string): string {
  return (str || '').replace(/<\/?[^>]+(>|$)/g, '')
}

function truncateText(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str

  const truncated = str.slice(0, maxChars)
  const lastDot = truncated.lastIndexOf('.')
  const lastSpace = truncated.lastIndexOf(' ')

  const cutoff: number =
    lastDot !== -1 && lastDot > maxChars * 0.6
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

function sanitizeDescriptionHtml(html: string): string {
  // IMPORTANT: decode first so escaped HTML becomes real tags before filtering
  const decoded = decodeHtmlEntities(html || '')

  const withoutScripts = decoded.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  const withoutStyles = withoutScripts.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  const withoutComments = withoutStyles.replace(/<!--[\s\S]*?-->/g, '')

  const allowedTags = ['p', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'br']
  const filtered = withoutComments.replace(
    /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
    (match, tag) => {
      const lower = String(tag).toLowerCase()
      if (allowedTags.includes(lower)) {
        return `<${match.startsWith('</') ? '/' : ''}${lower}>`
      }
      return ''
    },
  )

  const withBreaks = filtered
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n/g, '<br />')
    .replace(/(<br\s*\/?>\s*){2,}/gi, '</p><p>')

  const trimmed = withBreaks.trim()
  if (!trimmed) return ''
  const hasParagraph = /<p[\s>]/i.test(trimmed)
  return hasParagraph ? trimmed : `<p>${trimmed}</p>`
}

function detectCountryFromText(raw?: string | null): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  for (const [code, name] of Object.entries(COUNTRY_CODE_TO_NAME)) {
    if (lower.includes(name.toLowerCase())) return code
  }
  return null
}

function isLocationValid(
  city?: string | null,
  countryCode?: string | null,
  locationRaw?: string | null,
): boolean {
  if (!city || !countryCode) return false
  if (!locationRaw) return true
  const normalizedCountry = countryCodeToName(countryCode).toLowerCase()
  const rawLower = locationRaw.toLowerCase()
  if (rawLower.includes(normalizedCountry)) return true
  const detected = detectCountryFromText(locationRaw)
  if (detected && detected !== countryCode.toUpperCase()) return false
  return true
}

function formatBenefitPill(benefit: string): string {
  const text = stripTags(decodeHtmlEntities(benefit)).trim()
  return truncateText(text, 90)
}
