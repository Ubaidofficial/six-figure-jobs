// app/company/[slug]/page.tsx

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CompanyUnavailablePage } from '@/components/runtime/FallbackPresets'
import { prisma } from '../../../lib/prisma'
import { buildJobSlugHref } from '../../../lib/jobs/jobSlug'
import { buildSalaryText } from '../../../lib/jobs/salary'
import { buildRuntimeFallbackMetadata, withRuntimeFallback } from '@/lib/runtime/fallback'
import { Briefcase, Globe } from 'lucide-react'
import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { Faq, JobRows, LinkChips, ListingPage, ListingSection } from '@/components/listing/ListingParts'
import type { JobWithCompany } from '../../../lib/jobs/queryJobs'
import { buildLogoUrl } from '../../../lib/companies/logo'
import { normalizePublicCompanyWebsite } from '../../../lib/companies/website'
import { SITE_NAME, getSiteUrl } from '../../../lib/seo/site'
import { countryCodeToSlug } from '../../../lib/seo/countrySlug'
import { isCompanyPageIndexable } from '../../../lib/seo/indexabilityGates'
import { getCompanyPublishingDecision } from '../../../lib/seo/companyPublishing'
import { buildWhere } from '../../../lib/jobs/queryJobs'
import { CITY_TARGET_SLUG_SET } from '../../../lib/seo/pseoTargets'
import { resolveIndexableRoleSlug } from '../../../lib/roles/indexableRole'
import { buildJobJsonLd } from '../../../lib/seo/jobJsonLd'
import { evaluateJobIndexability } from '../../../lib/jobs/qualityGate'

// Per-job JobPosting count emitted on the company page. Capped to avoid HTML
// bloat while still exposing the highest-value jobs to Google's job-search
// surfaces from the company hub.
const COMPANY_JOB_POSTING_JSON_LD_LIMIT = 10

export const revalidate = 3600

const SITE_URL = getSiteUrl()

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type CompanyWithJobs = NonNullable<Awaited<ReturnType<typeof getCompanyWithJobs>>>
type JobWithFlags = CompanyWithJobs['jobs'][number]

function buildCompanyJobsWhere(slug: string) {
  return buildWhere({ companySlug: slug })
}

/* -------------------------------------------------------------------------- */
/* Data Fetching                                                              */
/* -------------------------------------------------------------------------- */

