import type { Metadata } from 'next'
import Link from 'next/link'
import {
  queryJobs,
  type JobWithCompany,
} from '../../../lib/jobs/queryJobs'
import { buildJobSlugHref } from '../../../lib/jobs/jobSlug'
import { ALL_SALARY_ROLES } from '../../../lib/roles/salaryRoles'
import JobList from '../../components/JobList'
import { getSiteUrl } from '../../../lib/seo/site'

export const revalidate = 300

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 20

type SearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  searchParams?: Promise<SearchParams>
}

type SalaryBand = {
  id: string
  min: number
  max: number
  label: string
}

const SALARY_BANDS: SalaryBand[] = [
  { id: '100-199', min: 100_000, max: 199_999, label: '$100k–$199k' },
  { id: '200-299', min: 200_000, max: 299_999, label: '$200k–$299k' },
  { id: '300-399', min: 300_000, max: 399_999, label: '$300k–$399k' },
]

const DEFAULT_BAND = SALARY_BANDS[0]

function resolveSalaryBand(
  bandParam?: string | null,
  minParam?: string | null
): { band: SalaryBand; minAnnual: number; maxAnnual: number } {
  let band = bandParam && SALARY_BANDS.find((b) => b.id === bandParam)

  const parsedMin = minParam && !Number.isNaN(Number(minParam)) ? Number(minParam) : null

  if (!band && parsedMin != null) {
    if (parsedMin >= 100_000 && parsedMin < 200_000) {
      band = SALARY_BANDS[0]
    } else if (parsedMin >= 200_000 && parsedMin < 300_000) {
      band = SALARY_BANDS[1]
    } else if (parsedMin >= 300_000) {
      band = SALARY_BANDS[2]
    }
  }

  const effective = band || DEFAULT_BAND
  return {
    band: effective,
    minAnnual: effective.min,
    maxAnnual: effective.max,
  }
}

async function resolveSearchParams(
  input?: Promise<SearchParams>
): Promise<SearchParams> {
  return (await input) || {}
}

function parsePage(sp: SearchParams): number {
  const raw = (sp.page ?? '1') as string
  const n = Number(raw || '1') || 1
  return Math.max(1, n)
}

function normalizeStringParam(value?: string | string[]): string | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function prettyRole(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildPageHref(
  basePath: string,
  searchParams: SearchParams | undefined,
  page: number
): string {
  const params = new URLSearchParams()

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page') continue
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v != null) params.append(key, v)
        }
      } else if (value != null) {
        params.set(key, value)
      }
    }
  }

  params.set('page', String(page))
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function buildFilterHref(
  basePath: string,
  searchParams: SearchParams | undefined,
  updates: Partial<{ role: string | null; country: string | null; band: string | null }>
): string {
  const params = new URLSearchParams()

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v != null) params.append(key, v)
        }
      } else if (value != null) {
        params.set(key, value)
      }
    }
  }

  params.set('page', '1')

  if (updates.role !== undefined) {
    if (!updates.role) params.delete('role')
    else params.set('role', updates.role)
  }

  if (updates.country !== undefined) {
    if (!updates.country) params.delete('country')
    else params.set('country', updates.country)
  }

  if (updates.band !== undefined) {
    if (!updates.band) params.delete('band')
    else params.set('band', updates.band)
  }

  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function buildJobListJsonLd(jobs: JobWithCompany[], page: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '$100k+ tech jobs on Six Figure Jobs',
    itemListElement: jobs.map((job, index) => {
      const href = buildJobSlugHref(job)

      return {
        '@type': 'ListItem',
        position: (page - 1) * PAGE_SIZE + index + 1,
        item: {
          '@type': 'JobPosting',
          title: job.title,
          description: job.descriptionHtml || undefined,
          datePosted: job.postedAt?.toISOString(),
          employmentType: (job as any).type || undefined,
          hiringOrganization: {
            '@type': 'Organization',
            name: job.companyRef?.name || job.company,
            sameAs: job.companyRef?.website || undefined,
          },
          jobLocationType: job.remote ? 'TELECOMMUTE' : undefined,
          jobLocation: job.city
            ? {
                '@type': 'Place',
                address: {
                  '@type': 'PostalAddress',
                  addressLocality: job.city,
                  addressCountry: job.countryCode || undefined,
                },
              }
            : undefined,
          baseSalary:
            job.minAnnual || job.maxAnnual
              ? {
                  '@type': 'MonetaryAmount',
                  currency: job.currency || 'USD',
                  value: {
                    '@type': 'QuantitativeValue',
                    minValue: job.minAnnual ? Number(job.minAnnual) : undefined,
                    maxValue: job.maxAnnual ? Number(job.maxAnnual) : undefined,
                    unitText: 'YEAR',
                  },
                }
              : undefined,
          url: `${SITE_URL}${href}`,
        },
      }
    }),
  }
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const sp = await resolveSearchParams(props.searchParams)
  const page = parsePage(sp)
  const roleFilter = normalizeStringParam(sp.role)
  const countryFilter = normalizeStringParam(sp.country)
  const bandParam = normalizeStringParam(sp.band)
  const legacyMinParam = normalizeStringParam(sp.min)

  const { band, minAnnual, maxAnnual } = resolveSalaryBand(bandParam, legacyMinParam)

  const queryInput: any = {
    roleSlugs: roleFilter ? [roleFilter] : undefined,
    countryCode: countryFilter || undefined,
    minAnnual,
    maxAnnual,
    page,
    pageSize: 1,
  }

  if (countryFilter === 'US') {
    queryInput.currency = 'USD'
  }

  const result = await queryJobs(queryInput)
  const totalJobs = result.total

  const roleLabel = roleFilter ? prettyRole(roleFilter) : ''
  const countryLabel = countryFilter ? ` in ${countryFilter.toUpperCase()}` : ''
  
  const title = totalJobs > 0
    ? `$100k+ Tech Jobs${countryLabel} - ${totalJobs.toLocaleString()} Positions | Six Figure Jobs`
    : `$100k+ Tech Jobs${countryLabel} | Six Figure Jobs`

  const description = totalJobs > 0
    ? `Find ${totalJobs.toLocaleString()} tech jobs paying $100k+${countryLabel}. ${roleLabel ? roleLabel + ' roles' : 'Engineering, product, data roles'} at top companies. Updated daily.`
    : `High-salary tech jobs paying $100k+ from top companies. Remote, hybrid, and on-site positions. Updated daily.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/jobs/100k-plus` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/jobs/100k-plus`,
      siteName: 'Six Figure Jobs',
      type: 'website',
      images: [
        {
          url: `${SITE_URL}/og-100k.png`,
          width: 1200,
          height: 630,
          alt: '$100k+ Tech Jobs',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/og-100k.png`],
    },
  }
}

