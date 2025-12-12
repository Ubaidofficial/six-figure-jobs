import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'
import JobList from '../../../components/JobList'
import { buildJobSlugHref } from '../../../../lib/jobs/jobSlug'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type Params = Promise<{ role: string }>

function prettyRole(slug: string) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { role } = await params
  const roleName = prettyRole(role)

  const { total } = await queryJobs({
    roleSlugs: [role],
    remoteOnly: true,
    minAnnual: 100_000,
    page: 1,
    pageSize: 1,
  })

  if (total === 0) {
    return { title: 'Jobs Not Found | Six Figure Jobs' }
  }

  const title = `Remote ${roleName} $100k Jobs | ${total.toLocaleString()} High Paying Positions | ${SITE_NAME}`
  const description = `Find ${total.toLocaleString()} remote ${roleName} $100k jobs, remote high paying ${roleName} roles, and six figure ${roleName} jobs. Salary-first listings with verified compensation.`
  const canonical = `${SITE_URL}/jobs/${role}/remote`

  return {
    title,
    description,
    alternates: { canonical },
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
    robots: total >= 3 ? { index: true, follow: true } : { index: false, follow: true },
  }
}

export default async function RoleRemotePage({ params }: { params: Params }) {
  const { role } = await params
  const roleName = prettyRole(role)

  const { jobs, total, totalPages, page } = await queryJobs({
    roleSlugs: [role],
    remoteOnly: true,
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
      { '@type': 'ListItem', position: 3, name: `Remote ${roleName} jobs`, item: `${SITE_URL}/jobs/${role}/remote` },
    ],
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Remote ${roleName} jobs paying $100k+`,
    itemListElement: (jobs as JobWithCompany[]).slice(0, PAGE_SIZE).map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'JobPosting',
        title: job.title,
        hiringOrganization: { '@type': 'Organization', name: job.companyRef?.name || job.company },
        jobLocationType: 'TELECOMMUTE',
        url: `${SITE_URL}${buildJobSlugHref(job)}`,
      },
    })),
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is the average salary for remote ${roleName} jobs?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Remote roles listed here are filtered to $100k+ (or local equivalent), with higher bands often reaching $200k-$300k depending on seniority and company.',
        },
      },
      {
        '@type': 'Question',
        name: `How many remote ${roleName} $100k+ jobs are available?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${total.toLocaleString()} remote ${roleName} jobs meet the $100k+ criteria right now, updated frequently from company ATS feeds.`,
        },
      },
      {
        '@type': 'Question',
        name: `What skills are needed for remote ${roleName} positions?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Core role skills plus remote-friendly collaboration (async communication, documentation). Check each listing for stack details and required experience.',
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
          <li><Link href="/jobs/100k-plus">Jobs</Link></li>
          <li className="px-1">/</li>
          <li>Remote {roleName}</li>
        </ol>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-slate-50">
        {total.toLocaleString()} Remote {roleName} $100k+ Jobs
      </h1>
      <p className="mb-6 text-sm text-slate-300">
        Remote {roleName} $100k jobs • $100k remote {roleName} jobs • remote high paying {roleName} jobs • six figure remote {roleName} roles with verified compensation.
      </p>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">No remote {roleName} $100k+ roles yet. Check back soon.</p>
      ) : (
        <JobList jobs={jobs as JobWithCompany[]} />
      )}

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
