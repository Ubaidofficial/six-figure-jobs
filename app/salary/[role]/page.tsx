// app/salary/[role]/page.tsx

import type { Metadata } from 'next'
import Link from '@/components/ui/Link'
import { notFound, permanentRedirect } from 'next/navigation'
import {
  queryJobs,
  type JobWithCompany,
} from '../../../lib/jobs/queryJobs'
import JobList from '../../components/JobList'
import type { Job } from '@prisma/client'
import { SITE_NAME, getSiteUrl, defaultOgImages } from '../../../lib/seo/site'
import { capDescription } from '../../../lib/seo/jobMeta'
import { buildSalaryGuideTitle } from '../../../lib/seo/metaText'
import { countryCodeToSlug } from '../../../lib/seo/countrySlug'
import { buildItemListJsonLd } from '../../../lib/seo/itemListJsonLd'
import { isCanonicalSlug } from '../../../lib/roles/canonicalSlugs'
import { findBestMatchingRole, slugToLabel } from '../../../lib/roles/slugMatcher'
import { PageHero, PageSection, PageStatGrid } from '@/components/seo/PageChrome'
import { RoleSalarySections } from '@/components/salary/RoleSalaryGuide'
import { loadRoleSalaryGuide } from '../../../lib/salary/roleGuide'
import {
  buildFaqs,
  buildGuideJsonLd,
  buildMetaDescription,
  buildTakeaways,
  formatGuideDate,
  formatPay,
} from '../../../lib/salary/roleGuideContent'

export const revalidate = 1800

const SITE_URL = getSiteUrl()

const PAGE_SIZE = 50

type SearchParams = Record<string, string | string[] | undefined>

const BAND_MAP: Record<string, number> = {
  '100k-plus': 100_000,
  '200k-plus': 200_000,
  '300k-plus': 300_000,
  '400k-plus': 400_000,
}

