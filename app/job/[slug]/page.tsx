// app/job/[slug]/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '../../../lib/prisma'
import {
  parseJobSlugParam,
  buildJobSlugHref,
} from '../../../lib/jobs/jobSlug'
import { buildJobMetadata } from '../../../lib/seo/jobMeta'
import { buildJobJsonLd } from '../../../lib/seo/jobJsonLd'
import {
  queryJobs,
  type JobWithCompany,
} from '../../../lib/jobs/queryJobs'

export const revalidate = 3600

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { jobId, externalId } = parseJobSlugParam(slug)

  if (!jobId && !externalId) {
    return { title: 'Job not found | Remote100k' }
  }

  const where: any = (() => {
    const ors: any[] = []
    if (jobId) ors.push({ id: jobId })
    if (externalId) ors.push({ externalId })

    if (ors.length === 0) return null
    if (ors.length === 1) return ors[0]
    return { OR: ors }
  })()

  if (!where) {
    return { title: 'Job not found | Remote100k' }
  }

  const job = await prisma.job.findFirst({
    where,
    include: { companyRef: true },
  })

  if (!job) return { title: 'Job not found | Remote100k' }

  return buildJobMetadata(job as JobWithCompany)
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
  const { jobId, externalId } = parseJobSlugParam(slug)

  const where: any = (() => {
    const ors: any[] = []
    if (jobId) ors.push({ id: jobId })
    if (externalId) ors.push({ externalId })

    if (ors.length === 0) return null
    if (ors.length === 1) return ors[0]
    return { OR: ors }
  })()

  if (!where) return notFound()

  const job = await prisma.job.findFirst({
    where,
    include: { companyRef: true },
  })

  if (!job) return notFound()

  const typedJob = job as JobWithCompany
  const company = typedJob.companyRef
  
  // Clean company name - take only the first part before description
  const rawCompanyName = company?.name || typedJob.company || 'Company'
  const companyName = cleanCompanyName(rawCompanyName)
  
  const logoUrl = company?.logoUrl ?? typedJob.companyLogo ?? null

  /* ------------------------------ Helpers ---------------------------------- */

  const salaryText = buildSalaryText(typedJob)
  const isRemote = typedJob.remote === true || typedJob.remoteMode === 'remote'
  const locationText = buildLocationText(typedJob)
  const isHundredK = isHundredKJob(typedJob)
  const seniority = inferSeniorityFromTitle(typedJob.title)
  const category = inferCategoryFromRoleSlug(typedJob.roleSlug)
  const remoteModeLabel = getRemoteModeLabel(typedJob)

  const requirements = parseArray(typedJob.requirementsJson)
  const benefits = parseArray(typedJob.benefitsJson)

  // Prefer rich HTML, fallback to raw text
  const rawDescriptionHtml =
    (typedJob as any).descriptionHtml ??
    (typedJob as any).description ??
    (typedJob as any).body ??
    null

  const safeDescriptionHtml = rawDescriptionHtml
    ? sanitizeDescriptionHtml(rawDescriptionHtml)
    : null

  const hasDescription =
    !!safeDescriptionHtml && safeDescriptionHtml.trim().length > 0

  const jsonLd = buildJobJsonLd(typedJob)
  const breadcrumbJsonLd = buildJobBreadcrumbJsonLd(typedJob, slug)
  const internalLinks = buildInternalLinks(typedJob)

  /* --------------------------- Similar jobs -------------------------------- */

  const similarResult = await queryJobs({
    roleSlugs: typedJob.roleSlug ? [typedJob.roleSlug] : undefined,
    countryCode: typedJob.countryCode || undefined,
    minAnnual: 100_000,
    page: 1,
    pageSize: 6,
  })

  const similarJobs = similarResult.jobs
    .filter((j) => j.id !== typedJob.id)
    .slice(0, 4)

  const companyTags = parseTags(company?.tagsJson)

  /* ------------------------------ Render ----------------------------------- */

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* ----------------------------- Sidebar ----------------------------- */}
        <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
          <div className="flex flex-col items-center text-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={companyName}
                className="h-16 w-16 rounded-full bg-slate-900 object-contain p-2"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-slate-100">
                {companyName.charAt(0).toUpperCase()}
              </div>
            )}

            <h2 className="mt-3 text-base font-semibold text-slate-50">
              {companyName}
            </h2>

            <p className="text-xs text-slate-400">
              {company?.countryCode || typedJob.countryCode || 'Global'}
            </p>

            {company?.sizeBucket && (
              <p className="text-[11px] text-slate-400">
                {company.sizeBucket} employees
              </p>
            )}

            {companyTags.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                {companyTags.slice(0, 8).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {company?.description && (
              <p className="mt-4 text-xs leading-relaxed text-slate-300">
                {truncateText(
                  stripTags(decodeHtmlEntities(company.description)),
                  550,
                )}
              </p>
            )}

            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
              {company?.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="nofollow noreferrer"
                  className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-100 hover:border-slate-500"
                >
                  Website
                </a>
              )}

              {company?.slug && (
                <Link
                  href={`/company/${company.slug}`}
                  className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-100 hover:border-slate-500"
                >
                  All job openings
                </Link>
              )}
            </div>
          </div>
        </aside>

        {/* --------------------------- Job Content --------------------------- */}
        <section className="space-y-8">
          {/* Hero */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 px-6 py-6 shadow-lg">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
                  {typedJob.title}
                </h1>

                <div className="mt-2 text-xs text-slate-300">
                  <div className="font-medium">
                    {company?.slug ? (
                      <Link
                        href={`/company/${company.slug}`}
                        className="hover:underline"
                      >
                        {companyName}
                      </Link>
                    ) : (
                      companyName
                    )}
                  </div>

                  {locationText && (
                    <p className="mt-0.5 text-slate-400">{locationText}</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                  {isHundredK && (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
                      💰 100k+ base local
                    </span>
                  )}

                  {salaryText && (
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-slate-200 ring-1 ring-slate-700">
                      💵 {salaryText}
                    </span>
                  )}

                  {/* Only show location badge if NOT remote */}
                  {!isRemote && locationText && (
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-slate-200 ring-1 ring-slate-700">
                      📍 {locationText}
                    </span>
                  )}

                  {/* Show remote mode badge */}
                  {remoteModeLabel && (
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-slate-200 ring-1 ring-slate-700">
                      🌎 {remoteModeLabel}
                    </span>
                  )}

                  {typedJob.type && (
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-slate-200 ring-1 ring-slate-700">
                      ⏱ {typedJob.type}
                    </span>
                  )}

                  {category && (
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-slate-200 ring-1 ring-slate-700">
                      {category}
                    </span>
                  )}

                  {seniority && (
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-slate-200 ring-1 ring-slate-700">
                      {seniority}
                    </span>
                  )}

                  {typedJob.postedAt && (
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-slate-200 ring-1 ring-slate-700">
                      📅 Posted {typedJob.postedAt.toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {typedJob.applyUrl && (
                <div className="flex-shrink-0">
                  <a
                    href={typedJob.applyUrl}
                    target="_blank"
                    rel="nofollow sponsored"
                    className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/30 hover:bg-blue-500"
                  >
                    Apply Now
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* Description */}
          {hasDescription ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-50">
                About the role
              </h2>

              <div
                className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-200 prose-ul:list-disc prose-ul:pl-5 prose-li:mb-1"
                dangerouslySetInnerHTML={{
                  __html: safeDescriptionHtml!,
                }}
              />
            </section>
          ) : (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-50">
                About the role
              </h2>

              <p className="text-sm leading-relaxed text-slate-200">
                The full job description is available on the employer's
                careers site.
              </p>

              {typedJob.applyUrl && (
                <a
                  href={typedJob.applyUrl}
                  target="_blank"
                  rel="nofollow sponsored"
                  className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 hover:bg-slate-800"
                >
                  View full description &amp; apply
                </a>
              )}
            </section>
          )}

          {/* Requirements */}
          {requirements.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-50">
                Requirements
              </h2>

              <ul className="list-disc pl-5 text-sm text-slate-200">
                {requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Benefits */}
          {benefits.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-50">
                Benefits
              </h2>

              <ul className="list-disc pl-5 text-sm text-slate-200">
                {benefits.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Internal Links */}
          {internalLinks.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-50">
                Explore related $100k+ pages
              </h2>

              <ul className="list-disc pl-5 text-sm text-blue-400">
                {internalLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Similar Jobs */}
          {similarJobs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-50">
                Similar $100k+ jobs
              </h2>

              <ul className="space-y-3 text-sm">
                {similarJobs.map((sj) => {
                  const sjSalary = buildSalaryText(sj)
                  const sjLocation = buildLocationText(sj)

                  return (
                    <li
                      key={sj.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <Link
                        href={buildJobSlugHref(sj)}
                        className="font-semibold text-slate-100 hover:underline"
                      >
                        {sj.title}
                      </Link>

                      <div className="text-slate-300">
                        {cleanCompanyName(sj.companyRef?.name || sj.company || '')}
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        {sjLocation}
                        {sjSalary && ` · ${sjSalary}`}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLd),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(breadcrumbJsonLd),
            }}
          />
        </section>
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
  
  // If name looks like "CompanyNameDescription text here..."
  // Try to extract just the company name
  
  // Look for common patterns where description starts
  const patterns = [
    /^([A-Z][a-z]+(?:[A-Z][a-z]+)*)[A-Z][a-z]/, // CamelCase followed by description
    /^([^.]+?)\s*[.]/,  // Text before first period
    /^(.+?)\s+(?:is|are|was|provides|offers|builds|creates|develops)/i, // Text before common description starters
  ]
  
  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match && match[1] && match[1].length >= 2 && match[1].length <= 50) {
      return match[1].trim()
    }
  }
  
  // If no pattern matches, truncate at reasonable length
  if (name.length > 50) {
    // Find a good break point
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

function isHundredKJob(job: any): boolean {
  const min = job.minAnnual != null ? Number(job.minAnnual) : null
  const max = job.maxAnnual != null ? Number(job.maxAnnual) : null

  if (job.isHundredKLocal) return true
  if (min && max && min >= 100_000 && max >= 100_000) return true

  return false
}

function buildSalaryText(job: any): string | null {
  let min = job.minAnnual != null ? Number(job.minAnnual) : null
  let max = job.maxAnnual != null ? Number(job.maxAnnual) : null

  // Guard against obviously broken values
  if ((min != null && min > 1_000_000) || (max != null && max > 1_000_000)) {
    min = null
    max = null
  }

  const currencySymbol =
    job.currency === 'USD' || !job.currency ? '$' : `${job.currency} `

  const fmt = (v: number) =>
    v.toLocaleString('en-US', { maximumFractionDigits: 0 })

  if (min && max) return `${currencySymbol}${fmt(min)}–${fmt(max)}/yr`
  if (min) return `${currencySymbol}${fmt(min)}+/yr`

  return null
}

/**
 * Build location text - handles remote vs physical location
 */
function buildLocationText(job: any): string {
  const isRemote = job.remote === true || job.remoteMode === 'remote'
  
  if (isRemote) {
    // For remote jobs, show "Remote" or "Remote (US)" if country restricted
    if (job.countryCode) {
      return `Remote (${job.countryCode})`
    }
    return 'Remote'
  }
  
  // For non-remote jobs, show city/country
  if (job.city && job.countryCode) return `${job.city}, ${job.countryCode}`
  if (job.countryCode) return job.countryCode
  if (job.locationRaw) return job.locationRaw
  return 'Location not specified'
}

/**
 * Get remote mode label - returns null if not remote to avoid duplicates
 */
function getRemoteModeLabel(job: any): string | null {
  const mode = job.remoteMode as 'remote' | 'hybrid' | 'onsite' | null

  if (mode === 'remote' || job.remote === true) return 'Remote'
  if (mode === 'hybrid') return 'Hybrid'
  if (mode === 'onsite') return 'On-site'

  return null
}

type InternalLink = { href: string; label: string }

function prettyRole(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildInternalLinks(job: JobWithCompany): InternalLink[] {
  const links: InternalLink[] = []
  const companyName = cleanCompanyName(job.companyRef?.name || job.company || '')

  if (job.roleSlug && job.countryCode) {
    const roleLabel = prettyRole(job.roleSlug)
    const ccLower = job.countryCode.toLowerCase()

    links.push({
      href: `/jobs/${job.roleSlug}/${ccLower}/100k-plus`,
      label: `More ${roleLabel} jobs paying $100k+ in ${job.countryCode}`,
    })

    links.push({
      href: `/jobs/${ccLower}/100k-plus`,
      label: `All $100k+ jobs in ${job.countryCode}`,
    })
  }

  links.push({
    href: '/jobs/100k-plus',
    label: 'All $100k+ jobs on Remote100k',
  })

  if (job.companyRef?.slug) {
    links.push({
      href: `/company/${job.companyRef.slug}`,
      label: `More jobs at ${companyName}`,
    })
  }

  return links
}

function buildJobBreadcrumbJsonLd(
  job: JobWithCompany,
  slug: string,
): any {
  const items: any[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: `${SITE_URL}/`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: '$100k+ jobs',
      item: `${SITE_URL}/jobs/100k-plus`,
    },
  ]

  if (job.roleSlug && job.countryCode) {
    const roleLabel = prettyRole(job.roleSlug)
    const cc = job.countryCode.toUpperCase()
    const path = `/jobs/${job.roleSlug}/${job.countryCode.toLowerCase()}/100k-plus`

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

  if (t.includes('intern')) return '🧑‍🎓 Internship'
  if (t.includes('principal') || t.includes('staff'))
    return '⭐ Staff / Principal'
  if (t.includes('lead') || t.includes('head')) return '⭐ Lead'
  if (t.includes('senior') || t.includes('sr')) return '⭐ Senior'
  if (t.includes('junior') || t.includes('jr')) return '🌱 Junior'

  return null
}

function inferCategoryFromRoleSlug(roleSlug?: string | null): string | null {
  if (!roleSlug) return null
  const s = roleSlug.toLowerCase()

  if (s.includes('data')) return '📊 Data'
  if (s.includes('ml') || s.includes('machine-learning'))
    return '🤖 ML / AI'
  if (s.includes('engineer') || s.includes('developer'))
    return '💻 Engineering'
  if (s.includes('product')) return '🧭 Product'
  if (s.includes('design')) return '🎨 Design'
  if (s.includes('ops') || s.includes('operations'))
    return '⚙️ Operations'
  if (s.includes('sales')) return '💼 Sales'
  if (s.includes('marketing')) return '📣 Marketing'
  if (s.includes('legal') || s.includes('counsel')) return '⚖️ Legal'

  return null
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

function sanitizeDescriptionHtml(html: string): string {
  const withoutScripts = html.replace(
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    '',
  )
  return decodeHtmlEntities(withoutScripts)
}