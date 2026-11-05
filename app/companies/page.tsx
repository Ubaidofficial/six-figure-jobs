import type { Metadata } from 'next'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { buildRuntimeFallbackMetadata, logRuntimeFallback, skipPrerenderWhileBuilding } from '@/lib/runtime/fallback'
import { getSiteUrl, SITE_NAME, defaultOgImages } from '@/lib/seo/site'
import {
  loadEligibleCompaniesDirectory,
  type PublicCompanyDirectoryEntry,
} from '@/lib/jobs/publicStats'
import { CompanySearch } from '@/components/companies/CompanySearch'
import { getCompanyPublishingManifest } from '@/lib/seo/companyPublishing'
import { getPriorityCompanyRank } from '@/lib/seo/priorityCompanies'
import { JobRows, ListingHeader, ListingPage, Pagination } from '@/components/listing/ListingParts'

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
    return `Browse ${totalCompanies.toLocaleString()} companies actively hiring for ${totalEligibleJobs.toLocaleString()} $100k+ tech jobs. Find six-figure roles at top startups and high-growth companies, with links to apply.`
  }

  return 'Browse companies actively hiring for $100k+ tech jobs. Find six-figure roles at top startups and high-growth companies, with links to apply.'
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
      openGraph: { images: defaultOgImages(),
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
      <ListingPage>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }} />

        <ListingHeader
          breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Companies' }]}
          title="Companies hiring $100k+ roles"
          summary={
            companies.length > 0 ? (
              <>
                <strong>{totalCompanies.toLocaleString()}</strong> companies with{' '}
                <strong>{totalEligibleJobs.toLocaleString()}</strong> open $100k+ jobs
              </>
            ) : (
              'Companies with open $100k+ jobs will appear here.'
            )
          }
        />

        {orderedCompanies.length === 0 ? (
          <JobRows
            jobs={[]}
            empty={{
              title: 'No companies yet.',
              body: 'Companies appear here once they have an open job above the six-figure threshold.',
              href: '/jobs',
              hrefLabel: 'Browse all jobs',
            }}
          />
        ) : (
          <>
            <CompanySearch companies={pagedCompanies} />
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              hrefFor={(n) => buildCompaniesPageHref(n)}
            />
          </>
        )}
      </ListingPage>
    )
  } catch (error) {
    unstable_rethrow(error)
    logRuntimeFallback('companies.page', error)
    await skipPrerenderWhileBuilding()
    return (
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-10">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Companies hiring $100k+ roles
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Company profiles are temporarily unavailable while the production database reconnects.
          </p>
        </header>

        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Browse the live job hubs while company data comes back online.
          </p>
          <div className="mt-4 flex justify-center gap-3 text-sm">
            <Link href="/jobs" className="rounded-full border border-border px-4 py-2 text-foreground">
              Browse jobs
            </Link>
            <Link href="/salary" className="rounded-full border border-border px-4 py-2 text-foreground">
              Salary guides
            </Link>
          </div>
        </div>
      </main>
    )
  }
}
