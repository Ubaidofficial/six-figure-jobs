import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 600

import { SKILL_TARGETS } from '../../../../lib/seo/pseoTargets'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'
import { isPhaseIndexable } from '../../../../lib/seo/indexingPhase'

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

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { skill } = await params
  const resolved = resolveSkill(skill)
  if (!resolved) notFound()

  const { total } = await queryJobs({
    skillSlugs: [resolved.slug],
    isHundredKLocal: true,
    page: 1,
    pageSize: 1,
  })

  // Skill pages aren't in the Phase 1 allowlist — they noindex until phase 2.
  const allowIndex =
    total >= 5 &&
    isPhaseIndexable({ pathname: `/jobs/skills/${resolved.slug}` })
  const titleBase = `$100k+ ${resolved.label} jobs`
  const title =
    total > 0
      ? `${titleBase} (${total.toLocaleString()} openings) | ${SITE_NAME}`
      : `${titleBase} | ${SITE_NAME}`
  const description = `${total.toLocaleString()} verified $100k+ ${resolved.label} jobs with salary shown upfront — apply direct, no recruiters. High-paying ${resolved.label} roles at top tech companies, updated daily from company ATS feeds.`
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
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How much do ${resolved.label} jobs pay?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${resolved.label} jobs on Six Figure Jobs all meet the $100k+ salary floor. Verified roles in this skill range from $${Math.round(salaryMin / 1000)}k to $${Math.round(salaryMax / 1000)}k based on current listings — seniority, team size, and remote eligibility all affect the final number.`,
        },
      },
      {
        '@type': 'Question',
        name: `Are there remote $100k+ ${resolved.label} jobs?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. Many ${resolved.label} roles on Six Figure Jobs offer fully remote or hybrid arrangements. Each listing shows the work type and a direct apply link so you can quickly filter to distributed-friendly positions.`,
        },
      },
      {
        '@type': 'Question',
        name: `What other skills pair well with ${resolved.label}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `High-paying ${resolved.label} roles frequently appear alongside complementary technologies in cloud infrastructure, distributed systems, and data pipelines. Browse the full $100k+ ${resolved.label} job feed to see which skills co-occur most in current postings.`,
        },
      },
    ],
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-neutral-400">
        <ol className="flex items-center gap-1">
          <li><Link href="/">Home</Link></li>
          <li className="px-1">/</li>
          <li><Link href="/jobs/100k-plus">Jobs</Link></li>
          <li className="px-1">/</li>
          <li>{resolved.label}</li>
        </ol>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-neutral-50">
        {resolved.label} $100k+ jobs ({total.toLocaleString()})
      </h1>
      <p className="mb-4 text-sm text-neutral-300">
        Explore <strong className="text-white">{total.toLocaleString()}</strong>{' '}
        {resolved.label} <strong className="text-green-500">$100k</strong> jobs
        with verified{' '}
        <strong className="text-green-500">six figure salaries</strong>. Find{' '}
        <strong className="text-white">high paying</strong> {resolved.label}{' '}
        roles paying <strong className="text-green-500">$100k+</strong> from $
        {salaryMin.toLocaleString()} to ${salaryMax.toLocaleString()} across
        remote, hybrid, and on-site teams.
      </p>
      <p className="mb-6 text-xs text-neutral-400">
        Showing page {page} of {totalPages}. Only verified compensation and mid-to-senior roles included.
      </p>

      {jobs.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No jobs found. Try exploring all $100k+ opportunities.
        </p>
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
