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
          <header className="border-b border-slate-800/60 bg-[#0d1321]/80 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <Link
                href="/"
                className="text-sm font-semibold text-slate-50 hover:text-white tracking-tight"
              >
                Six Figure Jobs
              </Link>
              <nav className="flex items-center gap-4 text-sm text-slate-300">
                <Link
                  href="/jobs"
                  className="rounded-full border border-transparent px-3 py-1.5 transition hover:border-slate-700 hover:bg-white/5 hover:text-white"
                >
                  Browse jobs
                </Link>
                <Link
                  href="/salary"
                  className="rounded-full border border-transparent px-3 py-1.5 transition hover:border-slate-700 hover:bg-white/5 hover:text-white"
                >
                  Salary guides
                </Link>
                <Link
                  href="/post-a-job"
                  className="rounded-full border border-[#19c4c8] bg-[#19c4c8] px-3 py-1.5 font-semibold text-[#05202a] shadow-[0_10px_30px_rgba(25,196,200,0.35)] transition hover:border-[#0ed1b8] hover:bg-[#0ed1b8]"
                >
                  Post a Job
                </Link>
              </nav>
            </div>
          </header>

          <div className="flex-1">{children}</div>

          <footer className="border-t border-slate-800/70 bg-[#0d1321]/90">
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-100">
                  Search $100k+ by location
                </p>
                <Link href="/jobs/us/100k-plus" className="block hover:text-slate-100">
                  $100k+ jobs in USA
                </Link>
                <Link href="/jobs/gb/100k-plus" className="block hover:text-slate-100">
                  £75k+/£100k+ jobs in UK
                </Link>
                <Link href="/jobs/ca/100k-plus" className="block hover:text-slate-100">
                  $100k+/CA$ jobs in Canada
                </Link>
                <Link href="/jobs/de/100k-plus" className="block hover:text-slate-100">
                  €90k+/€100k+ jobs in Germany
                </Link>
                <Link href="/jobs/ch/100k-plus" className="block hover:text-slate-100">
                  CHF 100k+ jobs in Switzerland
                </Link>
                <Link href="/jobs/location/remote" className="block hover:text-slate-100">
                  Remote $100k+ jobs
                </Link>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-100">
                  Popular $100k+ roles
                </p>
                <Link href="/jobs/software-engineer/100k-plus" className="block hover:text-slate-100">
                  Software Engineer jobs ($100k+)
                </Link>
                <Link href="/jobs/senior-software-engineer/100k-plus" className="block hover:text-slate-100">
                  Senior Engineer jobs ($100k+)
                </Link>
                <Link href="/jobs/product-manager/100k-plus" className="block hover:text-slate-100">
                  Product Manager jobs ($100k+)
                </Link>
                <Link href="/jobs/data-engineer/100k-plus" className="block hover:text-slate-100">
                  Data Engineer jobs ($100k+)
                </Link>
                <Link href="/jobs/devops/100k-plus" className="block hover:text-slate-100">
                  DevOps / SRE jobs ($100k+)
                </Link>
                <Link href="/jobs/marketing/100k-plus" className="block hover:text-slate-100">
                  Marketing jobs ($100k+)
                </Link>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-100">
                  Remote $100k+ jobs
                </p>
                <Link href="/remote/software-engineer" className="block hover:text-slate-100">
                  Remote Software Engineer
                </Link>
                <Link href="/remote/senior-software-engineer" className="block hover:text-slate-100">
                  Remote Senior Engineer
                </Link>
                <Link href="/remote/product-manager" className="block hover:text-slate-100">
                  Remote Product Manager
                </Link>
                <Link href="/remote/data-engineer" className="block hover:text-slate-100">
                  Remote Data Engineer
                </Link>
                <Link href="/remote/devops" className="block hover:text-slate-100">
                  Remote DevOps / SRE
                </Link>
                <Link href="/remote" className="block hover:text-slate-100">
                  View all remote jobs →
                </Link>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-100">
                  Resources
                </p>
                <Link href="/post-a-job" className="block hover:text-slate-100">
                  Post a job
                </Link>
                <Link href="/pricing" className="block hover:text-slate-100">
                  Pricing & featured posts
                </Link>
                <Link href="/jobs/100k-plus" className="block hover:text-slate-100">
                  Explore $100k+ jobs
                </Link>
                <p className="pt-2 text-[11px] text-slate-500">
                  Curated $100k+ roles from verified company sources. No lowball ranges, no spam.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
