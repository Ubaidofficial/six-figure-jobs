// app/job/[slug]/page.tsx

import type { Metadata } from 'next'
import NextLink from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '../../../lib/prisma'
import {
  parseJobSlugParam,
  buildJobSlugHref,
  buildJobSlug,
  getShortStableIdForJobId,
} from '../../../lib/jobs/jobSlug'
import { buildJobMetadata } from '../../../lib/seo/jobMeta'
import { buildJobJsonLd } from '../../../lib/seo/jobJsonLd'
import {
  queryJobs,
  type JobWithCompany,
} from '../../../lib/jobs/queryJobs'
import { formatRelativeTime } from '../../../lib/utils/time'
import { buildLogoUrl } from '../../../lib/companies/logo'
import { buildSalaryText } from '../../../lib/jobs/salary'
import { SITE_NAME, getSiteUrl } from '../../../lib/seo/site'
import {
  countryCodeToSlug,
  countryCodeToName,
  COUNTRY_CODE_TO_NAME,
} from '../../../lib/seo/countrySlug'

export const revalidate = 3600

const SITE_URL = getSiteUrl()

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { jobId, externalId, shortId } = parseJobSlugParam(slug)

  if (!jobId && !externalId && !shortId) {
    return { title: `Job not found | ${SITE_NAME}` }
  }

  const where: any = (() => {
    const ors: any[] = []
    if (jobId) ors.push({ id: jobId })
    if (externalId) ors.push({ externalId })
    if (shortId) ors.push({ shortId })
    if (ors.length === 0) return null
    if (ors.length === 1) return { ...ors[0], isExpired: false }
    return { OR: ors, isExpired: false }
  })()

  if (!where) {
    return { title: `Job not found | ${SITE_NAME}` }
  }

  const job = await prisma.job.findFirst({
    where,
    include: { companyRef: true },
  })

  if (!job) return { title: `Job not found | ${SITE_NAME}` }

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
  const { jobId, externalId, shortId } = parseJobSlugParam(slug)

  const where: any = (() => {
    const ors: any[] = []
    if (jobId) ors.push({ id: jobId })
    if (externalId) ors.push({ externalId })
    if (shortId) ors.push({ shortId })
    if (ors.length === 0) return null
    if (ors.length === 1) return { ...ors[0], isExpired: false }
    return { OR: ors, isExpired: false }
  })()

  if (!where) return notFound()

  const job = await prisma.job.findFirst({
    where,
    include: { companyRef: true },
  })

  if (!job) return notFound()

  const typedJob = job as JobWithCompany
  const canonicalSlug = buildJobSlug(typedJob)

  // 301 redirect old slugs -> canonical v2.8 (no loops)
  // Redirect conditions:
  // - legacy formats (-jid-, -job-)
  // - raw job id in URL (contains ":")
  // - v2.8 slug present but title differs (normalize)
  const incoming = decodeURIComponent(slug || '').split('/').pop() || slug
  const isLegacy =
    incoming.includes('-jid-') ||
    incoming.includes('-job-') ||
    incoming.includes(':')
  const isAlreadyCanonical = incoming === canonicalSlug
  const shouldNormalizeV28 =
    incoming.includes('-j-') && !isAlreadyCanonical

  if (!isAlreadyCanonical && (isLegacy || shouldNormalizeV28)) {
    redirect(`/job/${canonicalSlug}`)
  }

  const company = typedJob.companyRef

  // Clean company name - take only the first part before description
  const rawCompanyName = company?.name || typedJob.company || 'Company'
  const companyName = cleanCompanyName(rawCompanyName)

  const logoUrl = buildLogoUrl(
    company?.logoUrl ?? typedJob.companyLogo ?? null,
    company?.website ?? null,
  )

  // Safely read LinkedIn URL even if TS types are lagging behind schema
  const companyLinkedIn =
    (company as any)?.linkedinUrl &&
    typeof (company as any).linkedinUrl === 'string'
      ? ((company as any).linkedinUrl as string)
      : null

  /* ------------------------------ Helpers ---------------------------------- */

  const salaryText = buildSalaryText(typedJob)
  const locationText = buildLocationText(typedJob)
  const seniority = inferSeniorityFromTitle(typedJob.title)
  const category = inferCategoryFromRoleSlug(typedJob.roleSlug)
  const remoteModeLabel = getRemoteModeLabel(typedJob)
  const showRemoteBadge =
    remoteModeLabel === 'Remote' || remoteModeLabel === 'Hybrid'
  const showLocationBadge = remoteModeLabel !== 'Remote'
  const postedLabel = formatRelativeTime(
    typedJob.postedAt ?? typedJob.createdAt ?? typedJob.updatedAt ?? null,
  )
  const isFeatured =
    Boolean((typedJob as any)?.featured) ||
    ((typedJob as any)?.featureExpiresAt
      ? new Date((typedJob as any).featureExpiresAt).getTime() > Date.now()
      : false)

  const requirements = parseArray(typedJob.requirementsJson)
  const benefitItems = parseArray(typedJob.benefitsJson)
    .map((b) => b.trim())
    .filter((b): b is string => b.length > 0)
  const showApply = isValidUrl(typedJob.applyUrl)

  // Prefer rich HTML, fallback to raw text
  const rawDescriptionHtml =
    (typedJob as any).descriptionHtml ??
    (typedJob as any).description ??
    (typedJob as any).body ??
    null

  const safeDescriptionHtml = rawDescriptionHtml
    ? sanitizeDescriptionHtml(String(rawDescriptionHtml))
    : null

  const hasDescription =
    !!safeDescriptionHtml && safeDescriptionHtml.trim().length > 0

  const jsonLd = buildJobJsonLd(typedJob)
  const breadcrumbJsonLd = buildJobBreadcrumbJsonLd(typedJob, canonicalSlug)
  const internalLinks = buildInternalLinks(typedJob)
  const aiSummary = buildHeuristicSummary(
    typedJob,
    salaryText,
    locationText,
    seniority,
  )

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

  const companyTags = parseTags(company?.tagsJson).filter(
    (tag) => tag && tag.trim().length > 0,
  )

  /* ------------------------------ Render ----------------------------------- */

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-10">
        {/* Breadcrumbs */}
        <nav className="mb-4 text-xs text-slate-400" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <NextLink
                href="/"
                className="focus-ring rounded-md hover:text-slate-200 hover:underline"
              >
                Home
              </NextLink>
            </li>
            <li className="px-1 text-slate-600">/</li>
            <li>
              <NextLink
                href="/jobs/100k-plus"
                className="focus-ring rounded-md hover:text-slate-200 hover:underline"
              >
                $100k+ jobs
              </NextLink>
            </li>
            <li className="px-1 text-slate-600">/</li>
            <li aria-current="page" className="text-slate-200">
              {typedJob.title}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start">
          {/* ----------------------------- Sidebar ----------------------------- */}
          <aside className="order-2 space-y-4 md:order-none md:col-start-2 md:self-start">
            <div className="space-y-4 md:sticky md:top-24">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
                <div className="flex flex-col items-center text-center">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={`${companyName} logo`}
                      className="h-16 w-16 rounded-2xl bg-slate-900/60 object-contain p-2 ring-1 ring-slate-800/70"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900/60 text-lg font-semibold text-slate-100 ring-1 ring-slate-800/70">
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
                          className="rounded-full bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-200 ring-1 ring-slate-800/70"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                    {isValidUrl(company?.website) && (
                      <a
                        href={cleanUrl(company!.website!)}
                        target="_blank"
                        rel="nofollow noreferrer"
                        className="focus-ring inline-flex items-center rounded-full border border-slate-700/80 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/5"
                      >
                        Company site
                      </a>
                    )}

                    {isValidUrl(companyLinkedIn) && (
                      <a
                        href={cleanUrl(companyLinkedIn!)}
                        target="_blank"
                        rel="nofollow noreferrer"
                        className="focus-ring inline-flex items-center rounded-full border border-slate-700/80 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/5"
                      >
                        LinkedIn
                      </a>
                    )}

                    {company?.slug && (
                      <NextLink
                        href={`/company/${company.slug}`}
                        className="focus-ring inline-flex items-center rounded-full border border-slate-700/80 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/5"
                      >
                        More roles
                      </NextLink>
                    )}
                  </div>
                </div>
              </div>

              {showApply && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                    Apply
                  </p>
                  <a
                    href={cleanUrl(typedJob.applyUrl!)}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    className="focus-ring mt-3 inline-flex w-full items-center justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_40px_rgba(16,185,129,0.22)] transition hover:bg-emerald-300"
                  >
                    Apply on company site
                  </a>
                  <p className="mt-2 text-xs text-slate-400">
                    ↗️ Opens in a new tab. We don’t track your application.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
                <h3 className="text-sm font-semibold text-slate-50">
                  🛡️ Quality checks
                </h3>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  <li>Verified salary data</li>
                  <li>Source-linked listing</li>
                  <li>Report suspicious jobs</li>
                </ul>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
              {/* Company snapshot */}
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left text-xs leading-relaxed text-slate-200 shadow-inner shadow-slate-900/30">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-400">
                    Company snapshot
                  </p>
                  {company?.website && (
                    <a
                      href={cleanUrl(company.website)}
                      target="_blank"
                      rel="nofollow noreferrer"
                      className="focus-ring rounded-full border border-slate-700/80 bg-slate-950/40 px-3 py-1 text-[11px] font-semibold text-slate-100 transition hover:bg-white/5"
                    >
                      Company site
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-[11px] text-slate-200">
                  {company?.sizeBucket && (
                    <span className="inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 ring-1 ring-slate-800/70">
                      {company.sizeBucket} employees
                    </span>
                  )}
                  {company?.foundedYear && (
                    <span className="inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 ring-1 ring-slate-800/70">
                      Founded {company.foundedYear}
                    </span>
                  )}
                  {company?.industry && (
                    <span className="inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 ring-1 ring-slate-800/70">
                      {company.industry}
                    </span>
                  )}
                  {company?.headquarters && (
                    <span className="inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 ring-1 ring-slate-800/70">
                      HQ: {company.headquarters}
                    </span>
                  )}
                  {companyTags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 ring-1 ring-slate-800/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-[12px] leading-relaxed text-slate-200">
                  {company?.description
                    ? truncateText(
                        stripTags(decodeHtmlEntities(company.description)),
                        600,
                      )
                    : `${companyName} is hiring $100k+ talent across multiple teams. Explore their open roles below.`}
                </div>
              </div>
              {benefitItems.length > 0 && (
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-200 shadow-inner shadow-slate-900/30">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-400">
                    Benefits the company offers
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {benefitItems.slice(0, 6).map((benefit, idx) => (
                      <span
                        key={`${benefit}-${idx}`}
                        className="inline-flex max-w-[14rem] items-center rounded-full bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-200 ring-1 ring-slate-800/70"
                      >
                        {formatBenefitPill(benefit)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* --------------------------- Job Content --------------------------- */}
          <section className="order-1 space-y-8 md:order-none md:col-start-1">
            {/* Hero */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg shadow-slate-900/40">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
                {typedJob.title}
              </h1>

              <div className="mt-2 text-sm text-slate-300">
                <div className="font-medium">
                  {company?.slug ? (
                    <NextLink
                      href={`/company/${company.slug}`}
                      className="focus-ring rounded-md hover:underline"
                    >
                      {companyName}
                    </NextLink>
                  ) : (
                    companyName
                  )}
                </div>

                {locationText && (
                  <p className="mt-1 text-sm text-slate-400">{locationText}</p>
                )}
              </div>

              {salaryText && (
                <div className="mt-4 inline-flex rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 font-mono text-xl font-semibold text-emerald-200">
                  {salaryText}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                {showRemoteBadge && remoteModeLabel ? <span>{remoteModeLabel}</span> : null}
                {typedJob.type ? (
                  <>
                    {showRemoteBadge && remoteModeLabel ? (
                      <span className="text-slate-600">•</span>
                    ) : null}
                    <span>{typedJob.type}</span>
                  </>
                ) : null}
                {category ? (
                  <>
                    {(showRemoteBadge && remoteModeLabel) || typedJob.type ? (
                      <span className="text-slate-600">•</span>
                    ) : null}
                    <span>{category}</span>
                  </>
                ) : null}
                {seniority ? (
                  <>
                    {(showRemoteBadge && remoteModeLabel) || typedJob.type || category ? (
                      <span className="text-slate-600">•</span>
                    ) : null}
                    <span>{seniority}</span>
                  </>
                ) : null}
                {postedLabel ? (
                  <>
                    {(showRemoteBadge && remoteModeLabel) || typedJob.type || category || seniority ? (
                      <span className="text-slate-600">•</span>
                    ) : null}
                    <span>Posted {postedLabel}</span>
                  </>
                ) : null}
                {isFeatured ? (
                  <>
                    {(showRemoteBadge && remoteModeLabel) || typedJob.type || category || seniority || postedLabel ? (
                      <span className="text-slate-600">•</span>
                    ) : null}
                    <span className="font-semibold text-amber-300">Featured</span>
                  </>
                ) : null}
              </div>
            </section>

            {aiSummary && (
              <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-relaxed text-slate-200">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Why this $100k+ role stands out
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {aiSummary.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Description */}
            {hasDescription ? (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-50">About the role</h2>
                <div
                  className="prose prose-invert max-w-none text-sm leading-relaxed prose-p:text-slate-200 prose-li:text-slate-200 prose-strong:text-slate-100 prose-ul:list-disc prose-ul:pl-5 prose-li:my-1"
                  dangerouslySetInnerHTML={{ __html: safeDescriptionHtml! }}
                />
              </section>
            ) : (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-50">About the role</h2>
                <p className="text-sm leading-relaxed text-slate-200">
                  This role is sourced directly from the employer&apos;s careers site. The full job description is available on their ATS.
                </p>
                {showApply && (
                  <div className="space-y-2">
                    <a
                      href={cleanUrl(typedJob.applyUrl!)}
                      target="_blank"
                      rel="nofollow sponsored noopener noreferrer"
                      className="focus-ring inline-flex items-center justify-center rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-[0_14px_40px_rgba(16,185,129,0.22)] transition hover:bg-emerald-300"
                    >
                      Apply on company site
                    </a>
                    <p className="text-xs text-slate-400">
                      ↗️ Opens in a new tab. We don’t track your application.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* Requirements */}
            {requirements.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-50">Requirements</h2>
                <ul className="list-disc pl-5 text-sm text-slate-200">
                  {requirements.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Benefits */}
            {benefitItems.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-50">Benefits</h2>
                <ul className="list-disc pl-5 text-sm text-slate-200">
                  {benefitItems.map((b, i) => (
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
                      <NextLink href={link.href} className="focus-ring rounded-md hover:underline">
                        {link.label}
                      </NextLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Similar Jobs */}
            {similarJobs.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-50">Similar $100k+ jobs</h2>
                <p className="text-xs text-slate-400">Based on role, country and salary band</p>

                <ul className="space-y-3 text-sm">
                  {similarJobs.map((sj) => {
                    const sjSalary = buildSalaryText(sj)
                    const sjLocation = buildLocationText(sj)
                    const sjPosted = formatRelativeTime(
                      sj.postedAt ?? sj.createdAt ?? sj.updatedAt ?? null,
                    )
                    const roleSlug = sj.roleSlug
                    const countryCode = sj.countryCode?.toUpperCase() ?? null
                    const countryName = countryCode
                      ? countryCodeToName(countryCode)
                      : null
                    const hasCountryInfo = Boolean(countryCode && countryName)
                    const isCountryMismatch =
                      countryName && countryCode
                        ? countryName.toUpperCase() !== countryCode
                        : false
                    const hasValidCountry = hasCountryInfo && isCountryMismatch
                    const countrySlug =
                      hasValidCountry && countryCode
                        ? countryCodeToSlug(countryCode)
                        : null
                    const sliceHref =
                      roleSlug && hasValidCountry && countrySlug
                        ? `/jobs/${roleSlug}/${countrySlug}/100k-plus`
                        : roleSlug
                        ? `/jobs/${roleSlug}/100k-plus`
                        : '/jobs/100k-plus'
                    const snippet = buildSafeSnippet(sj)

                    return (
                      <li
                        key={sj.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <NextLink
                              href={buildJobSlugHref(sj)}
                              className="focus-ring rounded-md font-semibold text-slate-100 hover:underline"
                            >
                              {sj.title}
                            </NextLink>

                            <div className="text-slate-300">
                              {cleanCompanyName(
                                sj.companyRef?.name || sj.company || '',
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                              {sjLocation && (
                                <span className="rounded-full bg-slate-900 px-2 py-0.5 ring-1 ring-slate-800">
                                  {sjLocation}
                                </span>
                              )}
                              {sjSalary && (
                                <span className="rounded-full bg-slate-900 px-2 py-0.5 ring-1 ring-slate-800">
                                  {sjSalary}
                                </span>
                              )}
                              {sj.roleSlug && (
                                <NextLink
                                  href={sliceHref}
                                  className="focus-ring rounded-full bg-slate-900 px-2 py-0.5 text-blue-300 ring-1 ring-slate-800 hover:text-blue-200"
                                >
                                  {prettyRole(sj.roleSlug)} roles →
                                </NextLink>
                              )}
                              {sjPosted && (
                                <span className="rounded-full bg-slate-900 px-2 py-0.5 ring-1 ring-slate-800">
                                  Posted {sjPosted}
                                </span>
                              )}
                            </div>
                            {snippet && (
                              <p className="mt-2 text-[12px] text-slate-400">
                                {snippet}
                              </p>
                            )}
                          </div>
                          <NextLink
                            href={buildJobSlugHref(sj)}
                            className="focus-ring inline-flex items-center justify-center rounded-full border border-slate-700 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-slate-500"
                          >
                            View role details
                          </NextLink>
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

/**
 * Build location text - handles remote vs physical location
 */
function buildLocationText(job: any): string {
  const isRemote = job.remote === true || job.remoteMode === 'remote'

  if (isRemote) {
    if (job.countryCode) {
      return `Remote (${job.countryCode})`
    }
    return 'Remote (International)'
  }

  const hasValidCityAndCountry =
    job.city &&
    job.countryCode &&
    isLocationValid(job.city, job.countryCode, job.locationRaw)

  if (hasValidCityAndCountry) {
    return `${job.city}, ${job.countryCode}`
  }

  if (job.locationRaw) return job.locationRaw
  if (job.countryCode) return job.countryCode
  return 'Location not specified'
}

function getRemoteModeLabel(job: any): 'Remote' | 'Hybrid' | null {
  const mode = job.remoteMode as 'remote' | 'hybrid' | 'onsite' | null

  if (mode === 'remote' || job.remote === true) return 'Remote'
  if (mode === 'hybrid') return 'Hybrid'

  return null
}

type InternalLink = { href: string; label: string }

function prettyRole(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildInternalLinks(job: JobWithCompany): InternalLink[] {
  const links: InternalLink[] = []
  const companyName = cleanCompanyName(
    job.companyRef?.name || job.company || '',
  )
  const countryCode = job.countryCode?.toUpperCase() ?? null
  const countryName = countryCode ? countryCodeToName(countryCode) : null
  const hasCountryInfo = Boolean(countryCode && countryName)
  const isCountryMismatch =
    countryName && countryCode
      ? countryName.toUpperCase() !== countryCode
      : false
  const isCountryRecognized = hasCountryInfo && isCountryMismatch
  const countrySlug =
    isCountryRecognized && countryCode
      ? countryCodeToSlug(countryCode)
      : null
  const roleSlug = job.roleSlug
  const roleLabel = roleSlug ? prettyRole(roleSlug) : ''

  if (roleSlug && isCountryRecognized && countrySlug) {
    links.push({
      href: `/jobs/${roleSlug}/${countrySlug}/100k-plus`,
      label: `$100k+ ${roleLabel} jobs in ${
        countryName ?? countryCode ?? 'this country'
      }`,
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

  links.push({
    href: '/jobs/100k-plus',
    label: 'All $100k+ jobs',
  })

  if (roleSlug) {
    links.push({
      href: `/salary/${roleSlug}`,
      label: `${roleLabel} salary guide`,
    })
  }

  if (job.companyRef?.slug) {
    links.push({
      href: `/company/${job.companyRef.slug}`,
      label: `More jobs at ${companyName}`,
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

function buildHeuristicSummary(
  job: JobWithCompany,
  salaryText: string | null,
  locationText: string | null,
  seniority: string | null,
) {
  const summary: string[] = []
  const companyDesc =
    (job.companyRef as any)?.description ??
    (job as any)?.companyDescription ??
    null
  const descSentence = companyDesc
    ? firstSentence(stripTags(decodeHtmlEntities(companyDesc)))
    : null

  if (descSentence) {
    summary.push(descSentence)
  }

  if (salaryText) {
    summary.push(`Salary: ${salaryText} (shown to candidates).`)
  }

  if (locationText) {
    const mode = job.remote
      ? 'Remote'
      : job.remoteMode === 'hybrid'
      ? 'Hybrid'
      : 'On-site'
    summary.push(`Location: ${locationText} · ${mode}.`)
  }

  if (seniority) {
    summary.push(`Level: ${seniority.replace('⭐ ', '')}.`)
  }

  const reqs = parseArray(job.requirementsJson).filter(Boolean).slice(0, 1)
  if (reqs.length) {
    summary.push(`Top requirement: ${reqs[0]}.`)
  }

  return summary.length ? summary.slice(0, 3) : null
}

function buildJobBreadcrumbJsonLd(job: JobWithCompany, slug: string): any {
  const items: any[] = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${SITE_URL}/jobs/100k-plus` },
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

function firstSentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/(.+?[.!?])\s/)
  if (match && match[1]) return match[1].trim()
  return trimmed.slice(0, 200)
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

function inferCategoryFromRoleSlug(roleSlug?: string | null): string | null {
  if (!roleSlug) return null
  const s = roleSlug.toLowerCase()

  if (s.includes('data')) return 'Data'
  if (s.includes('ml') || s.includes('machine-learning')) return 'ML / AI'
  if (s.includes('engineer') || s.includes('developer')) return 'Engineering'
  if (s.includes('product')) return 'Product'
  if (s.includes('design')) return 'Design'
  if (s.includes('ops') || s.includes('operations')) return 'Operations'
  if (s.includes('sales')) return 'Sales'
  if (s.includes('marketing')) return 'Marketing'
  if (s.includes('legal') || s.includes('counsel')) return 'Legal'

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
    if (lower.includes(name.toLowerCase())) {
      return code
    }
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
  if (detected && detected !== countryCode.toUpperCase()) {
    return false
  }
  return true
}

function buildSafeSnippet(job: JobWithCompany): string {
  const rawDescription =
    (job as any).descriptionHtml ??
    (job as any).description ??
    (job as any).body ??
    ''
  const trimmed = stripTags(decodeHtmlEntities(String(rawDescription)))
    .replace(/\s+/g, ' ')
    .trim()
  return trimmed ? truncateText(trimmed, 120) : ''
}

function formatBenefitPill(benefit: string): string {
  const text = stripTags(decodeHtmlEntities(benefit)).trim()
  return truncateText(text, 90)
}
