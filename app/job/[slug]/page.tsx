// app/job/[slug]/page.tsx

import type { Metadata } from 'next'
import NextLink from 'next/link'
import NextImage from 'next/image'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'
import { JobUnavailablePage } from '@/components/runtime/FallbackPresets'
import { prisma } from '../../../lib/prisma'
import { parseJobSlugParam, buildJobSlug } from '../../../lib/jobs/jobSlug'
import { buildJobMetadata } from '../../../lib/seo/jobMeta'
import { buildJobJsonLd } from '../../../lib/seo/jobJsonLd'
import { buildJobBreadcrumbJsonLd } from '../../../lib/seo/jobBreadcrumbJsonLd'
import { queryJobs, type JobQueryResult, type JobWithCompany } from '../../../lib/jobs/queryJobs'
import { filterSimilarJobs } from '../../../lib/jobs/similarJobs'
import { buildRuntimeFallbackMetadata, withRuntimeFallback } from '@/lib/runtime/fallback'
import { isJobDetailAvailable } from '../../../lib/jobs/detailAvailability'
import { evaluateJobIndexability } from '../../../lib/jobs/qualityGate'
import { formatRelativeTime } from '../../../lib/utils/time'
import { buildLogoUrl } from '../../../lib/companies/logo'
import { normalizePublicCompanyWebsite } from '../../../lib/companies/website'
import { buildSalaryText } from '../../../lib/jobs/salary'
import { SITE_NAME, getSiteUrl } from '../../../lib/seo/site'
import { cleanJobDescriptionHtml } from '../../../lib/jobs/descriptionCleaning'
import {
  countryCodeToSlug,
  countryCodeToName,
  COUNTRY_CODE_TO_NAME,
} from '../../../lib/seo/countrySlug'
import { CITY_TARGET_SLUG_SET } from '../../../lib/seo/pseoTargets'
import { resolveIndexableRoleSlug } from '../../../lib/roles/indexableRole'
import { JobCard } from '@/components/jobs/JobCard'
import { Clock, Laptop, MapPin } from 'lucide-react'

import { SKILL_TARGETS } from '../../../lib/seo/pseoTargets'
import { Badge, badgeVariants } from '@/components/ui/badge'
import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { cn } from '@/lib/utils'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import {
  ApplyCard,
  BulletList,
  CompanyCard,
  JobSection,
  MobileApplyBar,
} from './JobDetailParts'
import styles from './JobDetail.module.css'

const SKILL_SLUG_SET = new Set(SKILL_TARGETS.map((s) => s.slug))
const SKILL_LABEL_MAP = new Map(SKILL_TARGETS.map((s) => [s.slug, s.label]))

export const revalidate = 3600

const SITE_URL = getSiteUrl()

