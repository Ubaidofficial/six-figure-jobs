import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'

export const revalidate = 300

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sixfigurejobs.com'

const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  engineering: { label: 'Engineering', emoji: '💻' },
  product: { label: 'Product', emoji: '🧭' },
  design: { label: 'Design', emoji: '🎨' },
  data: { label: 'Data', emoji: '📊' },
  marketing: { label: 'Marketing', emoji: '📣' },
  sales: { label: 'Sales', emoji: '💼' },
  devops: { label: 'DevOps', emoji: '⚙️' },
  'ai-ml': { label: 'AI / ML', emoji: '🤖' },
}

export async function generateStaticParams() {
  return Object.keys(CATEGORIES).map(category => ({ category }))
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params
  const info = CATEGORIES[category]
  if (!info) return { title: 'Not Found' }

  const { total } = await queryJobs({
    industry: category,
    minAnnual: 100_000,
    pageSize: 1,
  })

  const title = total > 0
    ? `${info.emoji} ${info.label} Jobs $100k+ - ${total.toLocaleString()} Positions | Six Figure Jobs`
    : `${info.emoji} ${info.label} Jobs $100k+ | Six Figure Jobs`

  const description = total > 0
    ? `Find ${total.toLocaleString()} high-salary ${info.label.toLowerCase()} jobs paying $100k+. Top tech companies hiring ${info.label.toLowerCase()} professionals. Updated daily.`
    : `High-salary ${info.label.toLowerCase()} positions paying $100k+ at top tech companies.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/jobs/category/${category}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/jobs/category/${category}`,
      siteName: 'Six Figure Jobs',
      type: 'website',
      images: [
        {
          url: `${SITE_URL}/og-category-${category}.png`,
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
      images: [`${SITE_URL}/og-category-${category}.png`],
    },
  }
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const info = CATEGORIES[category]
  if (!info) notFound()

  const { jobs, total } = await queryJobs({
    industry: category,
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
          <li>{info.emoji} {info.label}</li>
        </ol>
      </nav>

      <h1 className="mb-4 text-2xl font-semibold text-slate-50">
        {info.emoji} {info.label} $100k+ Jobs ({total.toLocaleString()})
      </h1>
      <p className="mb-6 text-sm text-slate-300">
        High-salary {info.label.toLowerCase()} positions from top companies.
      </p>

      {jobs.length === 0 ? (
        <p className="text-slate-400">No jobs found.</p>
      ) : (
        <JobList jobs={jobs as JobWithCompany[]} />
      )}

      <section className="mt-12 rounded-xl border border-slate-800 bg-slate-950/50 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">Related Searches</h2>
        <div className="grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
          <Link href="/jobs/level/senior" className="text-blue-400 hover:underline">
            Senior {info.label} Jobs
          </Link>
          <Link href="/jobs/level/lead" className="text-blue-400 hover:underline">
            Lead {info.label} Jobs
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
          {Object.entries(CATEGORIES)
            .filter(([c]) => c !== category)
            .slice(0, 3)
            .map(([c, cat]) => (
              <Link key={c} href={`/jobs/category/${c}`} className="text-blue-400 hover:underline">
                {cat.emoji} {cat.label} Jobs
              </Link>
            ))}
        </div>
      </section>
    </main>
  )
}