import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CITY_TARGETS } from '../../../../../lib/seo/pseoTargets'
import { queryJobs, type JobWithCompany } from '../../../../../lib/jobs/queryJobs'
import JobList from '../../../../components/JobList'
import { getSiteUrl, SITE_NAME } from '../../../../../lib/seo/site'
import { buildItemListJsonLd } from '../../../../../lib/seo/itemListJsonLd'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type Params = Promise<{ role: string; city: string }>

function prettyRole(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function resolveCity(slug: string) {
  return CITY_TARGETS.find((c) => c.slug === slug.toLowerCase()) || null
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { role, city } = await params
  const cityInfo = resolveCity(city)
  if (!cityInfo) notFound()

  const roleName = prettyRole(role)

  const { total } = await queryJobs({
    roleSlugs: [role],
    citySlug: cityInfo.slug,
    minAnnual: 100_000,
    page: 1,
    pageSize: 1,
  })

  if (total === 0) {
    return { title: 'Jobs Not Found | Six Figure Jobs' }
  }

  const title = `Remote/on-site ${roleName} $100k jobs in ${cityInfo.label} | ${total.toLocaleString()} roles | ${SITE_NAME}`
  const description = `${total.toLocaleString()} ${roleName} $100k jobs in ${cityInfo.label}. ${cityInfo.label} $100k ${roleName} jobs, high paying ${roleName} jobs ${cityInfo.label}, six figure ${roleName} roles with verified pay.`
  const canonical = `${SITE_URL}/jobs/${role}/city/${cityInfo.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: SITE_NAME, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    robots: total >= 3 ? { index: true, follow: true } : { index: false, follow: true },
  }
}

export default async function RoleCityPage({ params }: { params: Params }) {
  const { role, city } = await params
  const cityInfo = resolveCity(city)
  if (!cityInfo) notFound()
  const roleName = prettyRole(role)

  const { jobs, total, totalPages, page } = await queryJobs({
    roleSlugs: [role],
    citySlug: cityInfo.slug,
    minAnnual: 100_000,
    page: 1,
    pageSize: PAGE_SIZE,
  })

  if (total === 0) notFound()

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${SITE_URL}/jobs/100k-plus` },
      { '@type': 'ListItem', position: 3, name: `${roleName} jobs`, item: `${SITE_URL}/jobs/${role}` },
      { '@type': 'ListItem', position: 4, name: `${cityInfo.label} jobs`, item: `${SITE_URL}/jobs/${role}/city/${cityInfo.slug}` },
    ],
  }

  const itemListJsonLd = buildItemListJsonLd({
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
        name: `How many $100k+ ${roleName} jobs are in ${cityInfo.label}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${total.toLocaleString()} ${roleName} roles meet the $100k+ bar in ${cityInfo.label} right now, refreshed frequently from company ATS feeds.`,
        },
      },
      {
        '@type': 'Question',
        name: `What is the salary range for ${roleName} jobs in ${cityInfo.label}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'All listings are $100k+; many senior roles exceed $200k depending on level and company.',
        },
      },
      {
        '@type': 'Question',
        name: `What skills are needed for $100k+ ${roleName} positions in ${cityInfo.label}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Core role skills (language/framework) plus leadership, architecture, and collaboration. Review each job description for stack specifics.',
        },
      },
    ],
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
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

      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-400">
        <ol className="flex items-center gap-1">
          <li><Link href="/">Home</Link></li>
          <li className="px-1">/</li>
          <li><Link href={`/jobs/${role}`}>{roleName}</Link></li>
          <li className="px-1">/</li>
          <li>{cityInfo.label}</li>
        </ol>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-slate-50">
        {total.toLocaleString()} {roleName} $100k+ Jobs in {cityInfo.label}
      </h1>
      <p className="mb-6 text-sm text-slate-300">
        {cityInfo.label} {roleName} $100k jobs • $100k {roleName} jobs in {cityInfo.label} • high paying {roleName} jobs {cityInfo.label} • six figure {roleName} roles with remote and hybrid options when available.
      </p>

      <JobList jobs={jobs as JobWithCompany[]} />

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-xs text-slate-300">
          <span>
            Page {page} of {totalPages}
          </span>
        </nav>
      )}
    </main>
  )
}
