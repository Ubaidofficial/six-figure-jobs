import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CITY_TARGETS } from '../../../../lib/seo/pseoTargets'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type Params = Promise<{ city: string }>

function resolveCity(slug: string) {
  return CITY_TARGETS.find((c) => c.slug === slug.toLowerCase()) || null
}

function buildBreadcrumbJsonLd(citySlug: string, cityLabel: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${SITE_URL}/jobs/100k-plus` },
      { '@type': 'ListItem', position: 3, name: `${cityLabel} jobs`, item: `${SITE_URL}/jobs/city/${citySlug}` },
    ],
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { city } = await params
  const resolved = resolveCity(city)
  if (!resolved) notFound()

  const { total } = await queryJobs({
    citySlug: resolved.slug,
    countryCode: resolved.countryCode,
    minAnnual: 100_000,
    page: 1,
    pageSize: 1,
  })

  const allowIndex = total >= 3
  const titleBase = `$100k+ jobs in ${resolved.label}`
  const title =
    total > 0
      ? `${titleBase} (${total.toLocaleString()} openings) | ${SITE_NAME}`
      : `${titleBase} | ${SITE_NAME}`
  const description = `$100k jobs ${resolved.label}, ${resolved.label} $100k jobs, high paying jobs ${resolved.label}, six figure ${resolved.label} jobs. ${total.toLocaleString()} roles with salary transparency.`
  const canonical = `${SITE_URL}/jobs/city/${resolved.slug}`

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

export default async function CityPage({ params }: { params: Params }) {
  const { city } = await params
  const resolved = resolveCity(city)
  if (!resolved) notFound()

  const { jobs, total, totalPages, page } = await queryJobs({
    citySlug: resolved.slug,
    countryCode: resolved.countryCode,
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

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(resolved.slug, resolved.label)
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
        name: `How many $100k+ jobs are in ${resolved.label}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${total.toLocaleString()} live roles meet the $100k+ bar in ${resolved.label}, updated frequently from company ATS feeds.`,
        },
      },
      {
        '@type': 'Question',
        name: `What is the salary range for ${resolved.label} $100k+ jobs?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'All listings are $100k+; senior roles can exceed $200k-$300k depending on level, company, and remote eligibility.',
        },
      },
      {
        '@type': 'Question',
        name: `Do ${resolved.label} jobs include remote options?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Many roles are remote or hybrid; check each listing for eligibility and onsite expectations.',
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
          <li>{resolved.label}</li>
        </ol>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-slate-50">
        {resolved.label} $100k+ jobs ({total.toLocaleString()})
      </h1>
      <p className="mb-4 text-sm text-slate-300">
        Find <strong className="text-white">{total.toLocaleString()}</strong>{' '}
        <strong className="text-white">high paying</strong>{' '}
        <strong className="text-green-500">$100k</strong> jobs in {resolved.label}{' '}
        with verified{' '}
        <strong className="text-green-500">six figure salaries</strong>. Browse{' '}
        <strong className="text-green-500">$100k+</strong> roles from $
        {salaryMin.toLocaleString()} to ${salaryMax.toLocaleString()} across
        remote, hybrid, and on-site teams.
      </p>
      <p className="mb-6 text-xs text-slate-400">
        Showing page {page} of {totalPages}. Only verified compensation and mid-to-senior roles are listed.
      </p>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">No $100k+ roles in {resolved.label} yet. New postings land daily.</p>
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
