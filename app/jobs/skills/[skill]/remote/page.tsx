import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SKILL_TARGETS } from '../../../../../lib/seo/pseoTargets'
import { queryJobs, type JobWithCompany } from '../../../../../lib/jobs/queryJobs'
import JobList from '../../../../components/JobList'
import { getSiteUrl, SITE_NAME } from '../../../../../lib/seo/site'
import { buildJobSlugHref } from '../../../../../lib/jobs/jobSlug'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type Params = Promise<{ skill: string }>

function resolveSkill(slug: string) {
  return SKILL_TARGETS.find((s) => s.slug === slug.toLowerCase()) || null
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { skill } = await params
  const skillInfo = resolveSkill(skill)
  if (!skillInfo) notFound()

  const { total } = await queryJobs({
    skillSlugs: [skillInfo.slug],
    remoteOnly: true,
    minAnnual: 100_000,
    page: 1,
    pageSize: 1,
  })

  if (total === 0) {
    return { title: 'Jobs Not Found | Six Figure Jobs' }
  }

  const title = `Remote ${skillInfo.label} $100k jobs | ${total.toLocaleString()} roles | ${SITE_NAME}`
  const description = `${total.toLocaleString()} remote ${skillInfo.label} $100k jobs, remote high paying ${skillInfo.label} roles, and six figure ${skillInfo.label} jobs with verified pay.`
  const canonical = `${SITE_URL}/jobs/skills/${skillInfo.slug}/remote`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: SITE_NAME, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    robots: total >= 3 ? { index: true, follow: true } : { index: false, follow: true },
  }
}

export default async function SkillRemotePage({ params }: { params: Params }) {
  const { skill } = await params
  const skillInfo = resolveSkill(skill)
  if (!skillInfo) notFound()

  const { jobs, total, totalPages, page } = await queryJobs({
    skillSlugs: [skillInfo.slug],
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
      { '@type': 'ListItem', position: 3, name: `${skillInfo.label} jobs`, item: `${SITE_URL}/jobs/skills/${skillInfo.slug}` },
      { '@type': 'ListItem', position: 4, name: `Remote ${skillInfo.label} jobs`, item: `${SITE_URL}/jobs/skills/${skillInfo.slug}/remote` },
    ],
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Remote ${skillInfo.label} jobs paying $100k+`,
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
        name: `What is the average salary for remote ${skillInfo.label} jobs?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Remote roles listed here are filtered to $100k+ (or local equivalent), with senior openings often exceeding $200k depending on stack and company.',
        },
      },
      {
        '@type': 'Question',
        name: `How many $100k+ remote ${skillInfo.label} jobs are available?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${total.toLocaleString()} remote ${skillInfo.label} roles meet the $100k+ criteria right now, refreshed frequently from company ATS feeds.`,
        },
      },
      {
        '@type': 'Question',
        name: `What skills are needed for $100k+ remote ${skillInfo.label} positions?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Strong ${skillInfo.label} expertise plus adjacent tooling, and remote-friendly collaboration (async communication, documentation). See each listing for specifics.`,
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
          <li><Link href={`/jobs/skills/${skillInfo.slug}`}>{skillInfo.label}</Link></li>
          <li className="px-1">/</li>
          <li>Remote</li>
        </ol>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-slate-50">
        {total.toLocaleString()} Remote {skillInfo.label} $100k+ Jobs
      </h1>
      <p className="mb-6 text-sm text-slate-300">
        Remote {skillInfo.label} $100k jobs • $100k remote {skillInfo.label} jobs • high paying remote {skillInfo.label} jobs • six figure {skillInfo.label} roles with verified compensation and flexible locations.
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
