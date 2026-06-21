import type { Metadata } from 'next'
import Link from 'next/link'
import { buildRuntimeFallbackMetadata, logRuntimeFallback } from '@/lib/runtime/fallback'
import { getSiteUrl, SITE_NAME } from '@/lib/seo/site'
import {
  loadEligibleCompaniesDirectory,
  type PublicCompanyDirectoryEntry,
} from '@/lib/jobs/publicStats'
import { CompanySearch } from '@/components/companies/CompanySearch'
import { getCompanyPublishingManifest } from '@/lib/seo/companyPublishing'
import { getPriorityCompanyRank } from '@/lib/seo/priorityCompanies'
import { PageHero, PageSection, PageStatGrid } from '@/components/seo/PageChrome'

export const revalidate = 600 // 10m ISR
const SITE_URL = getSiteUrl()

// Server-side pagination so Google can crawl past page 1. Previously the page
// rendered the entire directory in one shot — long tail companies were
// effectively orphaned (only reachable through client-side CompanySearch,
// which Googlebot can't see).
const COMPANIES_PAGE_SIZE = 48

function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.floor(n)
}

function buildCompaniesPageHref(page: number): string {
  return page <= 1 ? '/companies' : `/companies?page=${page}`
}

function buildCompaniesDescription(totalCompanies: number, totalEligibleJobs: number) {
  if (totalCompanies > 0) {
    return `Browse ${totalCompanies.toLocaleString()} companies actively hiring for ${totalEligibleJobs.toLocaleString()} verified $100k+ tech jobs. Find six-figure roles at top startups, FAANG, and high-growth companies with direct apply links.`
  }

  return 'Browse companies actively hiring for verified $100k+ tech jobs. Find six-figure roles at top startups, FAANG, and high-growth companies with direct apply links.'
}

function buildBreadcrumbJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Companies', item: `${SITE_URL}/companies` },
    ],
  }
}

function buildCompaniesItemListJsonLd(companies: PublicCompanyDirectoryEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Companies hiring $100k+ roles',
    numberOfItems: companies.length,
    itemListElement: companies
      .filter((company) => company.slug)
      .map((company, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Organization',
          name: company.name || 'Company',
          url: `${SITE_URL}/company/${company.slug}`,
          ...(company.logoUrl ? { logo: company.logoUrl } : {}),
        },
      })),
  }
}

function buildCompaniesCollectionPageJsonLd(totalCompanies: number, totalEligibleJobs: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Companies hiring $100k+ roles',
    description: buildCompaniesDescription(totalCompanies, totalEligibleJobs),
    url: `${SITE_URL}/companies`,
    about: [
      'companies hiring $100k+ jobs',
      'six figure jobs by company',
      'remote jobs by company',
      'high paying jobs',
      'verified salary ranges',
    ],
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { totalCompanies, totalEligibleJobs } = await loadEligibleCompaniesDirectory()
    const title =
      totalCompanies > 0
        ? `${totalCompanies.toLocaleString()} Companies Hiring $100k+ Roles | ${SITE_NAME}`
        : `Companies hiring $100k+ roles | ${SITE_NAME}`
    const description = buildCompaniesDescription(totalCompanies, totalEligibleJobs)
    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}/companies` },
      robots: { index: true, follow: true },
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/companies`,
        siteName: SITE_NAME,
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    }
  } catch {
    return buildRuntimeFallbackMetadata({
      canonicalPath: '/companies',
      title: `Companies temporarily unavailable | ${SITE_NAME}`,
      description:
        'The companies directory is temporarily unavailable while the production database reconnects.',
    })
  }
}