// Feature flag (NO routing/SEO changes)
const AI_UI_ENABLED = process.env.AI_UI_ENABLED === '1'



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

  // v2.8 shortId lookup
  if (shortId) ors.push({ shortId })



  if (ors.length === 0) return null

  const where =
    ors.length === 1
      ? { ...ors[0], isExpired: false }
      : { OR: ors, isExpired: false }

  const job = await prisma.job.findFirst({
    where,
    include: { companyRef: true },
  })

  if (!job || !isJobDetailAvailable(job)) return null

  return job as JobWithCompany
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
  return withRuntimeFallback<Metadata>(
    `job.${slug}.metadata`,
    async () => {
      const job = await getJobBySlug(slug)
      if (!job) return { title: `Job not found | ${SITE_NAME}` }

      const canonicalSlug = buildJobSlug(job)
      const canonicalUrl = `${SITE_URL}/job/${canonicalSlug}`
      const base = buildJobMetadata(job)
      const qualityGate = evaluateJobIndexability(job)

      return {
        ...base,
        alternates: { ...(base.alternates ?? {}), canonical: canonicalUrl },
        other: {
          'og:updated_time': (
            job.postedAt ??
            job.createdAt ??
            job.updatedAt ??
            new Date()
          ).toISOString(),
        },
        robots: qualityGate.indexable
          ? (base.robots ?? { index: true, follow: true })
          : { index: false, follow: true },
      }
    },
    () =>
      buildRuntimeFallbackMetadata({
        canonicalPath: `/job/${slug}`,
        title: `Job page temporarily unavailable | ${SITE_NAME}`,
        description:
          'The live job page is temporarily unavailable while the production database reconnects.',
      }),
  )
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
  const loadState = await withRuntimeFallback<
    { status: 'ready'; job: JobWithCompany | null } | { status: 'fallback' }
  >(
    `job.${slug}.page.load`,
    async () => ({ status: 'ready' as const, job: await getJobBySlug(slug) }),
    () => ({ status: 'fallback' as const }),
  )
  if (loadState.status === 'fallback') {
    return (
      <JobUnavailablePage
        title="This job page is temporarily unavailable"
        description="The live job detail page is temporarily unavailable while the production database reconnects. Browse the main jobs index and retry this role once data access is restored."
        primaryHref={`/job/${slug}`}
        primaryLabel="Retry job page"
      />
    )
  }

  const typedJob = loadState.job
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

  const rawCompanyName = company?.name || typedJob.company || 'Company'
  const companyName = fullCompanyName(rawCompanyName)

  const logoUrl = buildLogoUrl(
    company?.logoUrl ?? typedJob.companyLogo ?? null,
    company?.website ?? null,
    companyName,
  )

  /* ------------------------------ Derived UI data ------------------------------ */

  const salaryText = buildSalaryText(typedJob)
  const locationText = buildLocationText(typedJob)
  const canonicalRoleSlug = resolveIndexableRoleSlug(typedJob.roleSlug)
  const seniority = inferSeniorityFromTitle(typedJob.title)
  const postedLabel = formatRelativeTime(
    typedJob.postedAt ?? typedJob.createdAt ?? typedJob.updatedAt ?? null,
  )
  const hasSalary = Boolean(salaryText)

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

  const rawDescriptionString = rawDescriptionHtml ? String(rawDescriptionHtml) : ''
  const isOversizedDescription = rawDescriptionString.length > 100_000
  const safeDescriptionHtml =
    rawDescriptionString && !isOversizedDescription
      ? sanitizeDescriptionHtml(cleanJobDescriptionHtml(rawDescriptionString))
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
  const aiStructured = (() => {
    const js = typedJob.aiSummaryJson
    const empty = { bullets: [] as string[], description: [] as string[], requirements: [] as string[], benefits: [] as string[] }
    if (!js || typeof js !== 'object') return empty

    const pickArray = (key: string, max: number): string[] => {
      const raw = (js as any)[key]
      if (!Array.isArray(raw)) return []
      return raw
        .map((v) => (typeof v === 'string' ? v : String(v)).trim())
        .filter((v): v is string => v.length > 0)
        .slice(0, max)
    }

    return {
      bullets: pickArray('bullets', 5),
      description: pickArray('description', 6),
      requirements: pickArray('requirements', 8),
      benefits: pickArray('benefits', 5),
    }
  })()

  const hasStructuredSections =
    aiStructured.description.length > 0 ||
    aiStructured.requirements.length > 0 ||
    aiStructured.benefits.length > 0

  /* --------------------------- Similar jobs -------------------------------- */

  const similarResult = await withRuntimeFallback<JobQueryResult>(
    `job.${typedJob.id}.similar`,
    async () =>
      queryJobs({
        roleSlugs: canonicalRoleSlug ? [canonicalRoleSlug] : undefined,
        countryCode: typedJob.countryCode || undefined,
        isHundredKLocal: true,
        page: 1,
        pageSize: 7,
      }),
    () => ({
      jobs: [],
      total: 0,
      page: 1,
      pageSize: 7,
      totalPages: 1,
    }),
  )

  const similarJobs = filterSimilarJobs(typedJob, similarResult.jobs, 6)

  const companyCountry = company?.countryCode || typedJob.countryCode || 'Global'
  const isSalaryVerified =
    hasSalary &&
    typedJob.salaryValidated === true &&
    typedJob.salarySource === 'ats'
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

  const metaItems = [
    { Icon: MapPin, label: locationText },
    { Icon: Laptop, label: isRemoteRole ? 'Remote' : workTypeLabel },
    { Icon: Clock, label: postedLabel ? `Posted ${postedLabel}` : null },
  ].filter((m): m is { Icon: typeof MapPin; label: string } => Boolean(m.label))

  const jobFacts = [
    { label: 'Type', value: employmentType },
    { label: 'Level', value: seniority },
    { label: 'Team size', value: teamSize },
    {
      label: 'Updated',
      value: lastUpdatedDays == null ? null : lastUpdatedDays === 0 ? 'Today' : `${lastUpdatedDays} days ago`,
    },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value))

  const companyFacts = [
    { label: 'Country', value: companyCountry },
    { label: 'Employees', value: company?.sizeBucket || (company as any)?.employeeCount || null },
    { label: 'Founded', value: company?.foundedYear ? String(company.foundedYear) : null },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value))

  const applyHref = showApply ? cleanUrl(typedJob.applyUrl!) : null
  const websiteHref = normalizePublicCompanyWebsite(company?.website ?? null)
  const companyBlurb = company?.description
    ? truncateText(stripTags(decodeHtmlEntities(company.description)), 220)
    : null

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:pb-14 lg:pt-8">
      {/* Same three names as the BreadcrumbList JSON-LD, so the markup matches what users see. */}
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Jobs', href: '/jobs' },
            { label: `${typedJob.title} at ${companyName}` },
          ]}
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <article className="min-w-0 space-y-10">
          <header>
            <div className="flex items-start gap-4">
              <CompanyLogo name={companyName} src={logoUrl} size="xl" priority />
              <div className="min-w-0">
                <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  {typedJob.title}
                </h1>
                <p className="mt-1 text-base text-muted-foreground">
                  {company?.slug ? (
                    <NextLink href={`/company/${company.slug}`} className="text-foreground hover:underline underline-offset-4">
                      {companyName}
                    </NextLink>
                  ) : (
                    <span className="text-foreground">{companyName}</span>
                  )}
                </p>
              </div>
            </div>

            {metaItems.length > 0 ? (
              <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {metaItems.map(({ Icon, label }) => (
                  <li key={label} className="flex items-center gap-1.5">
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}

            {/* On phones the salary leads the page; on desktop it lives in the sticky card. */}
            <p className="mt-4 font-mono text-xl font-semibold text-foreground lg:hidden">
              {salaryText || 'Salary not disclosed'}
            </p>

            {aiOneLiner ? (
              <p className="mt-5 max-w-[68ch] text-lg leading-relaxed text-foreground/90">{aiOneLiner}</p>
            ) : null}
          </header>

          {hasStructuredSections ? (
            <>
              {aiStructured.description.length > 0 ? (
                <JobSection title="About the role">
                  <div className="max-w-[68ch] space-y-3 text-[15px] leading-relaxed text-foreground/90">
                    {aiSnippet ? <p>{aiSnippet}</p> : null}
                    {aiStructured.description.map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                </JobSection>
              ) : null}
              {aiStructured.requirements.length > 0 ? (
                <JobSection title="Requirements">
                  <BulletList items={aiStructured.requirements} />
                </JobSection>
              ) : null}
              {aiStructured.benefits.length > 0 ? (
                <JobSection title="Benefits and perks">
                  <BulletList items={aiStructured.benefits} />
                </JobSection>
              ) : null}
            </>
          ) : (
            <>
              {aiStructured.bullets.length > 0 ? (
                <JobSection title="Role highlights">
                  <BulletList items={aiStructured.bullets} />
                </JobSection>
              ) : null}
              {responsibilities.length > 0 ? (
                <JobSection title="Responsibilities">
                  <BulletList items={responsibilities.slice(0, 5)} />
                </JobSection>
              ) : null}
              {resolvedRequirements.length > 0 ? (
                <JobSection title="Requirements">
                  <BulletList items={resolvedRequirements.slice(0, 6)} />
                </JobSection>
              ) : null}
              {benefitItems.length > 0 ? (
                <JobSection title="Benefits">
                  <BulletList items={benefitItems.slice(0, 4).map(formatBenefitPill)} />
                </JobSection>
              ) : null}
            </>
          )}

          {requiredSkills.length > 0 ? (
            <JobSection title="Skills">
              <div className="flex flex-wrap gap-2">
                {requiredSkills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="rounded-md px-2.5 py-1 font-medium">
                    {skill}
                  </Badge>
                ))}
              </div>
              {niceSkills.length > 0 ? (
                <>
                  <p className="pt-2 text-sm text-muted-foreground">Nice to have</p>
                  <div className="flex flex-wrap gap-2">
                    {niceSkills.map((skill) => (
                      <Badge key={skill} variant="outline" className="rounded-md px-2.5 py-1 font-normal">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </>
              ) : null}
            </JobSection>
          ) : null}

          {hasDescription || isOversizedDescription ? (
            <JobSection title="Full job description">
              {isOversizedDescription ? (
                <p className="text-sm text-muted-foreground">
                  This description is too large to display safely. Use Apply to read the full posting on the company site.
                </p>
              ) : (
                <div
                  className={`prose prose-invert max-w-none ${styles.richText}`}
                  dangerouslySetInnerHTML={{ __html: safeDescriptionHtml! }}
                />
              )}
            </JobSection>
          ) : null}
        </article>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <ApplyCard
            salaryText={salaryText || null}
            salaryIsFromEmployer={isSalaryVerified}
            applyHref={applyHref}
            companyName={companyName}
            facts={jobFacts}
            jobId={typedJob.id}
            shareUrl={`${SITE_URL}/job/${canonicalSlug}`}
          />
          <CompanyCard
            name={companyName}
            slug={company?.slug ?? null}
            logoSrc={logoUrl}
            description={companyBlurb}
            facts={companyFacts}
            websiteHref={websiteHref}
          />
        </aside>
      </div>

      {similarJobs.length > 0 ? (
        <section className="mt-14 space-y-4" aria-labelledby="similar-roles">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="similar-roles" className="text-lg font-semibold tracking-tight text-foreground">
              Similar six-figure roles
            </h2>
            {canonicalRoleSlug ? (
              <NextLink
                href={`/jobs/${canonicalRoleSlug}`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Browse all {prettyRole(canonicalRoleSlug)} jobs →
              </NextLink>
            ) : null}
          </div>
          <div className="grid gap-2">
            {similarJobs.map((sj) => (
              <JobCard key={sj.id} job={sj as JobWithCompany} variant="homepage" />
            ))}
          </div>
        </section>
      ) : null}

      {internalLinks.length > 0 ? (
        <section className="mt-10" aria-labelledby="explore-more">
          <h2 id="explore-more" className="mb-3 text-sm font-medium text-muted-foreground">
            Explore more
          </h2>
          <div className="flex flex-wrap gap-2">
            {internalLinks.slice(0, 8).map((link) => (
              <NextLink
                key={link.href}
                href={link.href}
                className={cn(badgeVariants({ variant: 'outline' }), 'px-3 py-1.5 text-sm font-normal hover:bg-muted')}
              >
                {link.label}
              </NextLink>
            ))}
          </div>
        </section>
      ) : null}

      <MobileApplyBar salaryText={salaryText || null} applyHref={applyHref} jobId={typedJob.id} />

      {/* JSON-LD (keep existing schema) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Use the full persisted company name for SEO-visible text. Do not truncate
 * display names here; upstream company cleanup should happen before storage.
 */
function fullCompanyName(name: string | null | undefined): string {
  return String(name || '').trim() || 'Company'
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

  if (hasValidCityAndCountry) return `${humanizeLocationText(String(job.city))}, ${job.countryCode}`

  if (job.locationRaw) return humanizeLocationText(String(job.locationRaw))
  if (job.countryCode) return job.countryCode
  return 'Location not specified'
}

type InternalLink = { href: string; label: string }

function prettyRole(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildInternalLinks(job: JobWithCompany): InternalLink[] {
  const links: InternalLink[] = []
  const companyName = fullCompanyName(job.companyRef?.name || job.company || '')
  const countryCode = job.countryCode?.toUpperCase() ?? null
  const countryName = countryCode ? countryCodeToName(countryCode) : null
  const hasCountryInfo = Boolean(countryCode && countryName)
  const isCountryMismatch =
    countryName && countryCode ? countryName.toUpperCase() !== countryCode : false
  const isCountryRecognized = hasCountryInfo && isCountryMismatch
  const countrySlug = isCountryRecognized && countryCode ? countryCodeToSlug(countryCode) : null
  const roleSlug = resolveIndexableRoleSlug(job.roleSlug)
  const roleLabel = roleSlug ? prettyRole(roleSlug) : ''

  if (roleSlug && isCountryRecognized && countrySlug) {
    links.push({
      href: `/jobs/${roleSlug}`,
      label: `${roleLabel} jobs in ${countryName ?? countryCode ?? 'this country'}`,
    })
  }

  if (isCountryRecognized && countrySlug) {
    links.push({
      href: `/jobs/location/${countrySlug}`,
      label: `$100k+ jobs in ${countryName}`,
    })
  }

  if (roleSlug) {
    links.push({
      href: `/remote/${roleSlug}`,
      label: `Remote $100k+ ${roleLabel} jobs`,
    })
  }

  // Conditional, context-aware links above. Below: baseline hub links that are
  // ALWAYS present, so a job page never sits orphaned with only sitemap
  // inclusion (a known "Crawled - currently not indexed" trigger in GSC).
  links.push({ href: '/jobs/100k-plus', label: 'All Six Figure Jobs' })
  links.push({ href: '/companies', label: 'Browse companies hiring' })
  links.push({ href: '/salary', label: 'Six figure salary guides' })
  if (!roleSlug) {
    // Only add the generic /remote hub when we couldn't surface a role-scoped
    // /remote/<role> link above — avoids duplicating that intent.
    links.push({ href: '/remote', label: 'Remote $100k+ jobs' })
  }

  if (roleSlug) {
    links.push({ href: `/salary/${roleSlug}`, label: `${roleLabel} salary guide` })
  }

  if (job.companyRef?.slug) {
    links.push({ href: `/company/${job.companyRef.slug}`, label: `More jobs at ${companyName}` })
  }

  // Skill pages — link to the first 3 matched canonical skills
  const rawSkills = parseSkillsFromJob(job)
  const matchedSkillLinks = rawSkills
    .map((s) => {
      const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (SKILL_SLUG_SET.has(slug)) {
        return { href: `/jobs/skills/${slug}`, label: `$100k+ ${SKILL_LABEL_MAP.get(slug) ?? s} jobs` }
      }
      return null
    })
    .filter((l): l is InternalLink => l !== null)
    .slice(0, 3)
  links.push(...matchedSkillLinks)

  // City page link
  if (job.citySlug && job.countryCode && CITY_TARGET_SLUG_SET.has(job.citySlug)) {
    links.push({
      href: `/jobs/city/${job.citySlug}`,
      label: `$100k+ jobs in ${job.city ?? job.citySlug}`,
    })
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
  const withoutEmailProtection = withoutComments
    .replace(
      /<a\b[^>]*href=(["'])[^"']*\/cdn-cgi\/l\/email-protection[^"']*\1[^>]*>[\s\S]*?<\/a>/gi,
      '',
    )
    .replace(
      /<(?:a|span)\b[^>]*(?:class=(["'])[^"']*__cf_email__[^"']*\1|data-cfemail=(["'])[^"']*\2)[^>]*>[\s\S]*?<\/(?:a|span)>/gi,
      '',
    )
    .replace(/\s(?:href|data-cfemail)=(["'])[^"']*\/cdn-cgi\/l\/email-protection[^"']*\1/gi, '')

  const allowedTags = ['p', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'br']
  const filtered = withoutEmailProtection.replace(
    /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
    (match, tag) => {
      const lower = String(tag).toLowerCase()
      const closing = match.startsWith('</') ? '/' : ''
      // Keep section headings from the posting, as <h3> under the page's own "Full job description" <h2>.
      if (/^h[1-6]$/.test(lower)) return `<${closing}h3>`
      if (allowedTags.includes(lower)) return `<${closing}${lower}>`
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