async function getCompanyWithJobs(slug: string) {
  const where = buildCompanyJobsWhere(slug)
  const [company, jobs] = await Promise.all([
    prisma.company.findUnique({
      where: { slug },
    }),
    prisma.job.findMany({
      where,
      include: {
        companyRef: true,
      },
      orderBy: [
        { maxAnnual: 'desc' },
        { minAnnual: 'desc' },
        { createdAt: 'desc' },
      ],
    }),
  ])

  if (!company) return null

  return { company, jobs }
}

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
    `company.${slug}.metadata`,
    async () => {
      const [data, publishingDecision] = await Promise.all([
        getCompanyWithJobs(slug),
        getCompanyPublishingDecision(slug),
      ])

      if (!data) return { title: `Company not found | ${SITE_NAME}` }

      const { company, jobs } = data
      const jobCount = jobs.length
      const allowIndex =
        isCompanyPageIndexable(jobCount) &&
        publishingDecision.ready &&
        publishingDecision.unlocked

      const title = `${company.name} $100k+ Jobs - ${jobCount} Open Positions | ${SITE_NAME}`
      const companyDesc = company.description
        ? truncateText(toPlainText(company.description), 120)
        : `Find your next role at ${company.name}.`
      const stats = buildCompanySeoStats(jobs)
      const rolePhrase = stats.topRoles.length
        ? ` Top hiring areas include ${formatList(stats.topRoles.slice(0, 3).map((role) => role.label))}.`
        : ''
      const salaryPhrase = stats.highestSalaryLabel
        ? ` Highest visible compensation reaches ${stats.highestSalaryLabel}.`
        : ''

      const description = `Browse ${jobCount} $100k+ jobs at ${company.name} with published salary ranges and links to apply.${rolePhrase}${salaryPhrase} ${companyDesc}`

      const canonicalUrl = `${SITE_URL}/company/${slug}`

      return {
        title,
        description,
        alternates: { canonical: canonicalUrl },
        robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          siteName: SITE_NAME,
          type: 'website',
          // No images override — let opengraph-image.tsx generate the 1200×630 social card
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
        },
      }
    },
    () =>
      buildRuntimeFallbackMetadata({
        canonicalPath: `/company/${slug}`,
        title: `Company page temporarily unavailable | ${SITE_NAME}`,
        description:
          'The live company page is temporarily unavailable while the production database reconnects.',
      }),
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return withRuntimeFallback(
    `company.${slug}.page`,
    async () => {
      const data = await getCompanyWithJobs(slug)

      if (!data) return notFound()

      const { company, jobs } = data
      const qualifiedJobs: JobWithFlags[] = jobs

      const countrySlug =
        company.countryCode ? countryCodeToSlug(company.countryCode) : null

      const stats = buildCompanySeoStats(qualifiedJobs)
      const organizationJsonLd = buildOrganizationJsonLd(company)
      const breadcrumbJsonLd = buildBreadcrumbJsonLd(company)
      const itemListJsonLd = buildCompanyJobsItemListJsonLd(company, qualifiedJobs)
      const collectionPageJsonLd = buildCompanyCollectionPageJsonLd(company, qualifiedJobs, stats)
      const faqJsonLd = buildCompanyFaqJsonLd(company, qualifiedJobs)
      const jobPostingJsonLds = qualifiedJobs
        .filter((job) => evaluateJobIndexability(job).indexable)
        .slice(0, COMPANY_JOB_POSTING_JSON_LD_LIMIT)
        .map((job) => buildJobJsonLd(job))

      const tags = parseTags(company.tagsJson)
      const heroLogo = buildLogoUrl(company.logoUrl ?? null, company.website ?? null, company.name)

      return (
        <ListingPage>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {jobPostingJsonLds.map((jsonLd, index) => (
        <script
          key={`job-posting-jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ))}

          <header className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-start">
            <CompanyLogo name={company.name} src={heroLogo} size="xl" priority className="size-20 flex-shrink-0 rounded-xl text-2xl" />
            <div className="min-w-0 flex-1">
              <Breadcrumb
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Companies', href: '/companies' },
                  { label: company.name },
                ]}
              />
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{company.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                <strong className="font-semibold text-foreground">{jobs.length}</strong> open $100k+{' '}
                {jobs.length === 1 ? 'job' : 'jobs'}
                {[company.industry, company.sizeBucket ? `${company.sizeBucket} employees` : null, company.headquarters ?? company.countryCode]
                  .filter(Boolean)
                  .map((v) => ` · ${v}`)
                  .join('')}
              </p>

              {company.description ? (
                <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-foreground/80">
                  {truncateText(toPlainText(company.description), 400)}
                </p>
              ) : null}

              {tags.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {tags.slice(0, 10).map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                {isValidCompanyWebsite(company.website) && (
                  <a
                    href={cleanUrl(company.website!)}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                  >
                    <Globe className="size-4" aria-hidden="true" /> Website
                  </a>
                )}
                {company.atsUrl && (
                  <a
                    href={cleanUrl(company.atsUrl)}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                  >
                    <Briefcase className="size-4" aria-hidden="true" /> Careers page
                  </a>
                )}
              </div>
            </div>
          </header>

          <ListingSection title={`Open positions at ${company.name}`}>
            <JobRows
              jobs={qualifiedJobs as unknown as JobWithCompany[]}
              empty={{
                title: 'No open $100k+ positions right now.',
                body: `Check back soon, or browse every $100k+ job.`,
                href: '/jobs',
                hrefLabel: 'Browse all jobs',
              }}
            />
          </ListingSection>

          {stats.topRoles.length > 0 || stats.topLocations.length > 0 || stats.salaryBands.some((b) => b.count > 0) ? (
            <ListingSection title={`Hiring at ${company.name}`}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SnapshotPanel title="Top roles">
                  {stats.topRoles.length > 0 ? (
                    <ul className="space-y-3 text-sm">
                      {stats.topRoles.slice(0, 5).map((role) => {
                        // Median-of-mins / median-of-maxes avoids smearing outliers; currency comes from the first
                        // sample with disclosed pay.
                        const salaryText = (() => {
                          const s = role.salary
                          if (!s) return null
                          const sym = s.currency === 'USD' || !s.currency ? '$' : `${s.currency} `
                          const fmt = (n: number) =>
                            n >= 1000 ? `${sym}${Math.round(n / 1000)}k` : `${sym}${n.toLocaleString('en-US')}`
                          if (s.minMedian != null && s.maxMedian != null) {
                            return `${fmt(s.minMedian)}–${fmt(s.maxMedian)}`
                          }
                          return fmt((s.minMedian ?? s.maxMedian) as number)
                        })()
                        return (
                          <li key={role.key}>
                            <div className="flex items-baseline justify-between gap-3">
                              <Link href={`/jobs/${role.key}`} className="text-primary hover:underline underline-offset-4">
                                {role.label}
                              </Link>
                              <span className="font-mono text-xs text-muted-foreground">
                                {role.count} {role.count === 1 ? 'role' : 'roles'}
                              </span>
                            </div>
                            {salaryText ? (
                              <div className="mt-0.5 font-mono text-xs text-muted-foreground">{salaryText}</div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not enough roles to summarise yet.</p>
                  )}
                </SnapshotPanel>

                <SnapshotPanel title="Salary bands">
                  {stats.salaryBands.some((band) => band.count > 0) ? (
                    <ul className="space-y-2 text-sm">
                      {stats.salaryBands.filter((band) => band.count > 0).map((band) => (
                        <li key={band.href} className="flex items-center justify-between gap-3">
                          <Link href={band.href} className="text-primary hover:underline underline-offset-4">
                            {band.label}
                          </Link>
                          <span className="font-mono text-xs text-muted-foreground">{band.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No published salary bands yet.</p>
                  )}
                </SnapshotPanel>

                <SnapshotPanel title="Work setup">
                  <ul className="space-y-2 text-sm">
                    {stats.workModes.map((mode) => (
                      <li key={mode.key} className="flex items-center justify-between gap-3">
                        <span className="text-foreground">{mode.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">{mode.count}</span>
                      </li>
                    ))}
                  </ul>
                </SnapshotPanel>

                <SnapshotPanel title="Top locations">
                  {stats.topLocations.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {stats.topLocations.slice(0, 5).map((location) => (
                        <li key={location.key} className="flex items-center justify-between gap-3">
                          {location.href ? (
                            <Link href={location.href} className="text-primary hover:underline underline-offset-4">
                              {location.label}
                            </Link>
                          ) : (
                            <span className="text-foreground">{location.label}</span>
                          )}
                          <span className="font-mono text-xs text-muted-foreground">{location.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No location data yet.</p>
                  )}
                </SnapshotPanel>
              </div>
            </ListingSection>
          ) : null}

          <ListingSection title="Related pages">
            <LinkChips
              label="Related pages"
              items={[
                ...(countrySlug
                  ? [{ label: `$100k+ jobs in ${company.countryCode}`, href: `/jobs/location/${countrySlug}` }]
                  : []),
                { label: 'All $100k+ jobs', href: '/jobs/100k-plus' },
                { label: '$200k+ jobs', href: '/jobs/200k-plus' },
                { label: 'Remote $100k+ jobs', href: '/remote' },
                { label: 'Software Engineer jobs', href: '/jobs/software-engineer' },
                { label: 'Product Manager jobs', href: '/jobs/product-manager' },
                { label: 'Data Engineer jobs', href: '/jobs/data-engineer' },
                { label: 'Software Engineer salaries', href: '/salary/software-engineer' },
              ]}
            />
          </ListingSection>

          <ListingSection title={`${company.name} jobs FAQ`}>
            <Faq
              items={buildCompanyFaqItems(company, qualifiedJobs).map((item) => ({ question: item.q, answer: item.a }))}
            />
          </ListingSection>
        </ListingPage>
      )
    },
    () => (
      <CompanyUnavailablePage
        title="This company page is temporarily unavailable"
        description="The live company profile is temporarily unavailable while the production database reconnects. Browse the company directory or return to the jobs index while data access recovers."
        primaryHref={`/company/${slug}`}
        primaryLabel="Retry company page"
      />
    ),
  )
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */


function SnapshotPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */


function parseTags(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? (parsed as unknown[]).filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

function decodeHtmlEntities(str: string): string {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // numeric entities: &#60; or &#x3C;
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function stripTags(str: string): string {
  return (str || '').replace(/<\/?[^>]+(>|$)/g, '')
}

function toPlainText(input: string): string {
  const decoded = decodeHtmlEntities(input || '')
  const stripped = stripTags(decoded)
  return stripped.replace(/\s+/g, ' ').trim()
}

function truncateText(str: string, maxChars: number): string {
  const s = str || ''
  if (s.length <= maxChars) return s
  const truncated = s.slice(0, maxChars)
  const lastSpace = truncated.lastIndexOf(' ')
  return truncated.slice(0, lastSpace > 0 ? lastSpace : maxChars) + '…'
}

function isValidCompanyWebsite(url: string | null | undefined): boolean {
  return Boolean(normalizePublicCompanyWebsite(url))
}

function cleanUrl(url: string): string {
  const normalized = normalizePublicCompanyWebsite(url)
  if (normalized) return normalized
  const s = (url || '').trim()
  if (!s) return '#'
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  return `https://${s}`
}

function toTitleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatList(items: string[]): string {
  const clean = items.map((item) => item.trim()).filter(Boolean)
  if (clean.length === 0) return ''
  if (clean.length === 1) return clean[0]
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`
}

function asAnnualNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'object') {
    const v: any = value
    if (typeof v.toNumber === 'function') {
      const n = v.toNumber()
      return Number.isFinite(n) ? n : null
    }
    if (typeof v.toString === 'function') {
      const n = Number(v.toString())
      return Number.isFinite(n) ? n : null
    }
  }
  return null
}

function salaryValue(job: JobWithFlags): number | null {
  return asAnnualNumber(job.maxAnnual) ?? asAnnualNumber(job.minAnnual)
}

function incrementMap(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function sortedCounts(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

// Per-role salary samples — feeds the "Software Engineer: $180-240k avg
// (N roles)" breakdown that's the company-page differentiator vs the
// company's own careers page.
type RoleSalarySample = {
  minValues: number[]
  maxValues: number[]
  currency: string | null
}

function buildCompanySeoStats(jobs: JobWithFlags[]) {
  const roleCounts = new Map<string, number>()
  const roleSalary = new Map<string, RoleSalarySample>()
  const locationCounts = new Map<string, number>()
  const locationMeta = new Map<string, { label: string; href: string | null }>()
  const workModeCounts = {
    remote: 0,
    hybrid: 0,
    onsite: 0,
    unspecified: 0,
  }
  const bandCounts = {
    '100k-plus': 0,
    '200k-plus': 0,
    '300k-plus': 0,
    '400k-plus': 0,
  }

  let highestJob: JobWithFlags | null = null
  let highestValue = 0

  for (const job of jobs) {
    const indexableRoleSlug = resolveIndexableRoleSlug(job.roleSlug)
    if (indexableRoleSlug) {
      incrementMap(roleCounts, indexableRoleSlug)
      // Collect salary samples per role (raw min/max in the job's currency).
      const sample = roleSalary.get(indexableRoleSlug) ?? {
        minValues: [],
        maxValues: [],
        currency: null,
      }
      const minN = asAnnualNumber(job.minAnnual)
      const maxN = asAnnualNumber(job.maxAnnual)
      if (minN != null) sample.minValues.push(minN)
      if (maxN != null) sample.maxValues.push(maxN)
      if (sample.currency == null && (minN != null || maxN != null)) {
        sample.currency = (job.currency || 'USD').toUpperCase()
      }
      roleSalary.set(indexableRoleSlug, sample)
    }

    const mode = job.remote === true || job.remoteMode === 'remote'
      ? 'remote'
      : job.remoteMode === 'hybrid'
        ? 'hybrid'
        : job.remoteMode === 'onsite'
          ? 'onsite'
          : 'unspecified'
    workModeCounts[mode] += 1

    const countrySlug = job.countryCode ? countryCodeToSlug(job.countryCode) : null
    const citySlug = job.citySlug && CITY_TARGET_SLUG_SET.has(job.citySlug) ? job.citySlug : null
    const locationKey = mode === 'remote'
      ? 'remote'
      : citySlug
        ? `city:${citySlug}`
        : countrySlug
          ? `country:${countrySlug}`
          : null

    if (locationKey) {
      incrementMap(locationCounts, locationKey)
      if (!locationMeta.has(locationKey)) {
        locationMeta.set(locationKey, {
          label: mode === 'remote'
            ? 'Remote'
            : job.city
              ? `${job.city}${job.countryCode ? `, ${job.countryCode}` : ''}`
              : job.countryCode || 'Location available',
          href: mode === 'remote'
            ? '/remote'
            : citySlug
              ? `/jobs/city/${citySlug}`
              : countrySlug
                ? `/jobs/location/${countrySlug}`
                : null,
        })
      }
    }

    const annual = salaryValue(job)
    if (annual != null) {
      if (annual >= 400_000) bandCounts['400k-plus'] += 1
      else if (annual >= 300_000) bandCounts['300k-plus'] += 1
      else if (annual >= 200_000) bandCounts['200k-plus'] += 1
      else if (annual >= 100_000) bandCounts['100k-plus'] += 1

      if (annual > highestValue) {
        highestValue = annual
        highestJob = job
      }
    }
  }

  const topRoles = sortedCounts(roleCounts).map((role) => {
    const sample = roleSalary.get(role.key)
    // Median of mins and max-of-maxes gives a representative "$X-$Y" range
    // without smearing two distinct distributions together.
    const sortedMin = (sample?.minValues ?? []).slice().sort((a, b) => a - b)
    const sortedMax = (sample?.maxValues ?? []).slice().sort((a, b) => a - b)
    const minMedian = sortedMin.length > 0 ? sortedMin[Math.floor(sortedMin.length / 2)] : null
    const maxMedian = sortedMax.length > 0 ? sortedMax[Math.floor(sortedMax.length / 2)] : null
    return {
      ...role,
      label: toTitleCaseSlug(role.key),
      salary:
        minMedian != null || maxMedian != null
          ? {
              minMedian,
              maxMedian,
              currency: sample?.currency ?? 'USD',
              sampleSize: (sample?.minValues.length ?? 0) + (sample?.maxValues.length ?? 0),
            }
          : null,
    }
  })

  const topLocations = sortedCounts(locationCounts).map((location) => {
    const meta = locationMeta.get(location.key)
    return {
      ...location,
      label: meta?.label ?? location.key,
      href: meta?.href ?? null,
    }
  })

  return {
    topRoles,
    topLocations,
    salaryBands: [
      { label: '$400k+ jobs', count: bandCounts['400k-plus'], href: '/jobs/400k-plus' },
      { label: '$300k-$399k jobs', count: bandCounts['300k-plus'], href: '/jobs/300k-plus' },
      { label: '$200k-$299k jobs', count: bandCounts['200k-plus'], href: '/jobs/200k-plus' },
      { label: '$100k-$199k jobs', count: bandCounts['100k-plus'], href: '/jobs/100k-plus' },
    ],
    workModes: [
      { key: 'remote', label: 'Remote', count: workModeCounts.remote },
      { key: 'hybrid', label: 'Hybrid', count: workModeCounts.hybrid },
      { key: 'onsite', label: 'On-site', count: workModeCounts.onsite },
      { key: 'unspecified', label: 'Location varies', count: workModeCounts.unspecified },
    ].filter((mode) => mode.count > 0),
    highestSalaryLabel: highestJob ? buildSalaryText(highestJob) : null,
  }
}

/* -------------------------------------------------------------------------- */
/* JSON-LD Builders                                                           */
/* -------------------------------------------------------------------------- */

function buildOrganizationJsonLd(company: CompanyWithJobs['company']) {
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/company/${company.slug}#organization`,
    name: company.name,
    url: company.website || `${SITE_URL}/company/${company.slug}`,
  }

  if (company.logoUrl) jsonLd.logo = company.logoUrl

  if (company.description) {
    jsonLd.description = truncateText(toPlainText(company.description), 200)
  }

  if (company.headquarters) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      addressLocality: company.headquarters,
    }
  }

  if (company.sizeBucket) {
    jsonLd.numberOfEmployees = {
      '@type': 'QuantitativeValue',
      value: company.sizeBucket,
    }
  }

  return jsonLd
}

function buildBreadcrumbJsonLd(company: CompanyWithJobs['company']) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Companies',
        item: `${SITE_URL}/companies`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: company.name,
        item: `${SITE_URL}/company/${company.slug}`,
      },
    ],
  }
}

