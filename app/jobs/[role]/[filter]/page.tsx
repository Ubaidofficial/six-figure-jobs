import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'

import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { getSiteUrl } from '../../../../lib/seo/site'
import { countryCodeToSlug, countrySlugToCode } from '../../../../lib/seo/countrySlug'
import { isRoleFilterPageIndexable } from '../../../../lib/seo/indexabilityGates'
import { isCanonicalSlug } from '../../../../lib/roles/canonicalSlugs'
import { findBestMatchingRole } from '../../../../lib/roles/slugMatcher'

export const revalidate = 300

const SITE_URL = getSiteUrl()

const LOCATIONS: Record<string, string> = {
  'united-states': 'United States',
  'united-kingdom': 'United Kingdom',
  canada: 'Canada',
  germany: 'Germany',
  australia: 'Australia',
  france: 'France',
  netherlands: 'Netherlands',
  sweden: 'Sweden',
}

const SALARY_TIERS: Record<string, number> = {
  '100k-plus': 100_000,
  '200k-plus': 200_000,
  '300k-plus': 300_000,
  '400k-plus': 400_000,
}

function redirectLegacyTwoSegmentPath(role: string, filter: string): void {
  if (!SALARY_TIERS[filter]) return

  if (role === 'remote') {
    permanentRedirect('/remote')
  }

  if (countrySlugToCode(role)) {
    permanentRedirect(`/jobs/location/${role}`)
  }
}

type ParsedFilter =
  | { type: 'location'; value: string; label: string }
  | { type: 'salary'; value: number; label: string }

function formatRoleTitle(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/^Senior Senior /, 'Senior ')
    .replace(/^Staff Staff /, 'Staff ')
    .replace(/^Manager Manager /, 'Manager ')
}

function parseFilter(filter: string): ParsedFilter {
  if (LOCATIONS[filter]) {
    const code = countrySlugToCode(filter)
    if (!code) throw new Error('Unknown location filter')
    return { type: 'location', value: code, label: LOCATIONS[filter] }
  }
  if (filter.length === 2) {
    const slug = countryCodeToSlug(filter.toUpperCase())
    if (slug && LOCATIONS[slug]) {
      const code = countrySlugToCode(slug)
      if (!code) throw new Error('Unknown location filter')
      return { type: 'location', value: code, label: LOCATIONS[slug] }
    }
  }
  if (SALARY_TIERS[filter]) {
    return {
      type: 'salary',
      value: SALARY_TIERS[filter],
      label: filter.replace('-plus', '+').toUpperCase(),
    }
  }
  throw new Error('Invalid filter')
}

function getLocationCanonicalPath(role: string, countryCode: string): string {
  const countrySlug = countryCodeToSlug(countryCode) ?? countryCode.toLowerCase()
  // Country hubs are canonical for location-intent navigation.
  return `/jobs/location/${countrySlug}`
}

function getSalaryRangeText(jobs: JobWithCompany[]): string {
  const salaries = jobs
    .map((job) => Number(job.minAnnual || 0))
    .filter((salary) => salary > 0)
    .sort((a, b) => a - b)

  const minSalary = salaries[0] || 100_000
  const maxSalary = salaries[salaries.length - 1] || minSalary
  return `$${Math.floor(minSalary / 1000)}k-$${Math.floor(maxSalary / 1000)}k`
}

