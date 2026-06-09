import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'
import { isPhaseIndexable } from '../../../../lib/seo/indexingPhase'

export const revalidate = 3600

const SITE_URL = getSiteUrl()

const LEVELS: Record<string, { label: string; description: string }> = {
  entry: { label: 'Entry Level', description: 'Early career and entry-level positions' },
  mid: { label: 'Mid Level', description: 'Mid-level positions for experienced professionals' },
  senior: { label: 'Senior', description: 'Senior-level positions requiring significant experience' },
  lead: { label: 'Lead / Staff', description: 'Lead, staff, and principal positions' },
  executive: { label: 'Executive', description: 'Executive and C-level positions' },
}

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

  // Level pages aren't in the Phase 1 allowlist — noindex until phase 2.
  const allowIndex =
    total >= 1 && isPhaseIndexable({ pathname: `/jobs/level/${level}` })
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
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-400">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li className="px-1">/</li>
          <li>
            <Link href="/jobs/100k-plus">Jobs</Link>
          </li>
          <li className="px-1">/</li>
          <li>{info.label}</li>
        </ol>
      </nav>

      <h1 className="mb-4 text-2xl font-semibold text-slate-50">
        {info.label} $100k+ Jobs ({total.toLocaleString()})
      </h1>
      <p className="mb-6 text-sm text-slate-300">{info.description}</p>

      {jobs.length === 0 ? (
        <p className="text-slate-400">No jobs found. Try exploring all $100k+ opportunities.</p>
      ) : (
        <JobList jobs={jobs as JobWithCompany[]} />
      )}

      <section className="mt-12 rounded-xl border border-slate-800 bg-slate-950/50 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">Related Searches</h2>
        <div className="grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
          <Link href="/jobs/category/engineering" className="text-blue-400 hover:underline">
            {info.label} Engineering Jobs
          </Link>
          <Link href="/jobs/category/product" className="text-blue-400 hover:underline">
            {info.label} Product Jobs
          </Link>
          <Link href="/jobs/location/united-states" className="text-blue-400 hover:underline">
            {info.label} Jobs in USA
          </Link>
          <Link href="/jobs/200k-plus" className="text-blue-400 hover:underline">
            $200k+ {info.label} Jobs
          </Link>
          <Link href="/jobs/100k-plus" className="text-blue-400 hover:underline">
            All $100k+ Jobs
          </Link>
          {Object.entries(LEVELS)
            .filter(([l]) => l !== level)
            .slice(0, 3)
            .map(([l, lv]) => (
              <Link key={l} href={`/jobs/level/${l}`} className="text-blue-400 hover:underline">
                {lv.label} Jobs
              </Link>
            ))}
        </div>
      </section>

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
