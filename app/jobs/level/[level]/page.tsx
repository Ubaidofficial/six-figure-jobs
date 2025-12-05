import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { getSiteUrl } from '../../../../lib/seo/site'

export const revalidate = 300

const SITE_URL = getSiteUrl()

const LEVELS: Record<string, { label: string; description: string }> = {
  entry: { label: 'Entry Level', description: 'Early career and entry-level positions' },
  mid: { label: 'Mid Level', description: 'Mid-level positions for experienced professionals' },
  senior: { label: 'Senior', description: 'Senior-level positions requiring significant experience' },
  lead: { label: 'Lead / Staff', description: 'Lead, staff, and principal positions' },
  executive: { label: 'Executive', description: 'Executive and C-level positions' },
}

export async function generateStaticParams() {
  return Object.keys(LEVELS).map(level => ({ level }))
}

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }): Promise<Metadata> {
  const { level } = await params
  const info = LEVELS[level]
  if (!info) return { title: 'Not Found' }

  const { total } = await queryJobs({
    experienceLevel: level,
    minAnnual: 100_000,
    pageSize: 1,
  })

  const title = total > 0
    ? `${info.label} $100k+ Jobs - ${total.toLocaleString()} Positions | Six Figure Jobs`
    : `${info.label} $100k+ Jobs | Six Figure Jobs`

  const description = total > 0
    ? `Find ${total.toLocaleString()} ${info.label.toLowerCase()} tech jobs paying $100k+. ${info.description} at top companies. Updated daily.`
    : `${info.description} paying $100k+ at top tech companies.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/jobs/level/${level}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/jobs/level/${level}`,
      siteName: 'Six Figure Jobs',
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

export default async function LevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params
  const info = LEVELS[level]
  if (!info) notFound()

  const { jobs, total } = await queryJobs({
    experienceLevel: level,
    minAnnual: 100_000,
    pageSize: 40,
  })

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-400">
        <ol className="flex items-center gap-1">
          <li><Link href="/">Home</Link></li>
          <li className="px-1">/</li>
          <li><Link href="/jobs/100k-plus">Jobs</Link></li>
          <li className="px-1">/</li>
          <li>{info.label}</li>
        </ol>
      </nav>

      <h1 className="mb-4 text-2xl font-semibold text-slate-50">
        {info.label} $100k+ Jobs ({total.toLocaleString()})
      </h1>
      <p className="mb-6 text-sm text-slate-300">{info.description}</p>

      {jobs.length === 0 ? (
        <p className="text-slate-400">No jobs found.</p>
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
          <Link href="/jobs/country/us" className="text-blue-400 hover:underline">
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
    </main>
  )
}
