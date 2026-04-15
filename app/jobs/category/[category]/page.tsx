// app/jobs/category/[category]/page.tsx
// Programmatic SEO page for broad role categories (e.g., engineering, product, data)

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { formatRelativeTime } from '../../../../lib/utils/time'
import { LOCATIONS } from '@/lib/constants/homepage'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'

const PAGE_SIZE = 40
const SITE_URL = getSiteUrl()

const CATEGORY_MAP: Record<
  string,
  { label: string; roleSlugs: string[] }
> = {
  engineering: {
    label: 'Engineering',
    roleSlugs: [
      'software-engineer',
      'backend',
      'frontend',
      'full-stack',
      'mobile',
      'ios',
      'android',
      'platform',
      'systems',
      'application',
      'devops',
      'sre',
      'infrastructure',
      'web-developer',
    ],
  },
  product: {
    label: 'Product',
    roleSlugs: ['product-manager', 'product-owner', 'product'],
  },
  data: {
    label: 'Data',
    roleSlugs: ['data-scientist', 'data-engineer', 'analytics', 'data-analyst'],
  },
  design: {
    label: 'Design',
    roleSlugs: ['designer', 'design', 'ux', 'ui', 'product-designer'],
  },
  devops: {
    label: 'DevOps',
    roleSlugs: ['devops', 'sre', 'site-reliability'],
  },
  mlai: {
    label: 'ML / AI',
    roleSlugs: ['machine-learning', 'ml', 'ai', 'artificial-intelligence'],
  },
  sales: {
    label: 'Sales',
    roleSlugs: ['sales', 'account-executive', 'sdr', 'bdr'],
  },
  marketing: {
    label: 'Marketing',
    roleSlugs: ['marketing', 'growth', 'demand-generation', 'seo', 'performance'],
  },
}

function resolveCategory(slug: string) {
  const key = slug.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return CATEGORY_MAP[key]
}

function faqItems(label: string) {
  const lower = label.toLowerCase()
  return [
    {
      q: `What qualifies as a high-paying ${lower} job?`,
      a: 'We only list roles with published or inferred compensation of $100k+ (or the local equivalent) from ATS feeds and trusted boards.',
    },
    {
      q: `Do you include remote and hybrid ${lower} jobs?`,
      a: 'Yes. Every listing is tagged as remote, hybrid, or on-site. Use the remote filters and salary bands to find flexible $100k+ roles.',
    },
    {
      q: `How fresh are these ${lower} roles?`,
      a: 'We refresh ATS sources daily, expire stale jobs, and prioritize the newest $100k+ openings.',
    },
  ]
}

function buildBreadcrumbJsonLd(categorySlug: string, label: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${SITE_URL}/jobs/100k-plus` },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${label} jobs`,
        item: `${SITE_URL}/jobs/category/${categorySlug}`,
      },
    ],
  }
}

function buildFaqJsonLd(label: string) {
  const items = faqItems(label)

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const cfg = resolveCategory(category)
  if (!cfg) {
    return {
      title: 'Category not found | Six Figure Jobs',
      robots: { index: false, follow: false },
    }
  }

  const { total } = await queryJobs({
    roleSlugs: cfg.roleSlugs,
    isHundredKLocal: true,
    page: 1,
    pageSize: 1,
  })

  const allowIndex = total >= 3
  const canonical = `${SITE_URL}/jobs/category/${category}`
  const title =
    total > 0
      ? `${cfg.label} jobs paying $100k+ (${total.toLocaleString()} openings) | ${SITE_NAME}`
      : `${cfg.label} jobs paying $100k+ | ${SITE_NAME}`
  const description =
    total > 0
      ? `Browse ${total.toLocaleString()} curated ${cfg.label.toLowerCase()} roles paying $100k+ across top companies. Remote, hybrid, and on-site.`
      : `Browse curated ${cfg.label.toLowerCase()} roles paying $100k+ across top companies. Remote, hybrid, and on-site.`

  return {
    title,
    description,
    alternates: { canonical },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
    },
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>
  searchParams?: Promise<Record<string, string>>
}) {
  const { category } = await params
  const cfg = resolveCategory(category)
  if (!cfg) notFound()

  const sp = (await searchParams) || {}
  const page = Math.max(1, Number(sp.page || '1') || 1)

  const { jobs, total } = await queryJobs({
    roleSlugs: cfg.roleSlugs,
    isHundredKLocal: true,
    page,
    pageSize: PAGE_SIZE,
    sortBy: 'date',
  })

  const totalPages = total === 0 ? 1 : Math.ceil(total / PAGE_SIZE)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(category, cfg.label)
  const itemListJsonLd = buildSafeItemListJsonLd({
    name: `${cfg.label} jobs paying $100k+`,
    jobs: (jobs as JobWithCompany[]).slice(0, PAGE_SIZE),
    page,
    pageSize: PAGE_SIZE,
  })
  const faqJsonLd = buildFaqJsonLd(cfg.label)
  const faqs = faqItems(cfg.label)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">
          {cfg.label} jobs paying $100k+
        </h1>
        <p className="text-sm text-slate-300">
          Remote, hybrid, and on-site high-paying {cfg.label.toLowerCase()} roles from top companies.
        </p>
        <p className="text-xs text-slate-400">
          Updated {formatRelativeTime(new Date())} — {total.toLocaleString()} open roles.
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Explore salary bands
        </h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {['100k-plus', '200k-plus', '300k-plus', '400k-plus'].map((band) => (
            <Link
              key={band}
              href={`/jobs/${cfg.roleSlugs[0]}/${band}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-200 hover:border-slate-600"
            >
              💵 {band.replace('-plus', 'k+')}
            </Link>
          ))}
          <Link
            href={`/jobs/${cfg.roleSlugs[0]}/remote/100k-plus`}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-900/40 px-3 py-1.5 text-emerald-200 hover:border-emerald-500"
          >
            🌍 Remote $100k+
          </Link>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Popular slices
        </h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {LOCATIONS.map((loc) => (
            <Link
              key={loc.code}
              href={
                loc.code === 'remote'
                  ? `/remote/${cfg.roleSlugs[0]}`
                  : `/jobs/${cfg.roleSlugs[0]}/${loc.code}/100k-plus`
              }
              className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-200 hover:border-slate-600"
            >
              <span>{loc.flag}</span>
              <span>{loc.code === 'remote' ? 'Remote' : loc.label}</span>
            </Link>
          ))}
          <Link
            href={`/jobs/${cfg.roleSlugs[0]}/remote/200k-plus`}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-900/40 px-3 py-1.5 text-emerald-200 hover:border-emerald-500"
          >
            $200k+ Remote
          </Link>
        </div>
      </section>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">
          No {cfg.label.toLowerCase()} roles meet the $100k+ filter yet. Check back soon.
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

      <section className="mt-10 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-sm font-semibold text-slate-50">
          FAQs about high-paying {cfg.label.toLowerCase()} jobs
        </h2>
        <div className="space-y-3 text-sm text-slate-300">
          {faqs.map((item) => (
            <div key={item.q}>
              <p className="font-semibold text-slate-100">{item.q}</p>
              <p className="text-slate-300">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </main>
  )
}
