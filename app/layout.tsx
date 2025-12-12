import './globals.css'
import type { Metadata } from 'next'
import type { Viewport } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Six Figure Jobs – $100k+ jobs only',
  description:
    'Six Figure Jobs curates only $100k+ jobs from top companies. Remote, hybrid, and on-site roles with real salary data.',
  robots: process.env.NEXT_PUBLIC_SITE_URL?.includes('staging')
    ? { index: false, follow: false }
    : undefined,
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
                  $100k+ by Role
                </p>
                <Link href="/jobs/software-engineer/100k-plus" className="block hover:text-slate-100">Software Engineer $100k+ jobs</Link>
                <Link href="/jobs/senior-software-engineer/100k-plus" className="block hover:text-slate-100">Senior Software Engineer $100k+ jobs</Link>
                <Link href="/jobs/staff-software-engineer/100k-plus" className="block hover:text-slate-100">Staff Software Engineer $100k+ jobs</Link>
                <Link href="/jobs/product-manager/100k-plus" className="block hover:text-slate-100">Product Manager $100k+ jobs</Link>
                <Link href="/jobs/data-scientist/100k-plus" className="block hover:text-slate-100">Data Scientist $100k+ jobs</Link>
                <Link href="/jobs/data-engineer/100k-plus" className="block hover:text-slate-100">Data Engineer $100k+ jobs</Link>
                <Link href="/jobs/devops/100k-plus" className="block hover:text-slate-100">DevOps/SRE $100k+ jobs</Link>
                <Link href="/jobs/backend-engineer/100k-plus" className="block hover:text-slate-100">Backend Engineer $100k+ jobs</Link>
                <Link href="/jobs/frontend-engineer/100k-plus" className="block hover:text-slate-100">Frontend Engineer $100k+ jobs</Link>
                <Link href="/jobs/engineering-manager/100k-plus" className="block hover:text-slate-100">Engineering Manager $100k+ jobs</Link>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-100">
                  $100k+ by Location
                </p>
                <Link href="/jobs/location/united-states" className="block hover:text-slate-100">United States $100k+ jobs</Link>
                <Link href="/jobs/location/canada" className="block hover:text-slate-100">Canada $100k+ jobs</Link>
                <Link href="/jobs/location/united-kingdom" className="block hover:text-slate-100">United Kingdom £75k+/£100k+ jobs</Link>
                <Link href="/jobs/location/germany" className="block hover:text-slate-100">Germany €80k+/€100k+ jobs</Link>
                <Link href="/jobs/location/australia" className="block hover:text-slate-100">Australia $140k+ AUD jobs</Link>
                <Link href="/jobs/location/remote" className="block hover:text-slate-100">Remote $100k+ jobs</Link>
                <Link href="/jobs/state/california" className="block hover:text-slate-100">California $100k+ jobs</Link>
                <Link href="/jobs/state/texas" className="block hover:text-slate-100">Texas $100k+ jobs</Link>
                <Link href="/jobs/state/new-york" className="block hover:text-slate-100">New York $100k+ jobs</Link>
                <Link href="/jobs/state/washington" className="block hover:text-slate-100">Washington $100k+ jobs</Link>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-100">
                  $100k+ by City & Salary Band
                </p>
                <Link href="/jobs/city/san-francisco" className="block hover:text-slate-100">San Francisco $100k+ jobs</Link>
                <Link href="/jobs/city/new-york" className="block hover:text-slate-100">New York $100k+ jobs</Link>
                <Link href="/jobs/city/seattle" className="block hover:text-slate-100">Seattle $100k+ jobs</Link>
                <Link href="/jobs/city/austin" className="block hover:text-slate-100">Austin $100k+ jobs</Link>
                <Link href="/jobs/city/boston" className="block hover:text-slate-100">Boston $100k+ jobs</Link>
                <Link href="/jobs/city/toronto" className="block hover:text-slate-100">Toronto $100k+ jobs</Link>
                <Link href="/jobs/100k-plus" className="block hover:text-slate-100">$100k+ jobs</Link>
                <Link href="/jobs/200k-plus" className="block hover:text-slate-100">$200k+ jobs</Link>
                <Link href="/jobs/300k-plus" className="block hover:text-slate-100">$300k+ jobs</Link>
                <Link href="/jobs/400k-plus" className="block hover:text-slate-100">$400k+ jobs</Link>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-100">
                  $100k+ by Skills & Industry
                </p>
                <Link href="/jobs/skills/python" className="block hover:text-slate-100">Python $100k+ jobs</Link>
                <Link href="/jobs/skills/javascript" className="block hover:text-slate-100">JavaScript $100k+ jobs</Link>
                <Link href="/jobs/skills/react" className="block hover:text-slate-100">React $100k+ jobs</Link>
                <Link href="/jobs/skills/aws" className="block hover:text-slate-100">AWS $100k+ jobs</Link>
                <Link href="/jobs/skills/kubernetes" className="block hover:text-slate-100">Kubernetes $100k+ jobs</Link>
                <Link href="/jobs/skills/docker" className="block hover:text-slate-100">Docker $100k+ jobs</Link>
                <Link href="/jobs/skills/terraform" className="block hover:text-slate-100">Terraform $100k+ jobs</Link>
                <Link href="/jobs/industry/fintech" className="block hover:text-slate-100">Fintech $100k+ jobs</Link>
                <Link href="/jobs/industry/ai-ml" className="block hover:text-slate-100">AI/ML $100k+ jobs</Link>
                <Link href="/jobs/industry/cybersecurity" className="block hover:text-slate-100">Cybersecurity $100k+ jobs</Link>

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