export default async function JobsHundredKPage(props: PageProps) {
  const sp = await resolveSearchParams(props.searchParams)
  const page = parsePage(sp)
  const basePath = '/jobs/100k-plus'

  const roleFilter = normalizeStringParam(sp.role)
  const countryFilter = normalizeStringParam(sp.country)
  const bandParam = normalizeStringParam(sp.band)
  const legacyMinParam = normalizeStringParam(sp.min)

  const { band, minAnnual, maxAnnual } = resolveSalaryBand(bandParam, legacyMinParam)
  const activeBandId = band.id

  const queryInput: any = {
    roleSlugs: roleFilter ? [roleFilter] : undefined,
    countryCode: countryFilter || undefined,
    minAnnual,
    maxAnnual,
    page,
    pageSize: PAGE_SIZE,
  }

  if (countryFilter === 'US') {
    queryInput.currency = 'USD'
  }

  const data = await queryJobs(queryInput)
  const jobs = data.jobs as JobWithCompany[]
  const totalPages = data.total > 0 ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  const jsonLd = buildJobListJsonLd(jobs, page)

  const roleFacets = Array.from(
    new Set(
      jobs
        .map((j) => (j as any).roleSlug as string | undefined)
        .filter((r): r is string => Boolean(r))
    )
  )
  const countryFacets = Array.from(
    new Set(jobs.map((j) => j.countryCode).filter((c): c is string => Boolean(c)))
  )

  const remoteRoleCounts = new Map<string, { roleSlug: string; count: number }>()
  for (const j of jobs) {
    const isRemote =
      j.remote || (j as any).remoteMode === 'remote' || (j as any).remoteMode === 'hybrid'
    const roleSlug = (j as any).roleSlug as string | undefined
    if (!isRemote || !roleSlug) continue
    const existing = remoteRoleCounts.get(roleSlug) ?? { roleSlug, count: 0 }
    existing.count += 1
    remoteRoleCounts.set(roleSlug, existing)
  }
  const topRemoteRoles = Array.from(remoteRoleCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  type CompanySummary = { slug: string; name: string; count: number }
  const companyMap = new Map<string, CompanySummary>()
  for (const j of jobs) {
    const company = j.companyRef
    if (!company || !company.slug) continue
    const key = company.slug
    const existing = companyMap.get(key) ?? {
      slug: company.slug,
      name: company.name || 'Company',
      count: 0,
    }
    existing.count += 1
    companyMap.set(key, existing)
  }
  const topCompanies = Array.from(companyMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const topSalaryRoles = ALL_SALARY_ROLES.slice(0, 12)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-400">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-slate-200 hover:underline">
              Home
            </Link>
          </li>
          <li className="px-1 text-slate-600">/</li>
          <li aria-current="page" className="text-slate-200">
            $100k+ jobs
          </li>
        </ol>
      </nav>

      <header className="mb-6 space-y-3">
        <h1 className="text-2xl font-semibold text-slate-50">
          {band.label} tech jobs from top companies
        </h1>
        <p className="text-sm text-slate-300">
          Live, high-paying roles scraped directly from ATS-powered company job boards. Filter by
          role, country, and salary band to explore the strongest $100k+ opportunities in tech and
          SaaS.
        </p>
      </header>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <h2 className="text-sm font-semibold text-slate-50">Popular remote role pages</h2>
          <p className="mt-1 text-xs text-slate-400">
            Deep dives into remote $100k+ roles by title. Each page focuses on a single role across
            top companies.
          </p>
          {topRemoteRoles.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Remote role pages will appear here as new jobs are indexed.
            </p>
          ) : (
            <ul className="mt-3 space-y-1 text-xs">
              {topRemoteRoles.map((r) => (
                <li key={r.roleSlug}>
                  <Link
                    href={`/remote/${r.roleSlug}`}
                    className="inline-flex items-center justify-between gap-2 rounded-full bg-slate-900 px-3 py-1 text-slate-200 hover:bg-slate-800"
                  >
                    <span>{prettyRole(r.roleSlug)}</span>
                    <span className="text-[11px] text-slate-500">
                      {r.count.toLocaleString()} jobs
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <h2 className="text-sm font-semibold text-slate-50">High-intent salary guides</h2>
          <p className="mt-1 text-xs text-slate-400">
            Data-backed salary estimates for core tech and SaaS roles using live Six Figure Jobs
            data.
          </p>
          <ul className="mt-3 space-y-1 text-xs">
            {topSalaryRoles.slice(0, 8).map((role) => (
              <li key={role.slug}>
                <Link
                  href={`/salary/${role.slug}`}
                  className="inline-flex items-center justify-between gap-2 rounded-full bg-slate-900 px-3 py-1 text-slate-200 hover:bg-slate-800"
                >
                  <span>{role.label}</span>
                  <span className="text-[11px] text-slate-500">Salary guide</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <h2 className="text-sm font-semibold text-slate-50">Top companies hiring $100k+</h2>
          <p className="mt-1 text-xs text-slate-400">
            Companies with the most active $100k+ roles in our ATS index.
          </p>
          {topCompanies.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Company leaderboards will appear here as we index more ATS boards.
            </p>
          ) : (
            <ul className="mt-3 space-y-1 text-xs">
              {topCompanies.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/company/${c.slug}`}
                    className="inline-flex items-center justify-between gap-2 rounded-full bg-slate-900 px-3 py-1 text-slate-200 hover:bg-slate-800"
                  >
                    <span>{c.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {c.count.toLocaleString()} jobs
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs text-slate-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Role:</span>
            <Link
              href={buildFilterHref(basePath, sp, { role: null })}
              className={`rounded-full px-2 py-1 ${
                !roleFilter ? 'bg-slate-200 text-slate-900' : 'bg-slate-900 text-slate-200'
              }`}
            >
              Any
            </Link>
            {roleFacets.slice(0, 12).map((roleSlug) => (
              <Link
                key={roleSlug}
                href={buildFilterHref(basePath, sp, { role: roleSlug })}
                className={`rounded-full px-2 py-1 ${
                  roleFilter === roleSlug
                    ? 'bg-slate-200 text-slate-900'
                    : 'bg-slate-900 text-slate-200'
                }`}
              >
                {prettyRole(roleSlug)}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Country:</span>
            <Link
              href={buildFilterHref(basePath, sp, { country: null })}
              className={`rounded-full px-2 py-1 ${
                !countryFilter ? 'bg-slate-200 text-slate-900' : 'bg-slate-900 text-slate-200'
              }`}
            >
              Any
            </Link>
            {countryFacets.slice(0, 10).map((cc) => (
              <Link
                key={cc}
                href={buildFilterHref(basePath, sp, { country: cc })}
                className={`rounded-full px-2 py-1 ${
                  countryFilter === cc
                    ? 'bg-slate-200 text-slate-900'
                    : 'bg-slate-900 text-slate-200'
                }`}
              >
                {cc.toUpperCase()}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Salary band:</span>
            {SALARY_BANDS.map((b) => (
              <Link
                key={b.id}
                href={buildFilterHref(basePath, sp, { band: b.id })}
                className={`rounded-full px-2 py-1 ${
                  activeBandId === b.id
                    ? 'bg-slate-200 text-slate-900'
                    : 'bg-slate-900 text-slate-200'
                }`}
              >
                {b.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">
          No jobs match your filters yet. Try relaxing the filters or check back soon as ATS
          scrapes run regularly.
        </p>
      ) : (
        <>
          <JobList jobs={jobs} />

          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-6 flex items-center justify-between gap-3 text-xs"
            >
              <div className="text-slate-400">
                Page <span className="font-semibold text-slate-100">{page}</span> of{' '}
                <span className="font-semibold text-slate-100">{totalPages}</span>
              </div>

              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link
                    href={buildPageHref(basePath, sp, page - 1)}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-slate-200 hover:border-slate-700 hover:bg-slate-900"
                  >
                    Previous
                  </Link>
                )}

                {page < totalPages && (
                  <Link
                    href={buildPageHref(basePath, sp, page + 1)}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-slate-200 hover:border-slate-700 hover:bg-slate-900"
                  >
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  )
}
