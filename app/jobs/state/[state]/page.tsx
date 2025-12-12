import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { STATE_TARGETS } from '../../../../lib/seo/pseoTargets'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'

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

function buildItemListJsonLd(jobs: JobWithCompany[], stateName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `$100k+ jobs in ${stateName}`,
    itemListElement: jobs.slice(0, PAGE_SIZE).map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'JobPosting',
        title: job.title,
        hiringOrganization: {
          '@type': 'Organization',
          name: job.companyRef?.name || job.company,
        },
        jobLocation: job.city
          ? {
              '@type': 'Place',
              address: {
                '@type': 'PostalAddress',
                addressLocality: job.city,
                addressRegion: job.stateCode || undefined,
                addressCountry: job.countryCode || undefined,
              },
            }
          : undefined,
        url: `${SITE_URL}/job/${job.id}`,
      },
    })),
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { state } = await params
  const resolved = resolveState(state)
  if (!resolved) notFound()

  const { total } = await queryJobs({
    stateCode: resolved.code,
    minAnnual: 100_000,
    page: 1,
    pageSize: 1,
  })

  const allowIndex = total >= 3
  const titleBase = `$100k+ ${resolved.name} jobs`
  const title =
    total > 0
      ? `${titleBase} (${total.toLocaleString()} openings) | ${SITE_NAME}`
      : `${titleBase} | ${SITE_NAME}`
  const description = `Find ${total.toLocaleString()} verified $100k ${resolved.name} jobs and six figure ${resolved.name.toLowerCase()} roles. High paying jobs ${resolved.name}, ${resolved.name} $100k jobs, six figure ${resolved.name} jobs updated daily.`
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
    minAnnual: 100_000,
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
  const itemListJsonLd = buildItemListJsonLd(jobs as JobWithCompany[], resolved.name)
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How many $100k+ jobs are in ${resolved.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${total.toLocaleString()} live roles meet the $100k+ bar in ${resolved.name}, refreshed frequently from company ATS feeds.`,
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
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-400">
        <ol className="flex items-center gap-1">
          <li><Link href="/">Home</Link></li>
          <li className="px-1">/</li>
          <li><Link href="/jobs/100k-plus">Jobs</Link></li>
          <li className="px-1">/</li>
          <li>{resolved.name}</li>
        </ol>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-slate-50">
        {resolved.name} $100k+ jobs ({total.toLocaleString()})
      </h1>
      <p className="mb-4 text-sm text-slate-300">
        Find <strong className="text-white">{total.toLocaleString()}</strong>{' '}
        <strong className="text-white">high paying</strong>{' '}
        <strong className="text-green-500">$100k</strong> jobs in {resolved.name}{' '}
        with verified{' '}
        <strong className="text-green-500">six figure salaries</strong>. Browse{' '}
        <strong className="text-green-500">$100k+</strong> roles from $
        {salaryMin.toLocaleString()} to ${salaryMax.toLocaleString()} across
        remote, hybrid, and on-site teams.
      </p>
      <p className="mb-6 text-xs text-slate-400">
        Showing page {page} of {totalPages}. Remote, hybrid, and on-site roles included; only mid-level and above, filtered for verified compensation.
      </p>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">No $100k+ {resolved.name} jobs yet. Check back soon.</p>
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
