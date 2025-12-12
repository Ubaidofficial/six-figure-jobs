import './globals.css'
import type { Metadata } from 'next'
import type { Viewport } from 'next'
import Link from 'next/link'
import { ThemeProvider } from '@/components/theme-provider'
import { Footer } from '@/components/layout/Footer'
import { MobileNav } from '@/components/layout/MobileNav'

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
            <header className="sticky top-0 z-50 border-b border-slate-800/60 glass">
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus-ring absolute left-4 top-4 z-50 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-50"
              >
                Skip to content
              </a>

              <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                <Link
                  href="/"
                  className="focus-ring inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold tracking-tight text-slate-50 hover:text-white"
                >
                  Six Figure Jobs
                  <span className="hidden text-[11px] font-medium text-slate-400 sm:inline">
                    $100k+ only
                  </span>
                </Link>

                <nav className="hidden items-center gap-3 text-sm text-slate-300 md:flex">
                  <Link
                    href="/jobs"
                    className="focus-ring rounded-full border border-transparent px-3 py-2 transition hover:border-slate-700/70 hover:bg-white/5 hover:text-white"
                  >
                    Find $100k+ roles
                  </Link>
                  <Link
                    href="/salary"
                    className="focus-ring rounded-full border border-transparent px-3 py-2 transition hover:border-slate-700/70 hover:bg-white/5 hover:text-white"
                  >
                    Salary guides
                  </Link>
                  <Link
                    href="/post-a-job"
                    className="focus-ring inline-flex items-center justify-center rounded-full bg-emerald-400 px-4 py-2 font-semibold text-slate-950 shadow-[0_14px_40px_rgba(16,185,129,0.22)] transition hover:bg-emerald-300"
                  >
                    Hire $100k+ Talent
                  </Link>
                </nav>

                <div className="md:hidden">
                  <MobileNav />
                </div>
              </div>
            </header>

            <div id="main-content" className="flex-1">
              {children}
            </div>

            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
