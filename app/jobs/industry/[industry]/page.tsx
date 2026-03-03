import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { INDUSTRY_TARGETS } from '../../../../lib/seo/pseoTargets'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type Params = Promise<{ industry: string }>

function resolveIndustry(slug: string) {
  return INDUSTRY_TARGETS.find((s) => s.slug === slug.toLowerCase()) || null
}

function buildBreadcrumbJsonLd(industrySlug: string, industryLabel: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${SITE_URL}/jobs/100k-plus` },
      { '@type': 'ListItem', position: 3, name: `${industryLabel} jobs`, item: `${SITE_URL}/jobs/industry/${industrySlug}` },
    ],
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { industry } = await params
  const resolved = resolveIndustry(industry)
  if (!resolved) notFound()

  const { total } = await queryJobs({
    industry: resolved.label,
    isHundredKLocal: true,
    page: 1,
    pageSize: 1,
  })

  const allowIndex = total >= 3
  const titleBase = `$100k+ ${resolved.label} jobs`
  const title =
    total > 0
      ? `${titleBase} (${total.toLocaleString()} openings) | ${SITE_NAME}`
      : `${titleBase} | ${SITE_NAME}`
  const description = `Discover ${resolved.label} $100k jobs and high paying ${resolved.label} roles. ${total.toLocaleString()} six figure ${resolved.label.toLowerCase()} jobs with verified pay, updated often.`
  const canonical = `${SITE_URL}/jobs/industry/${resolved.slug}`

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

export default async function IndustryPage({ params }: { params: Params }) {
  const { industry } = await params
  const resolved = resolveIndustry(industry)
  if (!resolved) notFound()

  const { jobs, total, totalPages, page } = await queryJobs({
    industry: resolved.label,
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

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(resolved.slug, resolved.label)
  const itemListJsonLd = buildSafeItemListJsonLd({
    name: 'High-paying jobs on Six Figure Jobs',
    jobs: (jobs as JobWithCompany[]).slice(0, PAGE_SIZE),
    page: 1,
    pageSize: PAGE_SIZE,
  })

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
        Browse <strong className="text-white">{total.toLocaleString()}</strong>{' '}
        <strong className="text-white">high paying</strong>{' '}
        <strong className="text-green-500">$100k</strong> jobs in {resolved.label}{' '}
        with verified{' '}
        <strong className="text-green-500">six figure salaries</strong>. Explore{' '}
        <strong className="text-green-500">$100k+</strong> roles from $
        {salaryMin.toLocaleString()} to ${salaryMax.toLocaleString()} across
        remote, hybrid, and on-site teams.
      </p>
      <p className="mb-6 text-xs text-slate-400">
        Showing page {page} of {totalPages}. Only verified compensation and senior-friendly roles surface here.
      </p>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">No $100k+ {resolved.label} roles yet. Check back soon.</p>
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
    </main>
  )
}