// BLS O*NET Standard Occupational Classification codes.
// Used in the Occupation JSON-LD schema to connect salary data to Google's
// knowledge base and improve eligibility for salary rich results.
const ONET_CODES: Record<string, string> = {
  'software-engineer':        '15-1252.00',
  'backend-engineer':         '15-1252.00',
  'frontend-engineer':        '15-1254.00',
  'full-stack-engineer':      '15-1254.00',
  'mobile-engineer':          '15-1252.00',
  'ios-engineer':             '15-1252.00',
  'android-engineer':         '15-1252.00',
  'data-engineer':            '15-2041.00',
  'data-scientist':           '15-2051.00',
  'machine-learning-engineer':'15-2051.00',
  'ai-engineer':              '15-2051.00',
  'devops-engineer':          '15-1244.00',
  'site-reliability-engineer':'15-1244.00',
  'platform-engineer':        '15-1244.00',
  'security-engineer':        '15-1212.00',
  'engineering-manager':      '11-3021.00',
  'product-manager':          '11-3021.00',
  'product-designer':         '27-1021.00',
  'ux-designer':              '27-1021.00',
  'data-analyst':             '15-2041.00',
  'account-executive':        '41-3011.00',
  'sales-development-representative': '41-3011.00',
  'customer-success':         '13-1161.00',
  'solutions-engineer':       '15-1299.08',
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function resolveSearchParams(
  input?: Promise<SearchParams>,
): Promise<SearchParams> {
  return (await input) || {}
}

function parsePage(searchParams?: SearchParams): number {
  const raw = (searchParams?.page ?? '1') as string
  const n = Number(raw || '1') || 1
  return Math.max(1, n)
}

// Same labels as the rest of the site ("DevOps Engineer", "ML Engineer"), not plain title case ("Devops Engineer").
function prettyRole(slug: string): string {
  return slugToLabel(slug)
}

function buildPageHref(
  basePath: string,
  searchParams: SearchParams | undefined,
  page: number,
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

function resolveCanonicalRoleOrRedirect(rawRole: string): string {
  const normalized = String(rawRole || '').trim().toLowerCase()
  if (!normalized) permanentRedirect('/salary/software-engineer')
  if (isCanonicalSlug(normalized)) return normalized

  const matched = findBestMatchingRole(normalized)
  if (matched) permanentRedirect(`/salary/${matched}`)

  // No role it could mean: 404, as /jobs/<role> and /remote/<role> do. Sending every unknown slug ("xyz", "mechanic")
  // to the software engineer guide was a misleading redirect (found 2026-11-08).
  notFound()
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>
  searchParams?: Promise<SearchParams>
}): Promise<Metadata> {
  const { role } = await params
  const sp = searchParams ? await resolveSearchParams(searchParams) : {}
  const roleSlug = resolveCanonicalRoleOrRedirect(role)
  const roleName = prettyRole(roleSlug)
  const bandSlug = typeof sp.band === 'string' ? sp.band : undefined
  const minAnnual =
    bandSlug && BAND_MAP[bandSlug] ? BAND_MAP[bandSlug] : 100_000
  const salaryBand =
    minAnnual >= 400_000
      ? '$400k+'
      : minAnnual >= 300_000
      ? '$300k+'
      : minAnnual >= 200_000
      ? '$200k+'
      : '$100k+'

  // Same filter and numbers as the page body (cached), so the snippet and the page never disagree.
  const guide = await loadRoleSalaryGuide(roleSlug, minAnnual)
  let description = buildMetaDescription({ roleName, bandLabel: salaryBand, guide })

  description = capDescription(description)
  const allowIndex = guide.listings >= 1
  const title = buildSalaryGuideTitle(roleName, salaryBand, guide.usd?.median ?? null)
  // Canonical always points to the base salary page — band filter is a view
  // variant, not a separate indexable page. Query params in canonicals confuse
  // Google and fragment the PageRank across variants.
  const canonical = `${SITE_URL}/salary/${roleSlug}`

  return {
    title,
    description,
    alternates: { canonical },
    robots: allowIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: { images: defaultOgImages(),
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export type PageProps = {
  params: Promise<{ role: string }>
  searchParams?: Promise<SearchParams>
}

function getBandLabel(minAnnual: number): string {
  if (minAnnual >= 400_000) return '$400k+'
  if (minAnnual >= 300_000) return '$300k+'
  if (minAnnual >= 200_000) return '$200k+'
  return '$100k+'
}

function StructuredData({
  jobs,
  roleName,
}: {
  jobs: (JobWithCompany | Job)[]
  roleName: string
}) {
  if (!jobs.length) return null
  const jsonLd = buildItemListJsonLd({
    name: 'High-paying jobs on Six Figure Jobs',
    jobs: jobs.slice(0, 10),
    page: 1,
    pageSize: 10,
  })

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export default async function SalaryRolePage(props: PageProps) {
  const { role } = await props.params
  const sp = await resolveSearchParams(props.searchParams)
  const roleSlug = resolveCanonicalRoleOrRedirect(role)
  const roleName = prettyRole(roleSlug)
  const page = parsePage(sp)
  const basePath = `/salary/${roleSlug}`
  const bandSlug = typeof sp.band === 'string' ? sp.band : undefined
  const minAnnual =
    bandSlug && BAND_MAP[bandSlug] ? BAND_MAP[bandSlug] : 100_000
  const bandLabel =
    minAnnual >= 400_000
      ? '$400k+'
      : minAnnual >= 300_000
      ? '$300k+'
      : minAnnual >= 200_000
      ? '$200k+'
      : '$100k+'

  // Live salary data for this role: the same filter as the job list below, so the numbers and the list agree.
  const guide = await loadRoleSalaryGuide(roleSlug, minAnnual)
  const totalListings = guide.listings
  const allowIndex = totalListings >= 1

  // Jobs list for this role (live $100k+)
  const data = await queryJobs({
    roleSlugs: [roleSlug],
    minAnnual,
    page,
    pageSize: PAGE_SIZE,
  })

  const jobs = data.jobs as JobWithCompany[]
  const totalPages =
    data.total > 0
      ? Math.max(1, Math.ceil(data.total / PAGE_SIZE))
      : 1

  const siteUrl = SITE_URL
  const guideArgs = { roleName, bandLabel, guide }
  const takeaways = buildTakeaways(guideArgs)
  const faqs = buildFaqs(guideArgs)
  const jsonLd = buildGuideJsonLd({ ...guideArgs, siteUrl, roleSlug, onetCode: ONET_CODES[roleSlug], faqs })

  return (
    <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-12 pt-10">
      <StructuredData jobs={jobs} roleName={roleName} />
      {jsonLd.map((obj, i) => (
        <script
          key={String(obj['@type']) + i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
        />
      ))}
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-4 text-xs text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link
              href="/"
              className="hover:text-foreground hover:underline"
            >
              Home
            </Link>
          </li>
          <li className="px-1 text-muted-foreground">/</li>
          <li>
            <Link
              href="/jobs/100k-plus"
              className="hover:text-foreground hover:underline"
            >
              $100k+ jobs
            </Link>
          </li>
          <li className="px-1 text-muted-foreground">/</li>
          <li aria-current="page" className="text-foreground">
            {roleName} salary
          </li>
        </ol>
      </nav>

      <div className="mb-8">
        <PageHero
          eyebrow="Salary guide"
          title={`${roleName} salary guide`}
          description={`Salary data for ${roleName} roles paying ${bandLabel} or more, taken from the pay ranges employers publish in their own job listings.`}
          helper={
            guide.asOf ? (
              <>
                Updated <time dateTime={guide.asOf.toISOString()}>{formatGuideDate(guide.asOf)}</time> ·{' '}
                {totalListings.toLocaleString('en-US')} live {bandLabel} listings
              </>
            ) : (
              'Based on live job listings, updated daily.'
            )
          }
          actions={
            <>
              {[100_000, 200_000, 300_000, 400_000].map((band) => {
                const href =
                  band === 100_000 ? basePath : `${basePath}?band=${band / 1000}k-plus`
                const label = getBandLabel(band)
                return (
                  <Link
                    key={band}
                    href={href}
                    className={`max-md:inline-flex max-md:min-h-11 max-md:items-center rounded-full border px-3 py-1.5 text-xs ${
                      minAnnual === band
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : 'border-border bg-card text-foreground hover:border-foreground/40'
                    }`}
                  >
                    {label} band
                  </Link>
                )
              })}
              <Link
                href={`/jobs/${roleSlug}`}
                className="max-md:inline-flex max-md:min-h-11 max-md:items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-foreground/40"
              >
                Browse live {roleName} jobs
              </Link>
            </>
          }
        />

        <section data-speakable="summary" aria-labelledby="key-takeaways" className="mt-8">
          <h2 id="key-takeaways" className="text-lg font-semibold tracking-tight text-foreground">
            Key Takeaways
          </h2>
          <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground">
            {takeaways.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <div className="mt-6">
          <PageStatGrid
            items={[
              {
                label: 'Median base salary',
                value: guide.usd ? `${formatPay(guide.usd.median)}/yr` : 'Not enough data yet',
                hint: 'Median of listing midpoints, USD listings only.',
              },
              {
                label: 'Middle half of listings',
                value: guide.usd ? `${formatPay(guide.usd.p25)} to ${formatPay(guide.usd.p75)}/yr` : 'Not enough data yet',
                hint: '25th to 75th percentile.',
              },
              {
                label: 'Listings counted',
                value: (guide.usd?.count ?? 0).toLocaleString('en-US'),
                hint: `Live USD listings paying ${bandLabel}.`,
              },
              {
                label: 'Countries with data',
                value: guide.countries.length.toLocaleString('en-US'),
                hint: 'Countries with at least 5 listings.',
              },
            ]}
          />
        </div>
      </div>

      <RoleSalarySections roleName={roleName} bandLabel={bandLabel} guide={guide} />

      <PageSection
        title="Explore related high-paying pages"
        description="Move from pay benchmarking into live openings, remote filters, and more specific role/location views."
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-primary">
          <li>
            <Link
              href={`/jobs/${roleSlug}`}
              className="hover:underline"
            >
              Live {roleName} jobs →
            </Link>
          </li>
          <li>
            <Link
              href={`/remote/${roleSlug}`}
              className="hover:underline"
            >
              Remote {roleName} jobs (filter by region) →
            </Link>
          </li>
          <li>
            <Link
              href={`/jobs/${roleSlug}`}
              className="hover:underline"
            >
              All $100k+ {roleName} jobs →
            </Link>
          </li>
          {guide.countries.length > 0 ? (
            <li>
              <Link href={`/jobs/${roleSlug}`} className="hover:underline">
                Browse live {roleName} jobs by location →
              </Link>
            </li>
          ) : null}
        </ul>
      </PageSection>

      {/* Job list */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
          {roleName} job openings ({bandLabel})
        </h2>
        {!allowIndex && (
          <p className="text-xs text-amber-300">
            We’ll index this page once more live $100k+ {roleName.toLowerCase()} jobs are available. Check back soon.
          </p>
        )}

        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No live $100k+ jobs for this role yet. Check back soon — new
            roles are imported from ATS job boards regularly.
          </p>
        ) : (
          <>
            <JobList jobs={jobs} />

            {totalPages > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-6 flex items-center justify-between gap-3 text-xs"
              >
                <div className="text-muted-foreground">
                  Page{' '}
                  <span className="font-semibold text-foreground">
                    {page}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-foreground">
                    {totalPages}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {page > 1 && (
                    <Link
                      href={buildPageHref(
                        basePath,
                        sp,
                        page - 1,
                      )}
                      className="max-md:inline-flex max-md:min-h-11 max-md:items-center rounded-lg border border-border bg-card px-3 py-1.5 text-foreground hover:border-border hover:bg-card"
                    >
                      Previous
                    </Link>
                  )}

                  {page < totalPages && (
                    <Link
                      href={buildPageHref(
                        basePath,
                        sp,
                        page + 1,
                      )}
                      className="max-md:inline-flex max-md:min-h-11 max-md:items-center rounded-lg border border-border bg-card px-3 py-1.5 text-foreground hover:border-border hover:bg-card"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </nav>
            )}
          </>
        )}
      </section>

      <PageSection
        title={`How is this ${roleName} salary data calculated?`}
        description="The figures are computed from live job listings, not from surveys."
      >
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground">
          <li>
            <strong>Source:</strong> the salary ranges employers publish in their own job listings, collected from company
            career pages and applicant-tracking systems.
          </li>
          <li>
            <strong>Method:</strong> each listing counts once, at the midpoint of its range. Headline figures use USD
            listings only, and the median is the middle value, not an average.
          </li>
          <li>
            <strong>Coverage:</strong> only listings paying {bandLabel} or more are included, so the data does not
            describe all {roleName} pay. Listings that publish no salary are not counted.
          </li>
          <li>
            <strong>Freshness:</strong> closed and stale listings are removed, and the figures are recalculated as the
            listings change.
          </li>
        </ul>
      </PageSection>

      <PageSection title="Frequently asked questions">
        <div className="max-w-3xl space-y-5">
          {faqs.map((f) => (
            <div key={f.question}>
              <h3 className="text-base font-semibold text-foreground">{f.question}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{f.answer}</p>
            </div>
          ))}
        </div>
      </PageSection>
    </main>
  )
}