function buildCompanyJobsItemListJsonLd(
  company: CompanyWithJobs['company'],
  jobs: JobWithFlags[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${company.name} $100k+ jobs`,
    itemListElement: jobs.slice(0, 50).map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${SITE_URL}${buildJobSlugHref(job)}`,
    })),
  }
}

function buildCompanyCollectionPageJsonLd(
  company: CompanyWithJobs['company'],
  jobs: JobWithFlags[],
  stats: ReturnType<typeof buildCompanySeoStats>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${company.name} $100k+ jobs`,
    description: `Browse $100k+ jobs at ${company.name} with published salary ranges and links to apply.`,
    url: `${SITE_URL}/company/${company.slug}`,
    about: [
      `${company.name} jobs`,
      `${company.name} careers`,
      ...stats.topRoles.slice(0, 5).map((role) => `${company.name} ${role.label} jobs`),
      ...stats.topLocations.slice(0, 3).map((location) => `${company.name} jobs in ${location.label}`),
      '$100k+ jobs',
      'six figure jobs',
      'high paying jobs',
      'published salary ranges',
    ],
    keywords: [
      `${company.name} jobs`,
      `${company.name} careers`,
      `${company.name} $100k+ jobs`,
      `${company.name} six figure jobs`,
      ...stats.topRoles.slice(0, 5).map((role) => `${company.name} ${role.label} jobs`),
    ],
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: jobs.length,
      itemListElement: jobs.slice(0, 24).map((job, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE_URL}${buildJobSlugHref(job)}`,
      })),
    },
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
}

