import './globals.css'
import type { Metadata } from 'next'
import type { Viewport } from 'next'
import Link from 'next/link'
import { ThemeProvider } from '@/components/theme-provider'
import { Footer } from '@/components/layout/Footer'

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://www.6figjobs.com'
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: '$100k+ Jobs | High-Paying Six Figure Positions',
    template: '%s | Six Figure Jobs',
  },
  description:
    'Find 7,280+ verified jobs paying $100k+ USD. Remote, hybrid, and on-site six-figure positions from 309+ companies. Updated daily.',
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
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
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

            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