function countByRemoteMode(jobs: JobWithCompany[]) {
  let remote = 0
  let hybrid = 0
  let onsite = 0

  for (const job of jobs) {
    if (job.remoteMode === 'remote' || job.remote === true) remote++
    else if (job.remoteMode === 'hybrid') hybrid++
    else onsite++
  }

  return { remote, hybrid, onsite }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string; filter: string }>
}): Promise<Metadata> {
  const { role: roleRaw, filter: filterRaw } = await params
  const role = roleRaw.toLowerCase()
  const filter = filterRaw.toLowerCase()

  redirectLegacyTwoSegmentPath(role, filter)

  if (!isCanonicalSlug(role)) {
    const matched = findBestMatchingRole(role)
    if (matched) permanentRedirect(`/jobs/${matched}/${filter}`)
    if (SALARY_TIERS[filter]) {
      permanentRedirect(`/jobs/${filter}`)
    }
    permanentRedirect('/jobs')
  }

  let parsed: ParsedFilter
  try {
    parsed = parseFilter(filter)
  } catch {
    notFound()
  }

  if (parsed.type === 'location') {
    permanentRedirect(getLocationCanonicalPath(role, parsed.value))
  }

  const roleTitle = formatRoleTitle(role)
  const { jobs, total } = await queryJobs({
    roleSlugs: [role],
    minAnnual: parsed.value,
    pageSize: 40,
  })

  if (total === 0) {
    permanentRedirect(`/jobs/${role}`)
  }

  const salaryRange = getSalaryRangeText(jobs as JobWithCompany[])
  const allowIndex = isRoleFilterPageIndexable(total)
  const title = `${roleTitle} ${parsed.label} Jobs - ${total} Verified Positions`
  const description = `${total} ${roleTitle.toLowerCase()} roles paying ${parsed.label} (${salaryRange}) with salary transparency and direct-apply links.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/jobs/${role}/${filter}` },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/jobs/${role}/${filter}`,
      siteName: 'Six Figure Jobs',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function RoleFilterPage({
  params,
}: {
  params: Promise<{ role: string; filter: string }>
}) {
  const { role: roleRaw, filter: filterRaw } = await params
  const role = roleRaw.toLowerCase()
  const filter = filterRaw.toLowerCase()

  redirectLegacyTwoSegmentPath(role, filter)

  if (!isCanonicalSlug(role)) {
    const matched = findBestMatchingRole(role)
    if (matched) permanentRedirect(`/jobs/${matched}/${filter}`)
    if (SALARY_TIERS[filter]) {
      permanentRedirect(`/jobs/${filter}`)
    }
    permanentRedirect('/jobs')
  }

  let parsed: ParsedFilter
  try {
    parsed = parseFilter(filter)
  } catch {
    notFound()
  }

  if (parsed.type === 'location') {
    permanentRedirect(getLocationCanonicalPath(role, parsed.value))
  }

  const roleTitle = formatRoleTitle(role)
  const { jobs, total } = await queryJobs({
    roleSlugs: [role],
    minAnnual: parsed.value,
    pageSize: 40,
  })

  if (total === 0) permanentRedirect(`/jobs/${role}`)

  const typedJobs = jobs as JobWithCompany[]
  const salaryRange = getSalaryRangeText(typedJobs)
  const remoteMix = countByRemoteMode(typedJobs)
  const allowIndex = isRoleFilterPageIndexable(total)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-400">
        <ol className="flex items-center gap-1">
          <li><Link href="/">Home</Link></li>
          <li className="px-1">/</li>
          <li><Link href="/jobs/100k-plus">Jobs</Link></li>
          <li className="px-1">/</li>
          <li><Link href={`/jobs/${role}`}>{roleTitle}</Link></li>
          <li className="px-1">/</li>
          <li>{parsed.label}</li>
        </ol>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-slate-50">
        {roleTitle} {parsed.label} Jobs ({total.toLocaleString()})
      </h1>
      <p className="mb-4 text-sm text-slate-300">
        Verified {roleTitle.toLowerCase()} opportunities at the {parsed.label} tier, with current observed ranges around {salaryRange} and direct application links from hiring teams.
      </p>

      {!allowIndex && (
        <p className="mb-6 rounded-lg border border-amber-600/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
          This filter page stays followable but noindex until job volume reaches our indexability threshold.
        </p>
      )}

      <section className="mb-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
        <h2 className="mb-2 text-sm font-semibold text-slate-50">Market Snapshot</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{total.toLocaleString()} live roles currently match this salary filter.</li>
          <li>Observed minimum-to-maximum salary range: {salaryRange}.</li>
          <li>Remote/hybrid/on-site split: {remoteMix.remote}/{remoteMix.hybrid}/{remoteMix.onsite}.</li>
          <li>Canonical salary tier for this page: {parsed.label}.</li>
        </ul>
      </section>

      <JobList jobs={typedJobs} />

      <section className="mt-10 rounded-xl border border-slate-800 bg-slate-950/50 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">How to Use This Page</h2>
        <p className="mb-3 text-sm text-slate-300">
          Start with this tier page to benchmark salary expectations, then move to the role hub and location pages for market-specific depth. This flow helps avoid stale or low-fit applications when targeting high-paying roles.
        </p>
        <p className="text-sm text-slate-300">
          For teams publishing pSEO at scale, submit only indexable sitemap URLs and avoid manually pushing low-volume filter pages into GSC until they clear job-count quality gates.
        </p>
      </section>

      <section className="mt-10 rounded-xl border border-slate-800 bg-slate-950/50 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">FAQ</h2>
        <div className="space-y-3 text-sm text-slate-300">
          <div>
            <h3 className="font-medium text-slate-100">Why can a salary filter page be noindex?</h3>
            <p>Low-volume pages can underperform search intent. We keep them followable and index them only after they pass minimum live-job thresholds.</p>
          </div>
          <div>
            <h3 className="font-medium text-slate-100">Should I submit every filter URL to GSC?</h3>
            <p>No. Submit only sitemap-backed, indexable URLs. Let uncataloged thin variants mature before requesting indexing.</p>
          </div>
          <div>
            <h3 className="font-medium text-slate-100">What is the best next page after this filter?</h3>
            <p>Open the role hub for broader coverage, then review location-specific pages for market differences and compensation context.</p>
          </div>
        </div>
      </section>

      <section className="mt-12 rounded-xl border border-slate-800 bg-slate-950/50 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">Related Searches</h2>
        <div className="grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
          <Link href={`/jobs/${role}`} className="text-blue-400 hover:underline">
            All {roleTitle} Jobs
          </Link>
          <Link href={`/jobs/${role}/200k-plus`} className="text-blue-400 hover:underline">
            $200k+ {roleTitle} Jobs
          </Link>
          <Link href={`/jobs/location/united-states`} className="text-blue-400 hover:underline">
            {roleTitle} Jobs in United States
          </Link>
          <Link
            href={`/jobs/${parsed.value === 200_000 ? '300k-plus' : '200k-plus'}`}
            className="text-blue-400 hover:underline"
          >
            All {parsed.value === 200_000 ? '$300k+' : '$200k+'} Jobs
          </Link>
          <Link href="/jobs/100k-plus" className="text-blue-400 hover:underline">
            All $100k+ Jobs
          </Link>
        </div>
      </section>
    </main>
  )
}