function buildCompanyFaqItems(company: CompanyWithJobs['company'], jobs: JobWithFlags[]) {
  const jobCount = jobs.length
  const salaryBackedCount = jobs.filter((job) => job.salarySource === 'ats').length
  const remoteCount = jobs.filter((job) => job.remote === true || job.remoteMode === 'remote').length

  return [
    {
      q: `How many $100k+ jobs does ${company.name} have?`,
      a: `${company.name} currently has ${jobCount.toLocaleString()} live $100k+ jobs on Six Figure Jobs. New jobs are added every day and jobs that are no longer open are removed.`,
    },
    {
      q: `Where do the ${company.name} salaries come from?`,
      a:
        salaryBackedCount > 0
          ? `${salaryBackedCount.toLocaleString()} ${company.name} roles take their salary from the employer’s applicant-tracking system. Every listing shows the salary range published in the posting and links to ${company.name}’s own application page.`
          : `Every ${company.name} listing shows the salary range published in the posting and links to ${company.name}’s own application page.`,
    },
    {
      q: `Does ${company.name} hire remote six figure roles?`,
      a:
        remoteCount > 0
          ? `Yes. ${company.name} has ${remoteCount.toLocaleString()} remote $100k+ roles in the current feed, alongside hybrid and on-site opportunities where available.`
          : `${company.name} openings may include remote, hybrid, and on-site roles depending on the current hiring feed. Use the location details on each job card before applying.`,
    },
  ]
}

function buildCompanyFaqJsonLd(company: CompanyWithJobs['company'], jobs: JobWithFlags[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: buildCompanyFaqItems(company, jobs).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }
}
