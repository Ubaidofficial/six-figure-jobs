// app/jobs/category/[category]/page.tsx
// Programmatic SEO page for broad role categories (e.g., engineering, product, data)

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '../../../../lib/prisma'
import { buildWhere, queryJobs, type JobQueryInput, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { formatRelativeTime } from '../../../../lib/utils/time'
import { LOCATIONS } from '@/lib/constants/homepage'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'
import { getSiteUrl, SITE_NAME } from '../../../../lib/seo/site'
import { buildJobsPath } from '../../../../lib/jobs/searchSlug'
import { countrySlugToCode } from '../../../../lib/seo/countrySlug'
import { resolveJobCategory } from '../../../../lib/seo/jobCategories'

const PAGE_SIZE = 40
const SITE_URL = getSiteUrl()

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
      a: 'We refresh ATS and board sources frequently, expire stale jobs, and prioritize the newest $100k+ openings.',
    },
    {
      q: `Why use this ${lower} category page instead of a generic job board?`,
      a: 'This page filters to compensation-backed six-figure roles, groups adjacent role titles, and links to salary bands, remote pages, companies, and skills so you can move from broad discovery to a precise search quickly.',
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
  searchParams,
}: {
  params: Promise<{ category: string }>
  searchParams?: Promise<Record<string, string>>
}): Promise<Metadata> {
  const { category } = await params
  const sp = (await searchParams) || {}
  const page = Math.max(1, Number(sp.page || '1') || 1)
  const cfg = resolveJobCategory(category)
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
  const shouldIndex = allowIndex && page === 1
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
    robots: shouldIndex ? { index: true, follow: true } : { index: false, follow: true },
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
  const cfg = resolveJobCategory(category)
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
  const insights = await getCategoryInsights({
    roleSlugs: cfg.roleSlugs,
    isHundredKLocal: true,
    page: 1,
    pageSize: 1,
  }, jobs as JobWithCompany[])

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
  const primaryRoleSlug = cfg.roleSlugs[0]
  const avgSalaryLabel = formatSalary(insights.avgAnnual)

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

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open six-figure roles" value={total.toLocaleString()} detail="Fresh, non-expired listings" />
        <MetricCard label="New this week" value={insights.newThisWeek.toLocaleString()} detail="Recently seen or posted" />
        <MetricCard label="Remote eligible" value={insights.remoteCount.toLocaleString()} detail="Remote-first listings" />
        <MetricCard label="Average listed pay" value={avgSalaryLabel} detail="From visible salary ranges" />
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold text-slate-50">
          Why this {cfg.label.toLowerCase()} category is built for Google and job seekers
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          This page combines adjacent {cfg.label.toLowerCase()} role titles into one canonical category,
          filters to compensation-backed $100k+ opportunities, and keeps only fresh listings that pass
          salary and content quality gates. Unlike broad job boards, the feed emphasizes salary evidence,
          direct company/ATS sources, remote eligibility, and related salary-band paths.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-200">
          <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
            {insights.atsSalaryCount.toLocaleString()} ATS salary-backed
          </span>
          <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
            {insights.topCompanies.length.toLocaleString()} top companies surfaced
          </span>
          <span className="rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
            No JobPosting schema on listing pages
          </span>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Explore salary bands
        </h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {['100k-plus', '200k-plus', '300k-plus', '400k-plus'].map((band) => (
            <Link
              key={band}
              href={buildJobsPath({
                salaryMin: Number(band.replace('k-plus', '000')),
                roleSlug: primaryRoleSlug,
              })}
              className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-200 hover:border-slate-600"
            >
              💵 {band.replace('-plus', 'k+')}
            </Link>
          ))}
          <Link
            href={buildJobsPath({ salaryMin: 100_000, roleSlug: primaryRoleSlug, remoteOnly: true })}
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
                  ? `/remote/${primaryRoleSlug}`
                  : buildJobsPath({
                      salaryMin: 100_000,
                      roleSlug: primaryRoleSlug,
                      countryCode: countrySlugToCode(loc.code) ?? undefined,
                    })
              }
              className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-200 hover:border-slate-600"
            >
              <span>{loc.flag}</span>
              <span>{loc.code === 'remote' ? 'Remote' : loc.label}</span>
            </Link>
          ))}
          <Link
            href={buildJobsPath({ salaryMin: 200_000, roleSlug: primaryRoleSlug, remoteOnly: true })}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-900/40 px-3 py-1.5 text-emerald-200 hover:border-emerald-500"
          >
            $200k+ Remote
          </Link>
        </div>
      </section>

      {(insights.topCompanies.length > 0 || insights.topSkills.length > 0) && (
        <section className="mb-6 grid gap-4 lg:grid-cols-2">
          {insights.topCompanies.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Top companies hiring {cfg.label.toLowerCase()} talent
              </h2>
              <div className="flex flex-wrap gap-2 text-xs">
                {insights.topCompanies.map((company) => (
                  <span
                    key={company.name}
                    className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-200"
                  >
                    {company.name} · {company.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {insights.topSkills.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                In-demand skills in current listings
              </h2>
              <div className="flex flex-wrap gap-2 text-xs">
                {insights.topSkills.map((skill) => (
                  <span
                    key={skill.name}
                    className="rounded-full border border-emerald-900 bg-emerald-950/50 px-3 py-1.5 text-emerald-100"
                  >
                    {skill.name} · {skill.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

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

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-50">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{detail}</div>
    </div>
  )
}

type CategoryInsights = {
  remoteCount: number
  newThisWeek: number
  atsSalaryCount: number
  avgAnnual: number | null
  topCompanies: Array<{ name: string; count: number }>
  topSkills: Array<{ name: string; count: number }>
}

async function getCategoryInsights(
  filters: JobQueryInput,
  pageJobs: JobWithCompany[],
): Promise<CategoryInsights> {
  const baseWhere = buildWhere(filters)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [remoteCount, newThisWeek, atsSalaryCount, salaryAgg, companyRows] = await Promise.all([
    prisma.job.count({ where: buildWhere({ ...filters, remoteOnly: true }) }),
    prisma.job.count({
      where: addAndClause(baseWhere, {
        OR: [
          { lastSeenAt: { gte: weekAgo } },
          { postedAt: { gte: weekAgo } },
          { createdAt: { gte: weekAgo } },
        ],
      }),
    }),
    prisma.job.count({ where: { ...baseWhere, salarySource: 'ats' } }),
    prisma.job.aggregate({
      where: baseWhere,
      _avg: { minAnnual: true, maxAnnual: true },
    }),
    prisma.job.groupBy({
      by: ['company'],
      where: baseWhere,
      _count: { _all: true },
      orderBy: { _count: { company: 'desc' } },
      take: 6,
    }),
  ])

  const avgMin = toNumber((salaryAgg._avg as any)?.minAnnual)
  const avgMax = toNumber((salaryAgg._avg as any)?.maxAnnual)
  const avgAnnual =
    avgMin && avgMax ? Math.round((avgMin + avgMax) / 2) : avgMax ?? avgMin ?? null

  return {
    remoteCount,
    newThisWeek,
    atsSalaryCount,
    avgAnnual,
    topCompanies: companyRows
      .map((row) => ({ name: String(row.company || '').trim(), count: Number(row._count?._all ?? 0) }))
      .filter((row) => row.name)
      .slice(0, 6),
    topSkills: extractTopSkills(pageJobs),
  }
}

function addAndClause(where: any, clause: any): any {
  return {
    ...where,
    AND: [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), clause],
  }
}

function extractTopSkills(jobs: JobWithCompany[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>()
  for (const job of jobs as any[]) {
    for (const skill of [...parseStringList(job.techStack), ...parseStringList(job.skillsJson)]) {
      const label = normalizeSkillLabel(skill)
      if (!label) continue
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12)
}

function parseStringList(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string')
  if (typeof raw !== 'string') return []

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    // Fall through to delimiter parsing.
  }

  return raw
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeSkillLabel(value: string): string | null {
  const cleaned = value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned.length < 2 || cleaned.length > 32) return null
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
}

function toNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'object' && typeof (value as any).toNumber === 'function') {
    const n = (value as any).toNumber()
    return Number.isFinite(n) ? n : null
  }
  const n = Number(String(value))
  return Number.isFinite(n) ? n : null
}

function formatSalary(value: number | null): string {
  if (!value || value <= 0) return 'Tracked'
  return `$${Math.round(value / 1000).toLocaleString()}k`
}
