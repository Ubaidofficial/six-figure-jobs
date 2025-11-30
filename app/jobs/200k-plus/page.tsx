import type { Metadata } from 'next'
import Link from 'next/link'
import { queryJobs, type JobWithCompany } from '../../../lib/jobs/queryJobs'
import JobCard from '../../components/JobCard'

export const revalidate = 300

const MIN_SALARY = 200_000
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://sixfigurejobs.com'

export async function generateMetadata(): Promise<Metadata> {
  const { total } = await queryJobs({ minAnnual: MIN_SALARY, pageSize: 1 })

  const title =
    total > 0
      ? `$200k+ Tech Jobs - ${total.toLocaleString()} Senior Positions | Six Figure Jobs`
      : '$200k+ Tech Jobs | Six Figure Jobs'

  const description =
    total > 0
      ? `Find ${total.toLocaleString()} senior tech jobs paying $200k+. Staff engineer, principal, and leadership roles at Google, Meta, Stripe, and more. Updated daily.`
      : 'Senior and staff-level tech positions paying $200k+. High-compensation roles at top companies.'

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/jobs/200k-plus` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/jobs/200k-plus`,
      siteName: 'Six Figure Jobs',
      type: 'website',
      images: [
        {
          url: `${SITE_URL}/og-200k.png`,
          width: 1200,
          height: 630,
          alt: '$200k+ Tech Jobs',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/og-200k.png`],
    },
  }
}

export default async function Jobs200kPage() {
  const { jobs, total } = await queryJobs({
    minAnnual: MIN_SALARY,
    pageSize: 40,
  })

  const typedJobs = jobs as JobWithCompany[]

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-400">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li className="px-1">/</li>
          <li>$200k+ jobs</li>
        </ol>
      </nav>

      <h1 className="mb-1 text-2xl font-semibold text-slate-50">
        $200k+ Tech Jobs ({total.toLocaleString()})
      </h1>
      <p className="mb-6 text-sm text-slate-300">
        Senior and staff-level positions paying $200k or more annually.
      </p>

      {typedJobs.length === 0 ? (
        <p className="text-slate-400">No jobs found.</p>
      ) : (
        <>
          <p className="mb-3 text-[11px] text-slate-400">
            Showing {typedJobs.length} most recent roles.
          </p>
          <div className="space-y-3">
            {typedJobs.map((job) => (
              <JobCard key={job.id} job={job as any} />
            ))}
          </div>
        </>
      )}

      {/* Related Searches */}
      <section className="mt-12 rounded-xl border border-slate-800 bg-slate-950/50 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          Related Searches
        </h2>
        <div className="grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
          <Link
            href="/jobs/level/senior"
            className="text-blue-400 hover:underline"
          >
            Senior Tech Jobs
          </Link>
          <Link
            href="/jobs/level/lead"
            className="text-blue-400 hover:underline"
          >
            Lead &amp; Staff Engineer Jobs
          </Link>
          <Link
            href="/jobs/category/engineering"
            className="text-blue-400 hover:underline"
          >
            Engineering Jobs $200k+
          </Link>
          <Link
            href="/jobs/country/us"
            className="text-blue-400 hover:underline"
          >
            $200k+ Jobs in USA
          </Link>
          <Link
            href="/jobs/300k-plus"
            className="text-blue-400 hover:underline"
          >
            $300k+ Tech Jobs
          </Link>
          <Link
            href="/jobs/100k-plus"
            className="text-blue-400 hover:underline"
          >
            All $100k+ Jobs
          </Link>
        </div>
      </section>
    </main>
  )
}
