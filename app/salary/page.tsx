// app/salary/page.tsx
import Link from 'next/link'

const GUIDES: Array<{ slug: string; label: string }> = [
  { slug: 'software-engineer', label: 'Software Engineer salary' },
  { slug: 'senior-software-engineer', label: 'Senior Software Engineer salary' },
  { slug: 'staff-software-engineer', label: 'Staff Engineer salary' },
  { slug: 'principal-software-engineer', label: 'Principal Engineer salary' },
  { slug: 'product-manager', label: 'Product Manager salary' },
  { slug: 'data-engineer', label: 'Data Engineer salary' },
  { slug: 'data-scientist', label: 'Data Scientist salary' },
  { slug: 'devops', label: 'DevOps / SRE salary' },
  { slug: 'designer', label: 'Designer salary' },
  { slug: 'machine-learning', label: 'ML / AI Engineer salary' },
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

export const metadata = {
  title: 'Salary guides for $100k+ tech roles | Six Figure Jobs',
  description:
    'Browse salary guides for top tech roles using live $100k+ job data. Filter by country to see local ranges for engineering, product, data, design, and more.',
}

export default function SalaryIndexPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10 space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
          Salary guides
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">
          Salary guides powered by live $100k+ jobs
        </h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Explore salary ranges for core tech roles using verified $100k+ job listings.
          Jump to a role guide, then choose a country to see localized pay.
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
    </main>
  )
}
