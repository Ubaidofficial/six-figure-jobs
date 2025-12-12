// app/jobs/location/[country]/page.tsx
// Programmatic SEO page for country or remote-only high-salary jobs

import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '../../../../lib/prisma'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { formatRelativeTime } from '../../../../lib/utils/time'
import { TARGET_COUNTRIES } from '../../../../lib/seo/regions'
import { countryCodeToSlug, countrySlugToCode } from '../../../../lib/seo/countrySlug'
import { redirect } from 'next/navigation'
import { SALARY_BANDS } from '../../../page'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'

const PAGE_SIZE = 40

const LOCATION_MAP: Record<
  string,
  { label: string; countryCode?: string; remoteOnly?: boolean; slug?: string }
> = {
  remote: { label: 'Remote only', remoteOnly: true, slug: 'remote' as const },
}

for (const c of TARGET_COUNTRIES) {
  const slug = countryCodeToSlug(c.code)
  if (!slug) continue
  LOCATION_MAP[slug] = {
    label: c.label,
    countryCode: c.code,
  }
}

function resolveLocation(slug: string) {
  const key = slug.toLowerCase()
  if (LOCATION_MAP[key]) return { ...LOCATION_MAP[key], slug: key }

  // Legacy code support
  if (key.length === 2) {
    const slugFromCode = countryCodeToSlug(key.toUpperCase())
    if (slugFromCode && LOCATION_MAP[slugFromCode]) {
      return { ...LOCATION_MAP[slugFromCode], slug: slugFromCode, legacy: true }
    }
  }

  return null
}

function faqItems(label: string) {
  return [
    {
      q: `Are these ${label} jobs verified at $100k+?`,
      a: 'We surface roles with published or inferred $100k+ compensation (local equivalent) and expire stale listings quickly.',
    },
    {
      q: `Do you include remote and hybrid ${label} roles?`,
      a: 'Yes. Every job is tagged as remote, hybrid, or on-site. Use the filters to focus on flexible roles in your region.',
    },
    {
      q: `How often are ${label} jobs refreshed?`,
      a: 'We check ATS feeds daily, dedupe board jobs, and keep the freshest $100k+ roles on top.',
    },
  ]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>
}): Promise<Metadata> {
  const { country } = await params
  const loc = resolveLocation(country)
  if (!loc) return { title: 'Jobs | Six Figure Jobs' }

  if ((loc as any).legacy) {
    redirect(`/jobs/location/${(loc as any).slug}`)
  }

  const { total } = await queryJobs({
    minAnnual: 100_000,
    countryCode: loc.countryCode ?? undefined,
    remoteMode: loc.remoteOnly ? 'remote' : undefined,
    pageSize: 1,
  })

  const title = loc.remoteOnly
    ? `Remote $100k+ jobs (${total.toLocaleString()}) | ${SITE_NAME}`
    : `${loc.label} $100k+ jobs (${total.toLocaleString()}) | ${SITE_NAME}`

  const description = loc.remoteOnly
    ? `Browse ${total.toLocaleString()} remote $100k jobs, remote high paying jobs, six figure remote jobs across engineering, product, and data.`
    : `Browse ${total.toLocaleString()} $100k jobs in ${loc.label}. ${loc.label} $100k jobs, high paying jobs ${loc.label}, six figure ${loc.label} roles with verified pay.`

  const canonical = `${getSiteUrl()}/jobs/location/${loc.slug ?? country}`
  const allowIndex = total >= 3

  return {
    title,
    description,
    alternates: { canonical },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
    },
  }
}

