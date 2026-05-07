import type { Metadata } from 'next'
import Link from 'next/link'
import { buildRuntimeFallbackMetadata, logRuntimeFallback } from '@/lib/runtime/fallback'
import { getSiteUrl, SITE_NAME } from '@/lib/seo/site'
import {
  loadEligibleCompaniesDirectory,
  type PublicCompanyDirectoryEntry,
} from '@/lib/jobs/publicStats'
import { CompanySearch } from '@/components/companies/CompanySearch'

export const revalidate = 600 // 10m
export const dynamic = 'force-dynamic'
const SITE_URL = getSiteUrl()

function buildCompaniesDescription(totalCompanies: number, totalEligibleJobs: number) {
  if (totalCompanies > 0) {
    return `Explore ${totalCompanies.toLocaleString()} companies hiring for ${totalEligibleJobs.toLocaleString()} verified $100k+ jobs, six figure roles, remote jobs, and high paying positions with direct apply links.`
  }

  return 'Explore companies hiring for verified $100k+ jobs, six figure roles, remote jobs, and high paying positions with direct apply links.'
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
    const robots =
      totalCompanies > 0
        ? { index: true, follow: true }
        : { index: false, follow: true }

    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}/companies` },
      robots,
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

export default async function CompaniesPage() {
  try {
    const { companies, totalCompanies, totalEligibleJobs } = await loadEligibleCompaniesDirectory()
    const breadcrumbJsonLd = buildBreadcrumbJsonLd()
    const itemListJsonLd = buildCompaniesItemListJsonLd(companies)
    const collectionPageJsonLd = buildCompaniesCollectionPageJsonLd(
      totalCompanies,
      totalEligibleJobs,
    )

    return (
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-10">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-50">
            Companies hiring $100k+ roles
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            {companies.length > 0
              ? `Browse ${totalCompanies.toLocaleString()} companies hiring for ${totalEligibleJobs.toLocaleString()} live $100k+ jobs, six figure roles, remote jobs, and high paying positions with direct apply links.`
              : 'Only companies with live high-paying roles, verified salary signals, and direct apply links.'}
          </p>
          {totalCompanies > companies.length && (
            <p className="mt-2 text-xs text-slate-500">
              Showing the first {companies.length.toLocaleString()} companies alphabetically.
            </p>
          )}
        </header>

        {companies.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center">
            <p className="text-slate-400">No companies found yet. Try again soon — listings update frequently.</p>
          </div>
        ) : (
          <>
            <section className="mb-8 rounded-xl border border-slate-800 bg-slate-950/50 p-5">
              <h2 className="text-sm font-semibold text-slate-50">
                Find companies with verified six figure jobs
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                This company directory groups employers with live $100k+ job openings,
                published salary ranges where available, and direct apply paths to company
                career pages. Use it to compare companies hiring for remote, hybrid, and
                on-site six figure jobs across engineering, product, data, sales, finance,
                marketing, operations, and leadership roles.
              </p>
            </section>

            <CompanySearch companies={companies} />
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
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-50">
            Companies hiring $100k+ roles
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Company profiles are temporarily unavailable while the production database reconnects.
          </p>
        </header>

        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center">
          <p className="text-slate-300">
            Browse the live job hubs while company data comes back online.
          </p>
          <div className="mt-4 flex justify-center gap-3 text-sm">
            <Link href="/jobs" className="rounded-full border border-slate-700 px-4 py-2 text-slate-100">
              Browse jobs
            </Link>
            <Link href="/salary" className="rounded-full border border-slate-700 px-4 py-2 text-slate-100">
              Salary guides
            </Link>
          </div>
        </div>
      </main>
    )
  }
}