type CompaniesPageProps = {
  searchParams?: Promise<{ page?: string | string[] }>
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  try {
    const sp = (await searchParams) || {}
    const requestedPage = parsePageParam(sp.page)
    const [{ companies, totalCompanies, totalEligibleJobs }, manifest] = await Promise.all([
      loadEligibleCompaniesDirectory(),
      getCompanyPublishingManifest(),
    ])
    const manifestBySlug = new Map(
      manifest.candidates.map((candidate) => [candidate.slug, candidate] as const),
    )
    const orderedCompanies = [...companies].sort((a, b) => {
      const aCandidate = a.slug ? manifestBySlug.get(a.slug) : null
      const bCandidate = b.slug ? manifestBySlug.get(b.slug) : null
      const aUnlocked = aCandidate?.unlocked ? 1 : 0
      const bUnlocked = bCandidate?.unlocked ? 1 : 0
      if (aUnlocked !== bUnlocked) return bUnlocked - aUnlocked

      const aPriority = getPriorityCompanyRank(a.slug)
      const bPriority = getPriorityCompanyRank(b.slug)
      if ((aPriority ?? Infinity) !== (bPriority ?? Infinity)) {
        return (aPriority ?? Infinity) - (bPriority ?? Infinity)
      }

      const aJobs = aCandidate?.liveJobs ?? a._count.jobs ?? 0
      const bJobs = bCandidate?.liveJobs ?? b._count.jobs ?? 0
      if (bJobs !== aJobs) return bJobs - aJobs

      return (a.name ?? '').localeCompare(b.name ?? '')
    })

    const featuredCompanies = orderedCompanies
      .filter((company) => {
        const candidate = company.slug ? manifestBySlug.get(company.slug) : null
        return Boolean(candidate?.unlocked)
      })
      .slice(0, 12)

    // Pagination — clamp the requested page to a real one, then slice the
    // ordered directory so each page renders a distinct 48-company window.
    const totalPages = Math.max(1, Math.ceil(orderedCompanies.length / COMPANIES_PAGE_SIZE))
    const currentPage = Math.min(requestedPage, totalPages)
    const pageStart = (currentPage - 1) * COMPANIES_PAGE_SIZE
    const pagedCompanies = orderedCompanies.slice(pageStart, pageStart + COMPANIES_PAGE_SIZE)

    const breadcrumbJsonLd = buildBreadcrumbJsonLd()
    // ItemList describes the visible page so /companies?page=2 isn't a duplicate
    // signal of page 1 to Google.
    const itemListJsonLd = buildCompaniesItemListJsonLd(pagedCompanies)
    const collectionPageJsonLd = buildCompaniesCollectionPageJsonLd(
      totalCompanies,
      totalEligibleJobs,
    )

    return (
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-10">
        <div className="mb-8">
          <PageHero
            eyebrow="Company directory"
            title="Companies hiring $100k+ roles"
            description={
              companies.length > 0
                ? `Browse ${totalCompanies.toLocaleString()} companies hiring for ${totalEligibleJobs.toLocaleString()} live $100k+ jobs, six figure roles, remote jobs, and high paying positions with direct apply links.`
                : 'Only companies with live high-paying roles, verified salary signals, and direct apply links.'
            }
            helper={
              totalCompanies > orderedCompanies.length
                ? `Showing the first ${orderedCompanies.length.toLocaleString()} companies with priority company hubs first.`
                : 'Open a company page first, then narrow into salary bands, roles, and locations.'
            }
            actions={
              <>
                <Link
                  href="/jobs"
                  className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs text-neutral-200 hover:border-neutral-500"
                >
                  Browse all jobs
                </Link>
                <Link
                  href="/salary"
                  className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs text-neutral-200 hover:border-neutral-500"
                >
                  Salary guides
                </Link>
              </>
            }
          >
            <PageStatGrid
              items={[
                {
                  label: 'Companies',
                  value: totalCompanies.toLocaleString(),
                  hint: 'Employers with live eligible six-figure roles',
                },
                {
                  label: 'Live $100k+ jobs',
                  value: totalEligibleJobs.toLocaleString(),
                  hint: 'Current inventory across the company directory',
                },
                {
                  label: 'Priority hubs',
                  value: featuredCompanies.length.toLocaleString(),
                  hint: 'Highest-quality company pages surfaced first',
                },
                {
                  label: 'Primary workflow',
                  value: 'Company → role',
                  hint: 'Open a company, then narrow by role and location',
                },
              ]}
            />
          </PageHero>
        </div>

        {orderedCompanies.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-8 text-center">
            <p className="text-neutral-400">No companies found yet. Try again soon — listings update frequently.</p>
          </div>
        ) : (
          <>
            {featuredCompanies.length > 0 && (
              <PageSection
                title="Priority company pages to start with"
                description="These company pages have enough live jobs, salary support, and content depth to be worth crawling repeatedly. They are the main company hubs we are deliberately pushing first."
              >
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {featuredCompanies.map((company) => {
                    const candidate = company.slug ? manifestBySlug.get(company.slug) : null
                    if (!company.slug || !candidate) return null
                    return (
                      <Link
                        key={company.id}
                        href={`/company/${company.slug}`}
                        className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4 transition-colors hover:border-neutral-600"
                      >
                        <div className="text-sm font-semibold text-neutral-100">{company.name}</div>
                        <div className="mt-2 text-xs text-neutral-400">
                          {candidate.liveJobs.toLocaleString()} live jobs •{' '}
                          {candidate.salaryBackedJobs.toLocaleString()} salary-backed •{' '}
                          {candidate.roleDiversity.toLocaleString()} role groups
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </PageSection>
            )}

            <PageSection
              title="Find companies with verified six figure jobs"
              description="This company directory groups employers with live $100k+ job openings, published salary ranges where available, and direct apply paths to company career pages. Use it to compare companies hiring for remote, hybrid, and on-site six figure jobs across engineering, product, data, sales, finance, marketing, operations, and leadership roles."
            >
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Link href="/jobs" className="rounded-full border border-neutral-700 px-3 py-1.5 text-neutral-200 hover:border-neutral-500">
                  Browse all jobs
                </Link>
                <Link href="/remote" className="rounded-full border border-neutral-700 px-3 py-1.5 text-neutral-200 hover:border-neutral-500">
                  Remote jobs
                </Link>
                <Link href="/salary" className="rounded-full border border-neutral-700 px-3 py-1.5 text-neutral-200 hover:border-neutral-500">
                  Salary guides
                </Link>
              </div>
            </PageSection>

            <CompanySearch companies={pagedCompanies} />

            {totalPages > 1 ? (
              <nav
                aria-label="Companies pagination"
                className="mt-10 flex items-center justify-between gap-3 border-t border-neutral-800 pt-6 text-sm"
              >
                <div className="text-xs text-neutral-400">
                  Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()} • Showing {pagedCompanies.length} of {orderedCompanies.length.toLocaleString()} companies
                </div>
                <div className="flex items-center gap-2">
                  {currentPage > 1 ? (
                    <Link
                      href={buildCompaniesPageHref(currentPage - 1)}
                      rel="prev"
                      className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs text-neutral-200 hover:border-neutral-500"
                    >
                      ← Previous
                    </Link>
                  ) : null}
                  {currentPage < totalPages ? (
                    <Link
                      href={buildCompaniesPageHref(currentPage + 1)}
                      rel="next"
                      className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs text-neutral-200 hover:border-neutral-500"
                    >
                      Next →
                    </Link>
                  ) : null}
                </div>
              </nav>
            ) : null}
          </>
        )}

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
      </main>
    )
  } catch (error) {
    logRuntimeFallback('companies.page', error)
    return (
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-10">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-50">
            Companies hiring $100k+ roles
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
            Company profiles are temporarily unavailable while the production database reconnects.
          </p>
        </header>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-8 text-center">
          <p className="text-neutral-300">
            Browse the live job hubs while company data comes back online.
          </p>
          <div className="mt-4 flex justify-center gap-3 text-sm">
            <Link href="/jobs" className="rounded-full border border-neutral-700 px-4 py-2 text-neutral-100">
              Browse jobs
            </Link>
            <Link href="/salary" className="rounded-full border border-neutral-700 px-4 py-2 text-neutral-100">
              Salary guides
            </Link>
          </div>
        </div>
      </main>
    )
  }
}
