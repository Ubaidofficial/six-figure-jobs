// app/jobs/category/[category]/page.tsx
// Programmatic SEO page for broad role categories (e.g., engineering, product, data)

export const revalidate = 600

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '../../../../lib/prisma'
import { buildWhere, queryJobs, type JobQueryInput, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import { Faq, JobRows, LinkChips, ListingHeader, ListingPage, ListingSection, Pagination, Prose } from '@/components/listing/ListingParts'
import { LOCATIONS } from '@/lib/constants/homepage'
import { buildItemListJsonLd as buildSafeItemListJsonLd } from '../../../../lib/seo/itemListJsonLd'
import { getSiteUrl, SITE_NAME, defaultOgImages } from '../../../../lib/seo/site'
import { isPhaseIndexable } from '../../../../lib/seo/indexingPhase'
import { buildJobsPath } from '../../../../lib/jobs/searchSlug'
import { countrySlugToCode } from '../../../../lib/seo/countrySlug'
import { resolveJobCategory } from '../../../../lib/seo/jobCategories'
import { ListingSalaryAside } from '@/components/listing/ListingSalaryAside'
import { SalaryByLevel } from '@/components/listing/SalaryByLevel'

const PAGE_SIZE = 40
const SITE_URL = getSiteUrl()

function faqItems(label: string) {
  const lower = label.toLowerCase()
  return [
    {
      q: `What qualifies as a high-paying ${lower} job?`,
      a: 'We only list roles with validated high-salary compensation signals from company career pages and job boards.',
    },
    {
      q: `Do you include remote and hybrid ${lower} jobs?`,
      a: 'Yes. Every listing is tagged as remote, hybrid, or on-site. Use the remote filters and salary bands to find flexible $100k+ roles.',
    },
    {
      q: `How fresh are these ${lower} roles?`,
      a: 'We refresh company career pages and job boards frequently, expire stale jobs, and prioritize the newest $100k+ openings.',
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

  // Category pages aren't in the Phase 1 allowlist — noindex until phase 2.
  const allowIndex =
    total >= 5 && isPhaseIndexable({ pathname: `/jobs/category/${category}` })
  const canonical = `${SITE_URL}/jobs/category/${category}`
  const shouldIndex = allowIndex && page === 1
  const title =
    total > 0
      ? `${cfg.label} jobs paying $100k+ (${total.toLocaleString()} openings) | ${SITE_NAME}`
      : `${cfg.label} jobs paying $100k+ | ${SITE_NAME}`
  const description =
    total > 0
      ? `${total.toLocaleString()} $100k+ ${cfg.label.toLowerCase()} jobs — salary shown upfront, with links to apply. Remote, hybrid and on-site roles refreshed daily.`
      : `$100k+ ${cfg.label.toLowerCase()} jobs — salary shown upfront, with links to apply. Remote, hybrid and on-site roles from top companies.`

  return {
    title,
    description,
    alternates: { canonical },
    robots: shouldIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { images: defaultOgImages(),
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
    <ListingPage>
      <ListingHeader
        aside={<ListingSalaryAside input={{ roleSlugs: cfg.roleSlugs, isHundredKLocal: true }} scope={`${cfg.label} roles`} />}
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Jobs', href: '/jobs' }, { label: cfg.label }]}
        accent={cfg.label}
        title="jobs paying $100k+"
        summary={
          <>
            <strong>{total.toLocaleString()}</strong> open {total === 1 ? 'role' : 'roles'}
            {insights.avgAnnual ? <> · average listed pay <strong>{avgSalaryLabel}</strong></> : null}
            {insights.newThisWeek ? <> · {insights.newThisWeek.toLocaleString()} new this week</> : null}
            {insights.remoteCount ? <> · {insights.remoteCount.toLocaleString()} remote</> : null}
          </>
        }
        chips={[
          ...['100k-plus', '200k-plus', '300k-plus', '400k-plus'].map((band) => ({
            label: `${band.replace('-plus', '')}+`,
            href: buildJobsPath({ salaryMin: Number(band.replace('k-plus', '000')), roleSlug: primaryRoleSlug }),
          })),
          {
            label: 'Remote $100k+',
            href: buildJobsPath({ salaryMin: 100_000, roleSlug: primaryRoleSlug, remoteOnly: true }),
          },
        ]}
      />

      <JobRows
        jobs={jobs as JobWithCompany[]}
        empty={{
          title: `No ${cfg.label.toLowerCase()} roles meet the $100k+ filter yet.`,
          body: 'Check back soon, or browse every $100k+ job.',
          href: '/jobs',
          hrefLabel: 'Browse all jobs',
        }}
      />
      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(n) => (n <= 1 ? `/jobs/category/${category}` : `/jobs/category/${category}?page=${n}`)}
      />

      <SalaryByLevel input={{ roleSlugs: cfg.roleSlugs, isHundredKLocal: true }} label={cfg.label} />

      <ListingSection title={`${cfg.label} jobs by location`}>
        <LinkChips
          label="Locations"
          items={[
            ...LOCATIONS.map((loc) => ({
              label: loc.code === 'remote' ? 'Remote' : loc.label,
              href:
                loc.code === 'remote'
                  ? `/remote/${primaryRoleSlug}`
                  : buildJobsPath({
                      salaryMin: 100_000,
                      roleSlug: primaryRoleSlug,
                      countryCode: countrySlugToCode(loc.code) ?? undefined,
                    }),
            })),
            {
              label: '$200k+ Remote',
              href: buildJobsPath({ salaryMin: 200_000, roleSlug: primaryRoleSlug, remoteOnly: true }),
            },
          ]}
        />
      </ListingSection>

      {insights.topCompanies.length > 0 || insights.topSkills.length > 0 ? (
        <ListingSection title={`What ${cfg.label.toLowerCase()} employers are hiring for`}>
          <Prose>
            {insights.topCompanies.length > 0 ? (
              <p>
                <strong>Companies hiring:</strong>{' '}
                {insights.topCompanies.map((c) => `${c.name} (${c.count})`).join(', ')}.
              </p>
            ) : null}
            {insights.topSkills.length > 0 ? (
              <p>
                <strong>Skills in current listings:</strong>{' '}
                {insights.topSkills.map((sk) => `${sk.name} (${sk.count})`).join(', ')}.
              </p>
            ) : null}
          </Prose>
        </ListingSection>
      ) : null}

      <ListingSection title={`FAQs about high-paying ${cfg.label.toLowerCase()} jobs`}>
        <Faq items={faqs.map((item) => ({ question: item.q, answer: item.a }))} />
      </ListingSection>

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
    </ListingPage>
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