export default async function LocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>
  searchParams?: Promise<Record<string, string>>
}) {
  const { country } = await params
  const loc = resolveLocation(country)

  if (!loc) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-xl font-semibold text-slate-50">Location not found</h1>
      </main>
    )
  }

  if ((loc as any).legacy) {
    redirect(`/jobs/location/${(loc as any).slug}`)
  }

  const sp = (await searchParams) || {}
  const page = Math.max(1, Number(sp.page || '1') || 1)
  const minParam = sp.min ? Number(sp.min) : 100_000
  const minAnnual = Number.isFinite(minParam) ? Math.max(100_000, minParam) : 100_000

  const filters: any = {
    minAnnual,
    page,
    pageSize: PAGE_SIZE,
    sortBy: 'date',
  }

  if (loc.remoteOnly) {
    filters.remoteMode = 'remote'
  } else if (loc.countryCode) {
    filters.countryCode = loc.countryCode
  }

  const { jobs, total } = await queryJobs(filters)

  const totalPages = total === 0 ? 1 : Math.ceil(total / PAGE_SIZE)

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${getSiteUrl()}/` },
      { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${getSiteUrl()}/jobs/100k-plus` },
      { '@type': 'ListItem', position: 3, name: `${loc.label} jobs`, item: `${getSiteUrl()}/jobs/location/${loc.slug ?? country}` },
    ],
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${loc.label} $100k+ jobs`,
    itemListElement: (jobs as JobWithCompany[]).slice(0, 40).map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'JobPosting',
        title: job.title,
        hiringOrganization: {
          '@type': 'Organization',
          name: job.companyRef?.name || job.company,
        },
        jobLocation: job.countryCode
          ? {
              '@type': 'Country',
              addressCountry: job.countryCode,
            }
          : undefined,
        url: `${getSiteUrl()}/job/${job.id}`,
      },
    })),
  }

  const companyCounts = new Map<string, { name: string; count: number; slug?: string | null }>()
  jobs.forEach((job: any) => {
    const key = job.companyId || job.company || job.companyRef?.name
    if (!key) return
    const existing =
      companyCounts.get(key) ?? {
        name: job.companyRef?.name ?? job.company,
        count: 0,
        slug: job.companyRef?.slug ?? null,
      }
    existing.count += 1
    companyCounts.set(key, existing)
  })
  const topCompanies = Array.from(companyCounts.values())
    .filter((c) => !!c.name)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const title = loc.remoteOnly
    ? 'Remote jobs paying $100k+'
    : `${loc.label} jobs paying $100k+`

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
        <p className="text-sm text-slate-300">
          High-paying roles ({loc.remoteOnly ? 'remote only' : loc.label}) across engineering, product,
          data, design, sales, marketing, and more.
        </p>
        <p className="text-xs text-slate-400">
          Updated {formatRelativeTime(new Date())} — {total.toLocaleString()} open roles.
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Refine by salary
        </h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {SALARY_BANDS.map((band) => (
            <Link
              key={band.slug}
              href={`?page=1&min=${band.min}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-200 hover:border-slate-600"
            >
              💵 {band.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Popular roles
        </h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {['software-engineer', 'data-scientist', 'product-manager', 'designer'].map((role) => (
            <Link
              key={role}
              href={`/jobs/${role}/${loc.remoteOnly ? 'remote' : country}/100k-plus`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-200 hover:border-slate-600"
            >
              {role.replace(/-/g, ' ')}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
        <p>
          Verified $100k+ roles in {loc.label} ({loc.remoteOnly ? 'remote only' : 'local + remote'})
          across engineering, product, data, design, and more. We refresh ATS feeds daily and rank by salary.
        </p>
      </section>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">
          No roles meet the $100k+ filter here yet. Check back soon.
        </p>
      ) : (
        <>
          <JobList jobs={jobs as JobWithCompany[]} />
          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between text-xs text-slate-300">
              <Link
                href={page > 1 ? `?page=${page - 1}` : '#'}
                className={`rounded-full px-3 py-2 ${
                  page > 1 ? 'bg-slate-800 hover:bg-slate-700' : 'cursor-not-allowed bg-slate-900 text-slate-600'
                }`}
                aria-disabled={page <= 1}
              >
                Previous
              </Link>
              <span>
                Page {page} of {totalPages}
              </span>
              <Link
                href={page < totalPages ? `?page=${page + 1}` : '#'}
                className={`rounded-full px-3 py-2 ${
                  page < totalPages ? 'bg-slate-800 hover:bg-slate-700' : 'cursor-not-allowed bg-slate-900 text-slate-600'
                }`}
                aria-disabled={page >= totalPages}
              >
                Next
              </Link>
            </nav>
          )}
        </>
      )}

      {topCompanies.length > 0 && (
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-50">
            Top companies hiring in {loc.label}
          </h2>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            {topCompanies.map((c) => (
              <Link
                key={`${c.name}-${c.slug ?? ''}`}
                href={c.slug ? `/company/${c.slug}` : '#'}
                className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 hover:border-slate-600"
              >
                <span className="font-semibold text-slate-100">{c.name}</span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
                  {c.count} roles
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-sm font-semibold text-slate-50">
          FAQs about $100k+ roles in {loc.label}
        </h2>
        <div className="space-y-3 text-sm text-slate-300">
          {faqItems(loc.label).map((item) => (
            <div key={item.q}>
              <p className="font-semibold text-slate-100">{item.q}</p>
              <p className="text-slate-300">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
