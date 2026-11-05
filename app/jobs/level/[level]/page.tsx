import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'
import { isPhaseIndexable } from '../../../../lib/seo/indexingPhase'
import { isPseoHubUnlocked } from '../../../../lib/seo/pseoUnlock'
import { LEVEL_TARGETS } from '../../../../lib/seo/pseoTargets'
import { Faq, JobRows, ListingHeader, ListingPage, ListingSection } from '@/components/listing/ListingParts'
import { ListingSalaryAside } from '@/components/listing/ListingSalaryAside'

export const revalidate = 3600

const SITE_URL = getSiteUrl()

const LEVELS = LEVEL_TARGETS

function buildBreadcrumbJsonLd(level: string, label: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${SITE_URL}/jobs/100k-plus` },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${label} jobs`,
        item: `${SITE_URL}/jobs/level/${level}`,
      },
    ],
  }
}

function buildFaqJsonLd(label: string, description: string, total: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How many ${label.toLowerCase()} $100k+ jobs are live right now?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${total.toLocaleString()} ${label.toLowerCase()} roles currently meet the $100k+ threshold on Six Figure Jobs.`,
        },
      },
      {
        '@type': 'Question',
        name: `What kinds of roles appear on the ${label.toLowerCase()} jobs page?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: description,
        },
      },
      {
        '@type': 'Question',
        name: `Are these ${label.toLowerCase()} jobs remote only?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. This page can include remote, hybrid, and on-site roles as long as they meet the salary and quality thresholds.',
        },
      },
    ],
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ level: string }>
}): Promise<Metadata> {
  const { level } = await params
  const info = LEVELS[level]
  if (!info) return { title: 'Not Found' }

  // Runs at request-time (cached via revalidate), not during build.
  const { total } = await queryJobs({
    experienceLevel: level,
    isHundredKLocal: true,
    pageSize: 1,
  })

  // Level pages aren't in the Phase 1 allowlist: noindex until phase 2, unless the hub is clearly substantial.
  const allowIndex =
    total >= 5 &&
    (isPhaseIndexable({ pathname: `/jobs/level/${level}` }) || isPseoHubUnlocked(total, `/jobs/level/${level}`))
  const canonical = `${SITE_URL}/jobs/level/${level}`

  const title =
    total > 0
      ? `${info.label} $100k+ Jobs - ${total.toLocaleString()} Positions | ${SITE_NAME}`
      : `${info.label} $100k+ Jobs | ${SITE_NAME}`

  const description =
    total > 0
      ? `Find ${total.toLocaleString()} ${info.label.toLowerCase()} tech jobs paying $100k+. ${info.description} at top companies. Updated daily.`
      : `${info.description} paying $100k+ at top tech companies.`

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
      images: [
        {
          url: `${SITE_URL}/og-level-${level}.png`,
          width: 1200,
          height: 630,
          alt: `${info.label} Jobs $100k+`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/og-level-${level}.png`],
    },
  }
}

export default async function LevelPage({
  params,
}: {
  params: Promise<{ level: string }>
}) {
  const { level } = await params
  const info = LEVELS[level]
  if (!info) notFound()

  const { jobs, total } = await queryJobs({
    experienceLevel: level,
    isHundredKLocal: true,
    pageSize: 40,
  })
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(level, info.label)
  const itemListJsonLd = buildSafeItemListJsonLd({
    name: `${info.label} $100k+ jobs`,
    jobs: (jobs as JobWithCompany[]).slice(0, 40),
    page: 1,
    pageSize: 40,
  })
  const faqJsonLd = buildFaqJsonLd(info.label, info.description, total)

  return (
    <ListingPage>
      <ListingHeader
        aside={<ListingSalaryAside input={{ experienceLevel: level, isHundredKLocal: true }} />}
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Jobs', href: '/jobs/100k-plus' },
          { label: info.label },
        ]}
        accent={info.label}
        title={`$100k+ jobs (${total.toLocaleString()})`}
        summary={
          <>
            <strong>{total.toLocaleString()}</strong> {info.label.toLowerCase()} {total === 1 ? 'role' : 'roles'} paying
            $100k or more. {info.description}.
          </>
        }
        chips={[
          { label: 'All $100k+ jobs', href: '/jobs/100k-plus' },
          { label: 'Engineering', href: '/jobs/category/engineering' },
          { label: 'Product', href: '/jobs/category/product' },
          { label: '$200k+', href: '/jobs/200k-plus' },
          ...Object.entries(LEVELS)
            .filter(([l]) => l !== level)
            .map(([l, lv]) => ({ label: lv.label, href: `/jobs/level/${l}` })),
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
