import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 600

import { SKILL_TARGETS } from '../../../../../lib/seo/pseoTargets'
import { isPhaseIndexable } from '../../../../../lib/seo/indexingPhase'
import { queryJobs, type JobWithCompany } from '../../../../../lib/jobs/queryJobs'
import JobList from '../../../../components/JobList'
import { getSiteUrl, SITE_NAME } from '../../../../../lib/seo/site'
import { buildItemListJsonLd } from '../../../../../lib/seo/itemListJsonLd'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type Params = Promise<{ role: string; skill: string }>

function prettyRole(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function resolveSkill(slug: string) {
  return SKILL_TARGETS.find((s) => s.slug === slug.toLowerCase()) || null
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { role, skill } = await params
  const skillInfo = resolveSkill(skill)
  if (!skillInfo) notFound()
  const roleName = prettyRole(role)

  const { total } = await queryJobs({
    roleSlugs: [role],
    skillSlugs: [skillInfo.slug],
    isHundredKLocal: true,
    page: 1,
    pageSize: 1,
  })

  if (total === 0) {
    return { title: 'Jobs Not Found | Six Figure Jobs' }
  }

  const title = `${roleName} ${skillInfo.label} $100k jobs | ${total.toLocaleString()} roles | ${SITE_NAME}`
  const description = `${total.toLocaleString()} verified $100k+ ${roleName} jobs requiring ${skillInfo.label} — salary upfront, apply direct. Six-figure ${roleName} ${skillInfo.label} roles at top companies, refreshed daily from ATS feeds.`
  const canonical = `${SITE_URL}/jobs/${role}/skills/${skillInfo.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: SITE_NAME, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    // Phase-aware: role × skill deep combos aren't in the Phase 1 allowlist.
    robots:
      total >= 1 &&
      isPhaseIndexable({ roleSlug: role, pathname: `/jobs/${role}/skills/${skillInfo.slug}` })
        ? { index: true, follow: true }
        : { index: false, follow: true },
  }
}

export default async function RoleSkillPage({ params }: { params: Params }) {
  const { role, skill } = await params
  const skillInfo = resolveSkill(skill)
  if (!skillInfo) notFound()
  const roleName = prettyRole(role)

  const { jobs, total, totalPages, page } = await queryJobs({
    roleSlugs: [role],
    skillSlugs: [skillInfo.slug],
    isHundredKLocal: true,
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
      { '@type': 'ListItem', position: 4, name: `${skillInfo.label} ${roleName} jobs`, item: `${SITE_URL}/jobs/${role}/skills/${skillInfo.slug}` },
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
        name: `What is the average salary for ${roleName} jobs requiring ${skillInfo.label}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'All roles shown are filtered for validated high-salary compensation; senior openings often exceed $200k depending on company and stack.',
        },
      },
      {
        '@type': 'Question',
        name: `How many $100k+ ${roleName} jobs require ${skillInfo.label}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${total.toLocaleString()} live roles currently meet the $100k+ bar and list ${skillInfo.label} as a required skill.`,
        },
      },
      {
        '@type': 'Question',
        name: `What skills are needed for $100k+ ${roleName} positions with ${skillInfo.label}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Core ${roleName.toLowerCase()} skills, strong ${skillInfo.label} expertise, and adjacent tooling (cloud, CI/CD, testing). See each listing for exact stack and seniority.`,
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

      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-neutral-400">
        <ol className="flex items-center gap-1">
          <li><Link href="/">Home</Link></li>
          <li className="px-1">/</li>
          <li><Link href={`/jobs/${role}`}>{roleName}</Link></li>
          <li className="px-1">/</li>
          <li>{skillInfo.label}</li>
        </ol>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-neutral-50">
        {total.toLocaleString()} {roleName} $100k+ Jobs requiring {skillInfo.label}
      </h1>
      <p className="mb-6 text-sm text-neutral-300">
        {roleName} {skillInfo.label} $100k jobs • $100k {roleName} jobs needing {skillInfo.label} • high paying {roleName} roles with {skillInfo.label} • six figure {roleName} positions with verified compensation.
      </p>

      <JobList jobs={jobs as JobWithCompany[]} />

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-xs text-neutral-300">
          <span>
            Page {page} of {totalPages}
          </span>
        </nav>
      )}
    </main>
  )
}
