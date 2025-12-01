import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Six Figure Jobs – $100k+ jobs only',
  description:
    'Six Figure Jobs curates only $100k+ jobs from top companies. Remote, hybrid, and on-site roles with real salary data.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full bg-slate-950">
      <body className="min-h-full bg-slate-950 text-slate-50">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-900/70 bg-slate-950/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <Link
                href="/"
                className="text-sm font-semibold text-slate-50 hover:text-white"
              >
                Six Figure Jobs
              </Link>
              <nav className="flex items-center gap-4 text-sm text-slate-300">
                <Link
                  href="/jobs"
                  className="hover:text-white"
                >
                  Browse jobs
                </Link>
                <Link
                  href="/salary/software-engineer"
                  className="hover:text-white"
                >
                  Salary guides
                </Link>
                <Link
                  href="/post-a-job"
                  className="rounded-full border border-emerald-600 px-3 py-1.5 font-semibold text-emerald-200 transition-colors hover:border-emerald-400 hover:text-white"
                >
                  Post a Job
                </Link>
              </nav>
            </div>
          </header>

          <div className="flex-1">{children}</div>

          <footer className="border-t border-slate-900/70 bg-slate-950/90">
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-200">
                  Search
                </p>
                <Link href="/jobs/location/us" className="block hover:text-slate-100">
                  Jobs in USA
                </Link>
                <Link href="/jobs/location/gb" className="block hover:text-slate-100">
                  Jobs in UK
                </Link>
                <Link href="/jobs/location/ca" className="block hover:text-slate-100">
                  Jobs in Canada
                </Link>
                <Link href="/jobs/location/de" className="block hover:text-slate-100">
                  Jobs in Germany
                </Link>
                <Link href="/jobs/location/ch" className="block hover:text-slate-100">
                  Jobs in Switzerland
                </Link>
                <Link href="/jobs/location/remote" className="block hover:text-slate-100">
                  Remote jobs (global)
                </Link>
                <Link href="/jobs/100k-plus" className="block hover:text-slate-100">
                  $100k+ jobs
                </Link>
                <Link href="/jobs/200k-plus" className="block hover:text-slate-100">
                  $200k+ jobs
                </Link>
                <Link href="/jobs/300k-plus" className="block hover:text-slate-100">
                  $300k+ jobs
                </Link>
                <Link href="/jobs/400k-plus" className="block hover:text-slate-100">
                  $400k+ jobs
                </Link>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-200">
                  Popular roles
                </p>
                <Link href="/jobs/software-engineer/100k-plus" className="block hover:text-slate-100">
                  Software Engineer jobs
                </Link>
                <Link href="/jobs/data-scientist/100k-plus" className="block hover:text-slate-100">
                  Data Scientist jobs
                </Link>
                <Link href="/jobs/product-manager/100k-plus" className="block hover:text-slate-100">
                  Product Manager jobs
                </Link>
                <Link href="/jobs/devops/100k-plus" className="block hover:text-slate-100">
                  DevOps / SRE jobs
                </Link>
                <Link href="/jobs/designer/100k-plus" className="block hover:text-slate-100">
                  Designer jobs
                </Link>
                <Link href="/jobs/sales/100k-plus" className="block hover:text-slate-100">
                  Sales jobs
                </Link>
                <Link href="/jobs/marketing/100k-plus" className="block hover:text-slate-100">
                  Marketing jobs
                </Link>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-200">
                  Salary guides
                </p>
                <Link href="/salary/software-engineer" className="block hover:text-slate-100">
                  Software Engineer salary
                </Link>
                <Link href="/salary/senior-software-engineer" className="block hover:text-slate-100">
                  Senior Engineer salary
                </Link>
                <Link href="/salary/lead-software-engineer" className="block hover:text-slate-100">
                  Lead Engineer salary
                </Link>
                <Link href="/salary/product-manager" className="block hover:text-slate-100">
                  Product Manager salary
                </Link>
                <Link href="/salary/data-scientist" className="block hover:text-slate-100">
                  Data Scientist salary
                </Link>
                <Link href="/salary/devops" className="block hover:text-slate-100">
                  DevOps / SRE salary
                </Link>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-200">
                  Resources
                </p>
                <Link href="/post-a-job" className="block hover:text-slate-100">
                  Post a job
                </Link>
                <Link href="/jobs/location/remote" className="block hover:text-slate-100">
                  Remote & hybrid policy
                </Link>
                <Link href="/jobs/100k-plus" className="block hover:text-slate-100">
                  Explore $100k+ jobs
                </Link>
                <p className="pt-2 text-[11px] text-slate-500">
                  Curated $100k+ roles from verified company sources. No lowball
                  ranges, no spam.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
