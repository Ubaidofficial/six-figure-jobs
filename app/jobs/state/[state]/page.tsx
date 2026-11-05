import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 3600

import { STATE_TARGETS } from '../../../../lib/seo/pseoTargets'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'
import { isPhaseIndexable } from '../../../../lib/seo/indexingPhase'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type Params = Promise<{ state: string }>

function resolveState(slug: string) {
  return STATE_TARGETS.find((s) => s.slug === slug.toLowerCase()) || null
}

function buildBreadcrumbJsonLd(stateSlug: string, stateName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${SITE_URL}/jobs/100k-plus` },
      { '@type': 'ListItem', position: 3, name: `${stateName} jobs`, item: `${SITE_URL}/jobs/state/${stateSlug}` },
    ],
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { state } = await params
  const resolved = resolveState(state)
  if (!resolved) notFound()

  const { total } = await queryJobs({
    stateCode: resolved.code,
    isHundredKLocal: true,
    page: 1,
    pageSize: 1,
  })

  // State pages aren't in the Phase 1 allowlist — noindex until phase 2.
  const allowIndex =
    total >= 1 && isPhaseIndexable({ pathname: `/jobs/state/${resolved.slug}` })
  const titleBase = `$100k+ ${resolved.name} jobs`
  const title =
    total > 0
      ? `${titleBase} (${total.toLocaleString()} openings) | ${SITE_NAME}`
      : `${titleBase} | ${SITE_NAME}`
  const description = `${total.toLocaleString()} $100k+ jobs in ${resolved.name} — salary shown upfront, with links to apply. No entry-level noise. Six-figure ${resolved.name.toLowerCase()} roles refreshed daily from company career pages.`
  const canonical = `${SITE_URL}/jobs/state/${resolved.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
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

export default async function StatePage({ params }: { params: Params }) {
  const { state } = await params
  const resolved = resolveState(state)
  if (!resolved) notFound()

  const { jobs, total, totalPages, page } = await queryJobs({
    stateCode: resolved.code,
    isHundredKLocal: true,
    page: 1,
    pageSize: PAGE_SIZE,
  })

  const minAnnualValues = jobs
    .map((j) => (j.minAnnual != null ? Number(j.minAnnual) : null))
    .filter((v): v is number => v != null && v > 0)
  const maxAnnualValues = jobs
    .map((j) => (j.maxAnnual != null ? Number(j.maxAnnual) : null))
    .filter((v): v is number => v != null && v > 0)

  const salaryMin =
    minAnnualValues.length > 0 ? Math.min(...minAnnualValues) : 100_000
  const salaryMax =
    maxAnnualValues.length > 0
      ? Math.max(...maxAnnualValues)
      : Math.max(salaryMin, 200_000)

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(resolved.slug, resolved.name)
  const itemListJsonLd = buildSafeItemListJsonLd({
    name: 'High-paying jobs on Six Figure Jobs',
    jobs: (jobs as JobWithCompany[]).slice(0, PAGE_SIZE),
    page: 1,
    pageSize: PAGE_SIZE,
  })
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How many $100k+ jobs are in ${resolved.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${total.toLocaleString()} live roles meet the $100k+ bar in ${resolved.name}, from company career pages.`,
        },
      },
      {
        '@type': 'Question',
        name: `What is the salary range for ${resolved.name} $100k+ jobs?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'All listings are $100k+; senior roles often exceed $200k-$300k depending on level, company, and location flexibility.',
        },
      },
      {
        '@type': 'Question',
        name: `Do these ${resolved.name} jobs include remote options?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Many roles are remote or hybrid; check each listing for eligibility and onsite expectations.',
        },
      },
    ],
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
        <ol className="flex items-center gap-1">
          <li><Link href="/">Home</Link></li>
          <li className="px-1">/</li>
          <li><Link href="/jobs/100k-plus">Jobs</Link></li>
          <li className="px-1">/</li>
          <li>{resolved.name}</li>
        </ol>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-foreground">
        {resolved.name} $100k+ jobs ({total.toLocaleString()})
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Find <strong className="text-foreground">{total.toLocaleString()}</strong>{' '}
        <strong className="text-foreground">high paying</strong>{' '}
        <strong className="text-primary">$100k</strong> jobs in {resolved.name}{' '}
        with verified{' '}
        <strong className="text-primary">six figure salaries</strong>. Browse{' '}
        <strong className="text-primary">$100k+</strong> roles from $
        {salaryMin.toLocaleString()} to ${salaryMax.toLocaleString()} across
        remote, hybrid, and on-site teams.
      </p>
      <p className="mb-6 text-xs text-muted-foreground">
        Showing page {page} of {totalPages}. Remote, hybrid, and on-site roles included; only mid-level and above, filtered for verified compensation.
      </p>

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No $100k+ {resolved.name} jobs yet. Check back soon.</p>
      ) : (
        <JobList jobs={jobs as JobWithCompany[]} />
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </main>
  )
}
