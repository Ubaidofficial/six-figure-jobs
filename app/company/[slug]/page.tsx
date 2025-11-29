// app/company/[slug]/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '../../../lib/prisma'
import { buildJobSlugHref } from '../../../lib/jobs/jobSlug'

export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type CompanyWithJobs = Awaited<ReturnType<typeof getCompanyWithJobs>>

/* -------------------------------------------------------------------------- */
/* Data Fetching                                                              */
/* -------------------------------------------------------------------------- */

async function getCompanyWithJobs(slug: string) {
  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      jobs: {
        where: { isExpired: false },
        orderBy: [
          { isHighSalary: 'desc' },
          { maxAnnual: 'desc' },
          { createdAt: 'desc' },
        ],
      },
    },
  })
  return company
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
  const company = await getCompanyWithJobs(slug)

  if (!company) {
    return { title: 'Company not found | Remote100k' }
  }

  const jobCount = company.jobs.length
  const highSalaryCount = company.jobs.filter(
    (j: any) => j.isHighSalary
  ).length

  const title = `${company.name} Jobs - ${jobCount} Open Positions | Remote100k`
  const description =
    highSalaryCount > 0
      ? `Browse ${jobCount} jobs at ${company.name}, including ${highSalaryCount} high-salary positions paying $100k+. ${
          company.description
            ? truncateText(stripTags(company.description), 120)
            : `Find your next role at ${company.name}.`
        }`
      : `Browse ${jobCount} open positions at ${company.name}. ${
          company.description
            ? truncateText(stripTags(company.description), 120)
            : `Find your next role at ${company.name}.`
        }`

  const canonicalUrl = `${SITE_URL}/company/${slug}`

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Remote100k',
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
  const company = await getCompanyWithJobs(slug)

  if (!company) return notFound()

  const jobs = company.jobs
  const highSalaryJobs = jobs.filter((j: any) => j.isHighSalary)
  const otherJobs = jobs.filter((j: any) => !j.isHighSalary)

  // Build JSON-LD
  const organizationJsonLd = buildOrganizationJsonLd(company)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(company)

  // Parse tags
  const tags = parseTags(company.tagsJson)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      {/* Company Header */}
      <header className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Logo */}
          <div className="flex-shrink-0">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
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
            <h1 className="text-2xl font-bold text-slate-50">
              {company.name}
            </h1>

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

            {company.description && (
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                {truncateText(
                  stripTags(decodeHtmlEntities(company.description)),
                  400
                )}
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
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-100 hover:border-slate-500"
                >
                  🌐 Website
                </a>
              )}
              {company.atsUrl && (
                <a
                  href={company.atsUrl}
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
              <div className="text-2xl font-bold text-slate-50">
                {jobs.length}
              </div>
              <div className="text-xs text-slate-400">Open Jobs</div>
            </div>
            {highSalaryJobs.length > 0 && (
              <div className="text-center sm:text-right">
                <div className="text-2xl font-bold text-emerald-400">
                  {highSalaryJobs.length}
                </div>
                <div className="text-xs text-slate-400">$100k+ Jobs</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Job Listings */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-50">
          Open Positions at {company.name}
        </h2>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center">
            <p className="text-slate-400">No open positions at the moment.</p>
            <p className="mt-2 text-sm text-slate-500">
              Check back later or visit their{' '}
              {company.atsUrl ? (
                <a
                  href={company.atsUrl}
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
            {/* High Salary Jobs */}
            {highSalaryJobs.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-400">
                  <span>💰</span> High-Salary Positions ($100k+)
                </h3>
                <div className="space-y-3">
                  {highSalaryJobs.map((job) => (
                    <JobListItem key={job.id} job={job} />
                  ))}
                </div>
              </div>
            )}

            {/* Other Jobs */}
            {otherJobs.length > 0 && (
              <div>
                {highSalaryJobs.length > 0 && (
                  <h3 className="mb-3 text-sm font-medium text-slate-400">
                    Other Positions
                  </h3>
                )}
                <div className="space-y-3">
                  {otherJobs.map((job) => (
                    <JobListItem key={job.id} job={job} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Related Links */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          Explore More $100k+ Jobs
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
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

function JobListItem({ job }: { job: any }) {
  const salaryText = buildSalaryText(job)
  const locationText = buildLocationText(job)
  const isHighSalary = job.isHighSalary

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
            {job.postedAt && (
              <span>
                · Posted{' '}
                {new Date(job.postedAt).toLocaleDateString()}
              </span>
            )}
          </div>
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
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              Apply
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function buildSalaryText(job: any): string | null {
  let min = job.minAnnual != null ? Number(job.minAnnual) : null
  let max = job.maxAnnual != null ? Number(job.maxAnnual) : null

  if ((min != null && min > 1_000_000) || (max != null && max > 1_000_000)) {
    return null
  }

  const currencySymbol =
    job.currency === 'USD' || !job.currency
      ? '$'
      : `${job.currency} `
  const fmt = (v: number) =>
    v.toLocaleString('en-US', { maximumFractionDigits: 0 })

  if (min && max) return `${currencySymbol}${fmt(min)}–${fmt(max)}/yr`
  if (min) return `${currencySymbol}${fmt(min)}+/yr`
  if (max) return `Up to ${currencySymbol}${fmt(max)}/yr`

  return null
}

function buildLocationText(job: any): string {
  const isRemote =
    job.remote === true || job.remoteMode === 'remote'

  if (isRemote) {
    return job.countryCode
      ? `Remote (${job.countryCode})`
      : 'Remote'
  }

  if (job.city && job.countryCode)
    return `${job.city}, ${job.countryCode}`
  if (job.countryCode) return job.countryCode
  if (job.locationRaw) return job.locationRaw

  return ''
}

function parseTags(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripTags(str: string): string {
  return str.replace(/<\/?[^>]+(>|$)/g, '')
}

function truncateText(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str
  const truncated = str.slice(0, maxChars)
  const lastSpace = truncated.lastIndexOf(' ')
  return (
    truncated.slice(0, lastSpace > 0 ? lastSpace : maxChars) +
    '…'
  )
}

/* -------------------------------------------------------------------------- */
/* JSON-LD Builders                                                           */
/* -------------------------------------------------------------------------- */

function buildOrganizationJsonLd(
  company: NonNullable<CompanyWithJobs>
) {
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    url: company.website || `${SITE_URL}/company/${company.slug}`,
  }

  if (company.logoUrl) {
    jsonLd.logo = company.logoUrl
  }

  if (company.description) {
    jsonLd.description = truncateText(
      stripTags(company.description),
      200
    )
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

function buildBreadcrumbJsonLd(
  company: NonNullable<CompanyWithJobs>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/`,
      },
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
