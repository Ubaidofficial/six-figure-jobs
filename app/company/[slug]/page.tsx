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
import { formatRelativeTime } from '../../../lib/utils/time'
import { buildLogoUrl } from '../../../lib/companies/logo'
import { SITE_NAME, getSiteUrl } from '../../../lib/seo/site'
import { countryCodeToSlug } from '../../../lib/seo/countrySlug'
import { isCompanyPageIndexable } from '../../../lib/seo/indexabilityGates'
import { buildWhere } from '../../../lib/jobs/queryJobs'

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
      const data = await getCompanyWithJobs(slug)

      if (!data) return { title: `Company not found | ${SITE_NAME}` }

      const { company, jobs } = data
      const jobCount = jobs.length
      const allowIndex = isCompanyPageIndexable(jobCount)

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

      const description = `Browse ${jobCount} verified $100k+ jobs at ${company.name} with published salary ranges where available, direct apply links, and fresh six figure roles.${rolePhrase}${salaryPhrase} ${companyDesc}`

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
          images: company.logoUrl
            ? [
                {
                  url: company.logoUrl,
                  width: 200,
                  height: 200,
                  alt: company.name,
                },
              ]
            : undefined,
        },
        twitter: {
          card: 'summary',
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

      const tags = parseTags(company.tagsJson)
      const heroLogo = buildLogoUrl(company.logoUrl ?? null, company.website ?? null)

      return (
        <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      {/* Company Header */}
      <header className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Logo */}
          <div className="flex-shrink-0">
            {heroLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroLogo}
                alt={company.name}
                className="h-20 w-20 rounded-xl bg-white object-contain p-2"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-800 text-2xl font-bold text-slate-100">
                {company.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Company Info */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-50">{company.name}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              {company.industry && (
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">
                  {company.industry}
                </span>
              )}
              {company.sizeBucket && (
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">
                  {company.sizeBucket} employees
                </span>
              )}
              {company.headquarters && (
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">
                  📍 {company.headquarters}
                </span>
              )}
              {company.countryCode && !company.headquarters && (
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">
                  📍 {company.countryCode}
                </span>
              )}
            </div>

            {company.description ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                {truncateText(toPlainText(company.description), 400)}
              </p>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                {company.name} is hiring $100k+ talent across{' '}
                {company.industry ?? 'multiple teams'}. Explore roles in{' '}
                {qualifiedJobs.length > 0 ? 'high-compensation' : 'their latest'}{' '}
                postings and discover remote and on-site opportunities.
              </p>
            )}

            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.slice(0, 10).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Links */}
            <div className="mt-4 flex flex-wrap gap-3">
              {isValidCompanyWebsite(company.website) && (
                <a
                  href={cleanUrl(company.website!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-100 hover:border-slate-500"
                >
                  🌐 Website
                </a>
              )}
              {company.atsUrl && (
                <a
                  href={cleanUrl(company.atsUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-100 hover:border-slate-500"
                >
                  💼 Careers Page
                </a>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 sm:flex-col sm:items-end sm:gap-2">
            <div className="text-center sm:text-right">
              <div className="text-2xl font-bold text-slate-50">{jobs.length}</div>
              <div className="text-xs text-slate-400">$100k+ Jobs</div>
            </div>
            {qualifiedJobs.length > 0 && (
              <div className="text-center sm:text-right">
                <div className="text-2xl font-bold text-emerald-400">
                  {qualifiedJobs.filter((job) => job.salarySource === 'ats').length}
                </div>
                <div className="text-xs text-slate-400">ATS salary-backed</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SEO body copy */}
      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <h2 className="text-sm font-semibold text-slate-50">
          Why $100k+ roles at {company.name}?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {company.name} is actively hiring experienced talent for $100k+ roles across{' '}
          {stats.topRoles.length
            ? formatList(stats.topRoles.slice(0, 3).map((role) => role.label))
            : tags.length
              ? tags.slice(0, 3).join(', ')
              : 'multiple teams'}. These
          positions include high-impact remote, hybrid, and on-site opportunities,
          with published salary ranges shown up front where available and direct
          apply links for faster applications.
          {stats.highestSalaryLabel
            ? ` The highest visible salary in the current ${company.name} feed reaches ${stats.highestSalaryLabel}.`
            : ''}{' '}
          {stats.topLocations.length
            ? `Popular hiring locations include ${formatList(stats.topLocations.slice(0, 3).map((location) => location.label))}.`
            : 'Browse remote, hybrid, and on-site openings as new locations are normalized.'}{' '}
          We refresh this page frequently as new jobs are added from the company’s ATS
          and careers feeds.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-50">
          {company.name} hiring snapshot
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CompanySignalPanel title="Top roles">
            {stats.topRoles.length > 0 ? (
              <ul className="space-y-2 text-sm text-slate-300">
                {stats.topRoles.slice(0, 5).map((role) => (
                  <li key={role.key} className="flex items-center justify-between gap-3">
                    <Link href={`/jobs/${role.key}/100k-plus`} className="text-blue-300 hover:underline">
                      {role.label}
                    </Link>
                    <span className="font-mono text-xs text-slate-500">{role.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Role mix is still being normalized for this company.</p>
            )}
          </CompanySignalPanel>

          <CompanySignalPanel title="Salary bands">
            {stats.salaryBands.some((band) => band.count > 0) ? (
              <ul className="space-y-2 text-sm text-slate-300">
                {stats.salaryBands.filter((band) => band.count > 0).map((band) => (
                  <li key={band.href} className="flex items-center justify-between gap-3">
                    <Link href={band.href} className="text-blue-300 hover:underline">
                      {band.label}
                    </Link>
                    <span className="font-mono text-xs text-slate-500">{band.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Published salary bands are limited in the current feed.</p>
            )}
          </CompanySignalPanel>

          <CompanySignalPanel title="Work setup">
            <ul className="space-y-2 text-sm text-slate-300">
              {stats.workModes.map((mode) => (
                <li key={mode.key} className="flex items-center justify-between gap-3">
                  <span>{mode.label}</span>
                  <span className="font-mono text-xs text-slate-500">{mode.count}</span>
                </li>
              ))}
            </ul>
          </CompanySignalPanel>

          <CompanySignalPanel title="Top locations">
            {stats.topLocations.length > 0 ? (
              <ul className="space-y-2 text-sm text-slate-300">
                {stats.topLocations.slice(0, 5).map((location) => (
                  <li key={location.key} className="flex items-center justify-between gap-3">
                    {location.href ? (
                      <Link href={location.href} className="text-blue-300 hover:underline">
                        {location.label}
                      </Link>
                    ) : (
                      <span>{location.label}</span>
                    )}
                    <span className="font-mono text-xs text-slate-500">{location.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Location signals are still being normalized for this feed.</p>
            )}
          </CompanySignalPanel>
        </div>
      </section>

      <section className="mb-8 space-y-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold text-slate-50">
          Explore related high-paying pages
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-blue-300">
          {countrySlug && (
            <li>
              <Link href={`/jobs/location/${countrySlug}`} className="hover:underline">
                $100k+ jobs in {company.countryCode}
              </Link>
            </li>
          )}
          <li>
            <Link href="/jobs/200k-plus" className="hover:underline">
              $200k+ tech jobs →
            </Link>
          </li>
          <li>
            <Link href="/remote" className="hover:underline">
              Remote $100k+ roles →
            </Link>
          </li>
          <li>
            <Link href="/salary/software-engineer" className="hover:underline">
              Software Engineer salary guide →
            </Link>
          </li>
        </ul>
      </section>

      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <h2 className="text-sm font-semibold text-slate-50">
          {company.name} jobs FAQ
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {buildCompanyFaqItems(company, qualifiedJobs).map((item) => (
            <article key={item.q} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-sm font-semibold text-slate-100">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Job Listings */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-50">
          Open Positions at {company.name}
        </h2>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center">
            <p className="text-slate-400">No live $100k+ positions at the moment.</p>
            <p className="mt-2 text-sm text-slate-500">
              Check back later or visit their{' '}
              {company.atsUrl ? (
                <a
                  href={cleanUrl(company.atsUrl)}
                  className="text-blue-400 hover:underline"
                >
                  careers page
                </a>
              ) : (
                'careers page'
              )}{' '}
              directly.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-400">
                <span>💰</span> Verified $100k+ Positions
              </h3>
              <div className="space-y-3">
                {qualifiedJobs.map((job) => (
                  <JobListItem key={job.id} job={job} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Related Links */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          Explore More Six Figure Jobs
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/jobs/100k-plus"
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300 hover:border-slate-500"
          >
            All $100k+ Jobs
          </Link>
          <Link
            href="/jobs/software-engineer/100k-plus"
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300 hover:border-slate-500"
          >
            Software Engineer Jobs
          </Link>
          <Link
            href="/jobs/product-manager/100k-plus"
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300 hover:border-slate-500"
          >
            Product Manager Jobs
          </Link>
          <Link
            href="/jobs/data-engineer/100k-plus"
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300 hover:border-slate-500"
          >
            Data Engineer Jobs
          </Link>
        </div>
      </section>

      {/* JSON-LD */}
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
        </main>
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

function JobListItem({ job }: { job: JobWithFlags }) {
  const salaryText = buildSalaryText(job)
  const locationText = buildLocationText(job)
  const isHighSalary = job.isHighSalary

  const rawSnippet =
    (job as any).descriptionHtml ?? (job as any).description ?? (job as any).body ?? null

  const snippet = rawSnippet
    ? truncateText(toPlainText(String(rawSnippet)), 140)
    : null

  return (
    <div className="group rounded-xl border border-slate-800 bg-slate-950/70 p-4 transition-colors hover:border-slate-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <Link
            href={buildJobSlugHref(job)}
            className="text-base font-medium text-slate-100 group-hover:text-blue-400"
          >
            {job.title}
          </Link>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {locationText && <span>📍 {locationText}</span>}
            {job.type && <span>· {job.type}</span>}
            {job.postedAt && <span>· Posted {formatRelativeTime(job.postedAt) ?? ''}</span>}
          </div>

          {snippet && snippet.length > 20 && (
            <p className="mt-2 text-sm text-slate-300">{snippet}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {salaryText && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isHighSalary
                  ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {salaryText}
            </span>
          )}

          {job.applyUrl && (
            <a
              href={cleanUrl(job.applyUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              Apply now
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function CompanySignalPanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-100">{title}</h3>
      {children}
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function buildLocationText(job: JobWithFlags): string {
  const isRemote = job.remote === true || job.remoteMode === 'remote'
  if (isRemote) return job.countryCode ? `Remote (${job.countryCode})` : 'Remote'
  if (job.city && job.countryCode) return `${job.city}, ${job.countryCode}`
  if (job.countryCode) return job.countryCode
  if (job.locationRaw) return job.locationRaw
  return ''
}

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

// Domains that are ATS/social platforms, not company homepages
const INVALID_WEBSITE_DOMAINS = [
  'linkedin.com',
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'workday.com',
  'smartrecruiters.com',
  'bamboohr.com',
  'recruitee.com',
  'workable.com',
  'jobs.lever.co',
  'twitter.com',
  'x.com',
  'facebook.com',
]

function isValidCompanyWebsite(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return !INVALID_WEBSITE_DOMAINS.some((d) => parsed.hostname.includes(d))
  } catch {
    return false
  }
}

function cleanUrl(url: string): string {
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

function buildCompanySeoStats(jobs: JobWithFlags[]) {
  const roleCounts = new Map<string, number>()
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
    if (job.roleSlug) incrementMap(roleCounts, job.roleSlug)

    const mode = job.remote === true || job.remoteMode === 'remote'
      ? 'remote'
      : job.remoteMode === 'hybrid'
        ? 'hybrid'
        : job.remoteMode === 'onsite'
          ? 'onsite'
          : 'unspecified'
    workModeCounts[mode] += 1

    const countrySlug = job.countryCode ? countryCodeToSlug(job.countryCode) : null
    const locationKey = mode === 'remote'
      ? 'remote'
      : job.citySlug
        ? `city:${job.citySlug}`
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
            : job.citySlug
              ? `/jobs/city/${job.citySlug}`
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

  const topRoles = sortedCounts(roleCounts).map((role) => ({
    ...role,
    label: toTitleCaseSlug(role.key),
  }))

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
    description: `Browse verified $100k+ jobs at ${company.name} with published salary ranges where available, direct apply links, and fresh six figure roles.`,
    url: `${SITE_URL}/company/${company.slug}`,
    about: [
      `${company.name} jobs`,
      `${company.name} careers`,
      ...stats.topRoles.slice(0, 5).map((role) => `${company.name} ${role.label} jobs`),
      ...stats.topLocations.slice(0, 3).map((location) => `${company.name} jobs in ${location.label}`),
      'verified $100k+ jobs',
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
      a: `${company.name} currently has ${jobCount.toLocaleString()} live $100k+ jobs on Six Figure Jobs. Listings are refreshed frequently as company ATS and careers feeds change.`,
    },
    {
      q: `Are ${company.name} salaries verified?`,
      a:
        salaryBackedCount > 0
          ? `${salaryBackedCount.toLocaleString()} ${company.name} roles include ATS salary-backed compensation signals. We prioritize published salary ranges, seniority, freshness, and direct apply links.`
          : `We prioritize ${company.name} roles with high-salary signals, seniority fit, freshness, and direct apply links, with published salary ranges shown whenever available.`,
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
