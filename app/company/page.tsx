// app/company/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '../../lib/prisma'

export const revalidate = 300

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

const PAGE_SIZE = 40

export const metadata: Metadata = {
  title: 'Top companies hiring $100k+ roles | Remote100k',
  description:
    'Browse companies that are actively hiring for remote, hybrid, and on-site jobs paying $100k+ on Remote100k.',
  alternates: {
    canonical: `${SITE_URL}/company`,
  },
  openGraph: {
    title: 'Top companies hiring $100k+ roles | Remote100k',
    description:
      'Directory of companies currently hiring for jobs paying $100k+.',
    url: `${SITE_URL}/company`,
    siteName: 'Remote100k',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Top companies hiring $100k+ roles | Remote100k',
    description:
      'See companies hiring for $100k+ remote, hybrid, and on-site jobs.',
  },
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type SearchParams = Record<string, string | string[] | undefined>

async function resolveSearchParams(
  searchParams: SearchParams | Promise<SearchParams> | undefined
): Promise<SearchParams> {
  if (!searchParams) return {}
  if (typeof (searchParams as any).then === 'function') {
    return (searchParams as Promise<SearchParams>)
  }
  return searchParams as SearchParams
}

function parsePage(searchParams?: SearchParams) {
  const raw = (searchParams?.page ?? '1') as string
  const page = Number(raw || '1') || 1
  return Math.max(1, page)
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

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>
}

export default async function CompanyIndexPage({ searchParams }: PageProps) {
  const sp = await resolveSearchParams(searchParams)
  const page = parsePage(sp)
  const skip = (page - 1) * PAGE_SIZE

  // Grab a page of companies (alphabetical) + total count
  const [companiesPage, totalCompanies] = await Promise.all([
    prisma.company.findMany({
      orderBy: { name: 'asc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.company.count(),
  ])

  // For each company on this page, count $100k+ jobs
  const companiesWithCounts = await Promise.all(
    // Explicitly typed as any to fix build error
    companiesPage.map(async (company: any) => {
      const jobCount = await prisma.job.count({
        where: {
          companyId: company.id,
          isExpired: false,
          OR: [
            { maxAnnual: { gte: BigInt(100_000) } },
            { minAnnual: { gte: BigInt(100_000) } },
            { isHundredKLocal: true },
          ],
        },
      })

      return { company, jobCount }
    })
  )

  // Only show companies with at least one qualifying job
  const items = companiesWithCounts.filter((x) => x.jobCount > 0)

  const totalPages =
    totalCompanies > 0
      ? Math.max(1, Math.ceil(totalCompanies / PAGE_SIZE))
      : 1

  const basePath = '/company'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Companies hiring $100k+ roles',
    numberOfItems: totalCompanies,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: (page - 1) * PAGE_SIZE + index + 1,
      item: {
        '@type': 'Organization',
        name: item.company.name,
        url: `${SITE_URL}/company/${item.company.slug}`,
        logo: item.company.logoUrl || undefined,
        sameAs: item.company.website || undefined,
      },
    })),
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      {/* -------------------------------- Breadcrumbs -------------------------------- */}
      <nav
        aria-label="Breadcrumb"
        className="mb-4 text-xs text-slate-400"
      >
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link
              href="/"
              className="hover:text-slate-200 hover:underline"
            >
              Home
            </Link>
          </li>
          <li className="px-1 text-slate-600">/</li>
          <li aria-current="page" className="text-slate-200">
            Companies
          </li>
        </ol>
      </nav>

      {/* --------------------------------- Header ---------------------------------- */}
      <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">
            Companies hiring $100k+ roles
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            A curated directory of companies currently posting jobs with
            estimated total compensation of $100k+.
          </p>
        </div>

        {totalCompanies > 0 && (
          <p className="text-xs text-slate-400">
            Showing{' '}
            <span className="font-semibold text-slate-100">
              {Math.min(
                (page - 1) * PAGE_SIZE + 1,
                totalCompanies
              )}
            </span>{' '}
            –{' '}
            <span className="font-semibold text-slate-100">
              {Math.min(page * PAGE_SIZE, totalCompanies)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-slate-100">
              {totalCompanies.toLocaleString()}
            </span>{' '}
            companies
          </p>
        )}
      </header>

      {/* ------------------------------ Company grid ------------------------------- */}
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">
          No companies with live $100k+ roles right now. Check back soon.
        </p>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {items.map(({ company, jobCount }) => (
            <Link
              key={company.id}
              href={`/company/${company.slug}`}
              className="group flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 transition hover:border-slate-600 hover:bg-slate-900"
            >
              <div className="flex-shrink-0">
                {company.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.logoUrl}
                    alt={company.name}
                    className="h-12 w-12 rounded-xl bg-slate-900 object-contain"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-base font-semibold text-slate-100">
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-slate-50 group-hover:text-slate-100">
                  {company.name}
                </h2>

                {company.website && (
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {company.website.replace(/^https?:\/\//, '')}
                  </p>
                )}

                <p className="mt-2 text-xs text-slate-300">
                  <span className="font-semibold text-slate-100">
                    {jobCount.toLocaleString()}
                  </span>{' '}
                  open $100k+ role{jobCount === 1 ? '' : 's'}
                </p>
              </div>

              <div className="flex-shrink-0 text-xs text-slate-500 group-hover:text-slate-300">
                View jobs →
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* ------------------------------- Pagination ------------------------------- */}
      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-between gap-3 text-xs"
        >
          <div className="text-slate-400">
            Page{' '}
            <span className="font-semibold text-slate-100">{page}</span>{' '}
            of{' '}
            <span className="font-semibold text-slate-100">
              {totalPages}
            </span>
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

      {/* ------------------------------- JSON-LD -------------------------------- */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />
    </main>
  )
}