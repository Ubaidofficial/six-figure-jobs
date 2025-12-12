import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SKILL_TARGETS } from '../../../../lib/seo/pseoTargets'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type Params = Promise<{ skill: string }>

function resolveSkill(slug: string) {
  return SKILL_TARGETS.find((s) => s.slug === slug.toLowerCase()) || null
}

function buildBreadcrumbJsonLd(skillSlug: string, skillLabel: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${SITE_URL}/jobs/100k-plus` },
      { '@type': 'ListItem', position: 3, name: `${skillLabel} jobs`, item: `${SITE_URL}/jobs/skills/${skillSlug}` },
    ],
  }
}

function buildItemListJsonLd(jobs: JobWithCompany[], skillLabel: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `$100k+ ${skillLabel} jobs`,
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
        url: `${SITE_URL}/job/${job.id}`,
      },
    })),
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { skill } = await params
  const resolved = resolveSkill(skill)
  if (!resolved) notFound()

  const { total } = await queryJobs({
    skillSlugs: [resolved.slug],
    minAnnual: 100_000,
    page: 1,
    pageSize: 1,
  })

  const allowIndex = total >= 3
  const titleBase = `$100k+ ${resolved.label} jobs`
  const title =
    total > 0
      ? `${titleBase} (${total.toLocaleString()} openings) | ${SITE_NAME}`
      : `${titleBase} | ${SITE_NAME}`
  const description = `Browse ${resolved.label} $100k jobs, ${resolved.label} high paying jobs, and six figure ${resolved.label} roles. ${total.toLocaleString()} live listings with transparent pay, updated often.`
  const canonical = `${SITE_URL}/jobs/skills/${resolved.slug}`

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

export default async function SkillPage({ params }: { params: Params }) {
  const { skill } = await params
  const resolved = resolveSkill(skill)
  if (!resolved) notFound()

  const { jobs, total, totalPages, page } = await queryJobs({
    skillSlugs: [resolved.slug],
    minAnnual: 100_000,
    page: 1,
    pageSize: PAGE_SIZE,
  })

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(resolved.slug, resolved.label)
  const itemListJsonLd = buildItemListJsonLd(jobs as JobWithCompany[], resolved.label)

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
        {resolved.label} $100k jobs • $100k {resolved.label} jobs • {resolved.label} high paying jobs • six figure {resolved.label} jobs. Remote and hybrid friendly roles first.
      </p>
      <p className="mb-6 text-xs text-slate-400">
        Showing page {page} of {totalPages}. Only verified compensation and mid-to-senior roles included.
      </p>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">No $100k+ {resolved.label} roles yet. New jobs are added daily.</p>
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
