import type { Metadata } from 'next'
import { keywordsFor } from '@/lib/seo/keywordMap'
import Link from '@/components/ui/Link'
import { unstable_rethrow } from 'next/navigation'
import { buildRuntimeFallbackMetadata, logRuntimeFallback, skipPrerenderWhileBuilding } from '@/lib/runtime/fallback'
import { getSiteUrl, SITE_NAME, defaultOgImages } from '@/lib/seo/site'
import { buildCompaniesIndexDescription, buildCompaniesIndexTitle } from '@/lib/seo/metaText'
import {
  loadEligibleCompaniesDirectory,
  type PublicCompanyDirectoryEntry,
} from '@/lib/jobs/publicStats'
import { CompanySearch } from '@/components/companies/CompanySearch'
import { getCompanyPublishingManifest } from '@/lib/seo/companyPublishing'
import { getPriorityCompanyRank } from '@/lib/seo/priorityCompanies'
import { MIN_COMPANY_INDEXABLE_JOBS } from '@/lib/seo/indexabilityGates'
import { Faq, JobRows, LinkChips, ListingHeader, ListingPage, ListingSection, Pagination, Prose } from '@/components/listing/ListingParts'
import { loadTopRolePages, topRolesRow } from '@/lib/roles/topRolePages'
import { loadCompanyHiringStats } from '@/lib/jobs/companyHiringStats'

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
    return `Browse ${totalCompanies.toLocaleString()} companies with ${MIN_COMPANY_INDEXABLE_JOBS}+ open $100k+ tech jobs (${totalEligibleJobs.toLocaleString()} jobs between them). Find six-figure roles at top startups and high-growth companies, with links to apply.`
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
    const { totalCompanies, totalEligibleJobs, totalCompaniesHiring } = await loadEligibleCompaniesDirectory()
    const title = buildCompaniesIndexTitle()
    const description = buildCompaniesIndexDescription(
      totalCompanies,
      totalEligibleJobs,
      totalCompaniesHiring,
      MIN_COMPANY_INDEXABLE_JOBS,
    )
    return {
      title,
      description,
      keywords: keywordsFor('companies'),
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
    const [{ companies, totalCompanies, totalEligibleJobs, totalCompaniesHiring, totalJobs }, manifest] = await Promise.all([
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

    // New-this-week and median pay for the companies on this page; a failure only leaves them off the tiles.
    const hiringStats = await loadCompanyHiringStats(pagedCompanies.map((c) => c.id)).catch(() => ({}))

    const topRoles = await loadTopRolePages({})
    // The biggest employers right now, for the text under the grid (live counts, so the page says something specific).
    const largestEmployers = [...companies]
      .filter((c) => c.slug && c.name)
      .sort((a, b) => (b._count.jobs ?? 0) - (a._count.jobs ?? 0))
      .slice(0, 6)
    const faqItems = [
      {
        question: 'How does a company get listed here?',
        answer: `A company appears in this directory once it has at least ${MIN_COMPANY_INDEXABLE_JOBS} open jobs with a published salary of $100k+ (or the local equivalent, such as £75k+ or €80k+). Right now ${totalCompanies.toLocaleString()} companies qualify, and ${totalCompaniesHiring.toLocaleString()} companies have at least one open six-figure job.`,
      },
      {
        question: 'Are the salaries real?',
        answer:
          'Every job listed was posted by the employer with a salary range, and the top of that range reaches the six-figure floor for its currency. Each apply button says where it goes: the company’s own application page or the job board the role was posted on.',
      },
      {
        question: 'How often is this list updated?',
        answer: `Jobs are refreshed every day. Closed jobs and jobs not seen for 7 days are removed, so a company drops out of the directory when it has fewer than ${MIN_COMPANY_INDEXABLE_JOBS} open six-figure jobs.`,
      },
    ]
    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
    }

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
                <strong>{totalCompanies.toLocaleString()}</strong> companies with {MIN_COMPANY_INDEXABLE_JOBS}+ open
                $100k+ jobs, <strong>{totalEligibleJobs.toLocaleString()}</strong> jobs between them. Across the
                whole site: <strong>{totalJobs.toLocaleString()}</strong> open jobs at{' '}
                <strong>{totalCompaniesHiring.toLocaleString()}</strong> companies.
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
            <CompanySearch companies={pagedCompanies} stats={hiringStats} />
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              hrefFor={(n) => buildCompaniesPageHref(n)}
            />
          </>
        )}

        {/* Explanatory text and FAQ on page 1 only, so ?page=N pages do not repeat it. */}
        {currentPage === 1 && orderedCompanies.length > 0 ? (
          <>
            <ListingSection title="About this directory">
              <Prose>
                <p>
                  These are the companies with the most open six-figure jobs on {SITE_NAME}: every one has at least{' '}
                  {MIN_COMPANY_INDEXABLE_JOBS} live roles that publish a salary of $100k+ (or the local equivalent).
                  Between them they have {totalEligibleJobs.toLocaleString()} open jobs. Each company page lists all of
                  its current six-figure openings with the published pay range and a link to apply on the company&apos;s
                  own site.
                </p>
              </Prose>
              {largestEmployers.length > 0 ? (
                <LinkChips
                  label="Largest employers right now"
                  items={largestEmployers.map((c) => ({
                    label: String(c.name),
                    href: `/company/${c.slug}`,
                    count: c._count.jobs,
                  }))}
                />
              ) : null}
            </ListingSection>
            {topRoles.length > 0 ? (
              <ListingSection title="Browse by role">
                <LinkChips label="Top roles" items={topRolesRow('Top roles', topRoles)?.items ?? []} />
              </ListingSection>
            ) : null}
            <ListingSection title="Questions about these companies">
              <Faq items={faqItems} />
            </ListingSection>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
          </>
        ) : null}
      </ListingPage>
    )
  } catch (error) {
    unstable_rethrow(error)
    logRuntimeFallback('companies.page', error)
    await skipPrerenderWhileBuilding()
    return (
      <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-14 pt-10">
        <header className="mb-8">
          <h1 className="text-4xl font-normal tracking-[-0.035em] text-foreground">
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
