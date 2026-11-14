import type { Metadata } from 'next'
import { keywordsFor } from '@/lib/seo/keywordMap'
import Link from '@/components/ui/Link'
import { notFound } from 'next/navigation'

export const revalidate = 600

import { SKILL_TARGETS } from '../../../../lib/seo/pseoTargets'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import { loadTopRolePages, topRolesRow } from '../../../../lib/roles/topRolePages'
import JobList from '../../../components/JobList'
import { getSiteUrl, SITE_NAME, defaultOgImages } from '../../../../lib/seo/site'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'
import { isPhaseIndexable } from '../../../../lib/seo/indexingPhase'
import { isPseoHubUnlocked } from '../../../../lib/seo/pseoUnlock'
import { buildListingDescription, buildSkillTitle } from '../../../../lib/seo/metaText'
import { Faq, JobRows, ListingHeader, ListingPage, ListingSection } from '@/components/listing/ListingParts'
import { ListingSalaryAside } from '@/components/listing/ListingSalaryAside'

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

  // Skill pages aren't in the Phase 1 allowlist: they noindex until phase 2, unless the hub is clearly substantial.
  const allowIndex =
    total >= 5 &&
    (isPhaseIndexable({ pathname: `/jobs/skills/${resolved.slug}` }) || isPseoHubUnlocked(total, `/jobs/skills/${resolved.slug}`))
  const title = buildSkillTitle(resolved.label, total)
  const description = buildListingDescription(
    `${resolved.label} jobs paying $100k+.`,
    [['High-paying roles at top tech companies.']], total)
  const canonical = `${SITE_URL}/jobs/skills/${resolved.slug}`

  return {
    title,
    description,
    keywords: keywordsFor('skill', { skill: resolved.label }),
    alternates: { canonical },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { images: defaultOgImages(),
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
  const topRoles = await loadTopRolePages({ skillSlugs: [resolved.slug], isHundredKLocal: true })

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

  const relatedSkills = SKILL_TARGETS.filter((s) => s.slug !== resolved.slug).slice(0, 10)

  return (
    <ListingPage>
      <ListingHeader
        aside={<ListingSalaryAside input={{ skillSlugs: [resolved.slug], isHundredKLocal: true }} scope={`${resolved.label} roles`} />}
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Jobs', href: '/jobs/100k-plus' },
          { label: resolved.label },
        ]}
        accent={resolved.label}
        title={`jobs paying $100k+ (${total.toLocaleString()})`}
        summary={
          <>
            <strong>{total.toLocaleString()}</strong> {total === 1 ? 'role' : 'roles'} that list {resolved.label} and pay
            $100k or more, with the salary shown on every listing and a link to the employer&rsquo;s own application
            page.
          </>
        }
        related={topRolesRow(`Top roles using ${resolved.label}`, topRoles)}
        chips={[
          { label: 'All $100k+ jobs', href: '/jobs/100k-plus' },
          { label: 'Remote', href: '/remote' },
          ...relatedSkills.map((s) => ({ label: s.label, href: `/jobs/skills/${s.slug}` })),
        ]}
      />

      <JobRows
        jobs={jobs as JobWithCompany[]}
        empty={{
          title: 'No jobs found.',
          body: 'Try exploring all $100k+ opportunities.',
          href: '/jobs/100k-plus',
          hrefLabel: 'Browse all $100k+ jobs',
        }}
      />

      <ListingSection title="Frequently asked questions">
        <Faq items={faqJsonLd.mainEntity.map((q) => ({ question: q.name, answer: q.acceptedAnswer.text }))} />
      </ListingSection>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </ListingPage>
  )
}
