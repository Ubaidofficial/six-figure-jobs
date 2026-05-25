// app/salary/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

const GUIDES: Array<{ slug: string; label: string }> = [
  { slug: 'software-engineer', label: 'Software Engineer salary' },
  { slug: 'senior-software-engineer', label: 'Senior Software Engineer salary' },
  { slug: 'staff-software-engineer', label: 'Staff Engineer salary' },
  { slug: 'principal-software-engineer', label: 'Principal Engineer salary' },
  { slug: 'product-manager', label: 'Product Manager salary' },
  { slug: 'data-engineer', label: 'Data Engineer salary' },
  { slug: 'data-scientist', label: 'Data Scientist salary' },
  { slug: 'devops-engineer', label: 'DevOps Engineer salary' },
  { slug: 'product-designer', label: 'Product Designer salary' },
  { slug: 'machine-learning-engineer', label: 'Machine Learning Engineer salary' },
  { slug: 'engineering-manager', label: 'Engineering Manager salary' },
  { slug: 'account-executive', label: 'Account Executive salary' },
]

const COUNTRIES: Array<{ code: string; label: string }> = [
  { code: 'us', label: 'United States' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'ca', label: 'Canada' },
  { code: 'de', label: 'Germany' },
  { code: 'ie', label: 'Ireland' },
  { code: 'au', label: 'Australia' },
  { code: 'sg', label: 'Singapore' },
]

export const metadata: Metadata = {
  title: 'Tech Salary Guides: $100k–$400k+ by Role & Country | Six Figure Jobs',
  description:
    'Real salary ranges for software engineers, product managers, data scientists, and 10+ more roles. Live data from verified $100k+ job listings filtered by seniority, country, and work type.',
  alternates: {
    canonical: 'https://www.6figjobs.com/salary',
  },
  openGraph: {
    title: 'Tech Salary Guides: $100k–$400k+ by Role & Country | Six Figure Jobs',
    description:
      'Real salary ranges for software engineers, product managers, data scientists, and 10+ more roles. Updated continuously from verified $100k+ job listings.',
    url: 'https://www.6figjobs.com/salary',
    type: 'website',
  },
}

export default function SalaryIndexPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10 space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
          Salary guides
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">
          Tech salary guides: $100k–$400k+ by role, seniority &amp; country
        </h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Real compensation ranges for software engineers, product managers, data scientists, and 10+ more roles.
          Built from verified $100k+ job listings — not surveys. Filter by country to see US, UK, Canada, Germany, and more.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-900 bg-slate-950/70 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-100">
          Choose a role
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/salary/${guide.slug}`}
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 hover:border-slate-600"
            >
              {guide.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-900 bg-slate-950/70 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-100">
          Popular countries
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {COUNTRIES.map((c) => (
            <Link
              key={c.code}
              href={`/salary/software-engineer/${c.code}`}
              className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-100 hover:border-slate-600"
            >
              {c.label} – Software Engineer
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-900 bg-slate-950/70 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-100">
          Salary bands
        </h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/jobs/100k-plus"
            className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-slate-100 hover:border-slate-600"
          >
            $100k+ jobs
          </Link>
          <Link
            href="/jobs/200k-plus"
            className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-slate-100 hover:border-slate-600"
          >
            $200k+ jobs
          </Link>
          <Link
            href="/jobs/300k-plus"
            className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-slate-100 hover:border-slate-600"
          >
            $300k+ jobs
          </Link>
          <Link
            href="/jobs/400k-plus"
            className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-slate-100 hover:border-slate-600"
          >
            $400k+ jobs
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-900 bg-slate-950/60 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-100">
          How we build these salary guides
        </h2>
        <p className="text-sm leading-relaxed text-slate-300">
          Each guide is assembled from live $100k+ tech job listings scraped directly from ATS-powered company career pages — not recruiter surveys. We normalize compensation, remove expired or lowball postings, and tag every role with title, seniority, country, currency, and remote eligibility.
        </p>
        <ul className="grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <span className="font-semibold text-slate-100 block mb-1">Real-time data</span>
            Numbers refresh continuously as companies post or close roles — not once a year.
          </li>
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <span className="font-semibold text-slate-100 block mb-1">Local currencies</span>
            Country guides show GBP, EUR, CAD, AUD, SGD ranges so you can benchmark locally.
          </li>
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <span className="font-semibold text-slate-100 block mb-1">Direct to jobs</span>
            Every salary range links to the live openings behind it — research to application in one click.
          </li>
        </ul>
      </section>
    </main>
  )
}
