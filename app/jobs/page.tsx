// app/jobs/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '../../lib/prisma'

export const revalidate = 600

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

export const metadata: Metadata = {
  title: 'High-paying tech jobs by salary band | Remote100k',
  description:
    'Browse $100k+, $200k+, $300k+, and $400k+ tech jobs indexed from ATS-powered company job boards. Explore popular role & country combinations.',
  alternates: {
    canonical: `${SITE_URL}/jobs`,
  },
  openGraph: {
    title: 'High-paying tech jobs by salary band | Remote100k',
    description:
      'Explore $100k+, $200k+, $300k+, and $400k+ salary bands and popular role/country slices for top-paying tech jobs.',
    url: `${SITE_URL}/jobs`,
    siteName: 'Remote100k',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'High-paying tech jobs by salary band | Remote100k',
    description:
      'Curated $100k+, $200k+, $300k+, and $400k+ tech roles from ATS-powered company boards.',
  },
}

type BandConfig = {
  id: '100k' | '200k' | '300k' | '400k'
  label: string
  blurb: string
  href: string
  slugPrefix: string // matches JobSlice.slug prefix from seedJobSlices
}

const BANDS: BandConfig[] = [
  {
    id: '100k',
    label: '$100k+ tech jobs from top companies',
    blurb:
      'Curated $100k+ tech and software roles from ATS-powered company boards.',
    href: '/jobs/100k-plus',
    slugPrefix: 'jobs/100k-plus',
  },
  {
    id: '200k',
    label: '$200k+ tech jobs from top companies',
    blurb:
      'Principal, leadership, and specialist roles with $200k+ compensation.',
    href: '/jobs/200k-plus',
    slugPrefix: 'jobs/200k-plus',
  },
  {
    id: '300k',
    label: '$300k+ tech jobs',
    blurb: 'Executive-track and top-comp principal roles with $300k+ packages.',
    href: '/jobs/300k-plus',
    slugPrefix: 'jobs/300k-plus',
  },
  {
    id: '400k',
    label: '$400k+ executive tech jobs',
    blurb: 'Executive and top-comp band roles with $400k+ compensation.',
    href: '/jobs/400k-plus',
    slugPrefix: 'jobs/400k-plus',
  },
]

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function prettyRoleAndCountryFromSlug(slug: string): string {
  // e.g. jobs/100k-plus/software-engineer/us
  const parts = slug.split('/')

  // Expect: ["jobs", "100k-plus", "role-slug", "country-code"]
  const roleSlug = parts[2] || ''
  const countryCode = (parts[3] || '').toUpperCase()

  const roleLabel = roleSlug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  if (!roleLabel) return slug
  if (!countryCode) return roleLabel
  return `${roleLabel} · ${countryCode}`
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function JobsIndexPage() {
  // For each salary band, pull the most popular role+country JobSlices
  const bandSlices = await Promise.all(
    BANDS.map((band) =>
      prisma.jobSlice.findMany({
        where: {
          slug: {
            startsWith: `${band.slugPrefix}/`,
          },
          jobCount: {
            gt: 0,
          },
        },
        orderBy: {
          jobCount: 'desc',
        },
        take: 12,
      })
    )
  )

  return (
    <main className="mx-auto max-w-6xl px-4 pb-14 pt-10">
      {/* ------------------------------- Breadcrumbs ------------------------------ */}
      <nav
        aria-label="Breadcrumb"
        className="mb-4 text-xs text-slate-400"
      >
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link
              href="/"
              className="hover:text-slate-200 hover:underline"
            >
              Home
            </Link>
          </li>
          <li className="px-1 text-slate-600">/</li>
          <li aria-current="page" className="text-slate-200">
            Jobs
          </li>
        </ol>
      </nav>

      {/* --------------------------------- Hero ---------------------------------- */}
      <header className="mb-8 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
          SALARY-FIRST JOB DISCOVERY
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-[2rem]">
          High-paying tech jobs by salary band
        </h1>
        <p className="max-w-2xl text-sm text-slate-300">
          Explore live $100k+, $200k+, $300k+, and $400k+ roles indexed
          directly from ATS-powered company boards. Each page combines role,
          country, and salary data to surface the strongest compensation
          opportunities.
        </p>
      </header>

      {/* -------------------------- Salary band summary cards -------------------- */}
      <section className="mb-8 grid gap-4 md:grid-cols-3">
        {BANDS.map((band) => (
          <Link
            key={band.id}
            href={band.href}
            className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/80 p-4 transition hover:border-slate-600 hover:bg-slate-900"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {band.id === '100k'
                  ? 'Core band'
                  : band.id === '200k'
                  ? 'Senior band'
                  : band.id === '300k'
                  ? 'Principal band'
                  : 'Executive band'}
              </p>
              <h2 className="mt-2 text-sm font-semibold text-slate-50">
                {band.label}
              </h2>
              <p className="mt-2 text-xs text-slate-300">
                {band.blurb}
              </p>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              View all {band.id}+ jobs →
            </p>
          </Link>
        ))}
      </section>

      {/* ---------------------- Popular slices per salary band ------------------- */}
      {BANDS.map((band, idx) => {
        const slices = bandSlices[idx]

        if (!slices || slices.length === 0) {
          return null
        }

        return (
          <section key={band.id} className="mb-8 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-50">
                Popular {band.id}+ jobs by role &amp; country
              </h2>
              <Link
                href={band.href}
                className="text-[11px] text-blue-400 hover:underline"
              >
                View all {band.id}+ jobs →
              </Link>
            </div>

            <ul className="flex flex-wrap gap-2 text-[11px]">
              {/* Explicitly typed slice as any to resolve build error */}
              {slices.map((slice: any) => (
                <li key={slice.slug}>
                  <Link
                    href={`/${slice.slug}`}
                    className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-slate-200 hover:border-slate-600 hover:bg-slate-900"
                  >
                    <span className="truncate">
                      {slice.title ||
                        slice.h1 ||
                        prettyRoleAndCountryFromSlug(slice.slug)}
                    </span>
                    <span className="ml-1 text-slate-500">
                      ({slice.jobCount})
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </main>
  )
}
