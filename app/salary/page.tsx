// app/salary/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHero, PageSection, PageStatGrid } from '@/components/seo/PageChrome'
import { getSiteUrl, defaultOgImages } from '@/lib/seo/site'
import { prisma } from '../../lib/prisma'
import {
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
} from '../../lib/jobs/queryJobs'

// 30-minute ISR — salary numbers change slowly, the page is high-traffic.
export const revalidate = 1800

const GUIDES: Array<{ slug: string; label: string }> = [
  { slug: 'software-engineer', label: 'Software Engineer salary' },
  { slug: 'senior-software-engineer', label: 'Senior Software Engineer salary' },
  { slug: 'staff-software-engineer', label: 'Staff Engineer salary' },
  { slug: 'principal-software-engineer', label: 'Principal Engineer salary' },
  { slug: 'product-manager', label: 'Product Manager salary' },
  { slug: 'data-engineer', label: 'Data Engineer salary' },
  { slug: 'data-scientist', label: 'Data Scientist salary' },
  { slug: 'devops-engineer', label: 'DevOps Engineer salary' },
  { slug: 'product-designer', label: 'Product Designer salary' },
  { slug: 'machine-learning-engineer', label: 'Machine Learning Engineer salary' },
  { slug: 'engineering-manager', label: 'Engineering Manager salary' },
  { slug: 'account-executive', label: 'Account Executive salary' },
]

const COUNTRIES: Array<{ code: string; label: string }> = [
  { code: 'us', label: 'United States' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'ca', label: 'Canada' },
  { code: 'de', label: 'Germany' },
  { code: 'ie', label: 'Ireland' },
  { code: 'au', label: 'Australia' },
  { code: 'sg', label: 'Singapore' },
]

const SITE_URL = getSiteUrl()

export const metadata: Metadata = {
  title: 'Tech Salary Guides by Role & Country | Six Figure Jobs',
  description:
    'Real salary ranges for software engineers, product managers, data scientists and more, from live $100k+ job listings by seniority, country and work type.',
  alternates: {
    canonical: `${SITE_URL}/salary`,
  },
  openGraph: { images: defaultOgImages(),
    title: 'Tech Salary Guides by Role & Country | Six Figure Jobs',
    description:
      'Real salary ranges for software engineers, product managers, data scientists and more, from live $100k+ job listings.',
    url: `${SITE_URL}/salary`,
    type: 'website',
  },
}

// Pulls USD min/max samples for the hub roles in a single DB roundtrip, then
// computes per-role median + count in JS. Cached behind ISR.
async function loadGuideMedians(): Promise<Map<string, { median: number | null; count: number }>> {
  const slugs = GUIDES.map((g) => g.slug)
  const rows = await prisma.job.findMany({
    where: {
      isExpired: false,
      currency: 'USD',
      roleSlug: { in: slugs },
      AND: [buildHighSalaryEligibilityWhere(), buildGlobalExclusionsWhere()],
    },
    select: { roleSlug: true, minAnnual: true, maxAnnual: true },
  })

  const byRole = new Map<string, number[]>()
  for (const r of rows) {
    if (!r.roleSlug) continue
    const bucket = byRole.get(r.roleSlug) ?? []
    if (r.minAnnual != null) bucket.push(Number(r.minAnnual))
    if (r.maxAnnual != null) bucket.push(Number(r.maxAnnual))
    byRole.set(r.roleSlug, bucket)
  }

  const result = new Map<string, { median: number | null; count: number }>()
  for (const slug of slugs) {
    const values = (byRole.get(slug) ?? []).slice().sort((a, b) => a - b)
    const count = values.length
    result.set(slug, {
      count,
      median: count > 0 ? values[Math.floor(count / 2)] : null,
    })
  }
  return result
}

function formatMoneyShort(value: number | null): string {
  if (value == null) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${value.toLocaleString('en-US')}`
}

// JSON-LD: breadcrumb plus an ItemList of the guides that this page links to.
const salaryJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Salary guides', item: `${SITE_URL}/salary` },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Tech salary guides by role & country',
    url: `${SITE_URL}/salary`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: GUIDES.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: g.label,
        url: `${SITE_URL}/salary/${g.slug}`,
      })),
    },
  },
]

export default async function SalaryIndexPage() {
  let medians: Map<string, { median: number | null; count: number }> | null = null
  try {
    medians = await loadGuideMedians()
  } catch {
    // Hub page must always render — fall back to the role-only view if the
    // DB is unreachable. The role guides themselves still link out.
    medians = null
  }

  const softwareEngineerMedian = medians?.get('software-engineer')?.median ?? null
  const productManagerMedian = medians?.get('product-manager')?.median ?? null
  const dataScientistMedian = medians?.get('data-scientist')?.median ?? null

  return (
    <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-12 pt-10 space-y-8">
      {salaryJsonLd.map((ld) => (
        <script key={ld['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}
      <PageHero
        eyebrow="Salary guides"
        title="Tech salary guides: $100k–$400k+ by role, seniority & country"
        description={
          <>
            Real compensation ranges for software engineers, product managers, data
            scientists, and 10+ more roles. Built from $100k+ job listings
            instead of surveys, then normalized by role, country, and salary band.
          </>
        }
        helper="Every guide is tied back to live jobs so users can move from salary research to applications without leaving the site."
        actions={
          <>
            <Link
              href="/jobs/100k-plus"
              className="rounded-full border border-border bg-card px-4 py-2 text-xs text-foreground hover:border-foreground/40"
            >
              Browse $100k+ jobs
            </Link>
            <Link
              href="/companies"
              className="rounded-full border border-border bg-card px-4 py-2 text-xs text-foreground hover:border-foreground/40"
            >
              Explore companies
            </Link>
          </>
        }
      >
        <PageStatGrid
          items={[
            // Live median anchors so users see real $ figures above the fold —
            // not just "12 role guides". Falls back to descriptive copy if
            // the DB query failed.
            {
              label: 'Software Engineer median',
              value: formatMoneyShort(softwareEngineerMedian),
              hint:
                softwareEngineerMedian != null
                  ? 'Live USD median, $100k+ listings'
                  : 'Open the role guide for the latest median',
            },
            {
              label: 'Product Manager median',
              value: formatMoneyShort(productManagerMedian),
              hint:
                productManagerMedian != null
                  ? 'Live USD median, $100k+ listings'
                  : 'Open the role guide for the latest median',
            },
            {
              label: 'Data Scientist median',
              value: formatMoneyShort(dataScientistMedian),
              hint:
                dataScientistMedian != null
                  ? 'Live USD median, $100k+ listings'
                  : 'Open the role guide for the latest median',
            },
            {
              label: 'Source method',
              value: 'ATS-backed',
              hint: 'Built from live verified salary listings',
            },
          ]}
        />
      </PageHero>

      <PageSection
        title="Choose a role"
        description="Start with the role, then narrow into country-specific guides and higher salary bands."
      >
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {GUIDES.map((guide) => {
            const stats = medians?.get(guide.slug)
            const median = stats?.median ?? null
            const sampleHint =
              median != null
                ? `${formatMoneyShort(median)} median USD${stats && stats.count > 0 ? ` · ${Math.floor(stats.count / 2)} data points` : ''}`
                : 'Live median refreshes on each ISR window'
            return (
              <Link
                key={guide.slug}
                href={`/salary/${guide.slug}`}
                className="block rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground hover:border-foreground/40"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span>{guide.label}</span>
                  {median != null ? (
                    <span className="font-semibold text-primary">
                      {formatMoneyShort(median)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{sampleHint}</div>
              </Link>
            )
          })}
        </div>
      </PageSection>

      <PageSection
        title="Popular countries"
        description="Use country shortcuts when you want local market pay instead of global blended numbers."
      >
        <div className="flex flex-wrap gap-2 text-sm">
          {COUNTRIES.map((c) => (
            <Link
              key={c.code}
              href={`/salary/software-engineer/${c.code}`}
              className="max-md:inline-flex max-md:min-h-11 max-md:items-center rounded-full border border-border bg-card px-3 py-1.5 text-foreground hover:border-foreground/40"
            >
              {c.label} – Software Engineer
            </Link>
          ))}
        </div>
      </PageSection>

      <PageSection
        title="Salary bands"
        description="Jump directly into the compensation tier that matches the search intent."
      >
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/jobs/100k-plus"
            className="max-md:flex max-md:min-h-11 max-md:items-center rounded-xl border border-border bg-card px-3 py-2 text-foreground hover:border-foreground/40"
          >
            $100k+ jobs
          </Link>
          <Link
            href="/jobs/200k-plus"
            className="max-md:flex max-md:min-h-11 max-md:items-center rounded-xl border border-border bg-card px-3 py-2 text-foreground hover:border-foreground/40"
          >
            $200k+ jobs
          </Link>
          <Link
            href="/jobs/300k-plus"
            className="max-md:flex max-md:min-h-11 max-md:items-center rounded-xl border border-border bg-card px-3 py-2 text-foreground hover:border-foreground/40"
          >
            $300k+ jobs
          </Link>
          <Link
            href="/jobs/400k-plus"
            className="max-md:flex max-md:min-h-11 max-md:items-center rounded-xl border border-border bg-card px-3 py-2 text-foreground hover:border-foreground/40"
          >
            $400k+ jobs
          </Link>
        </div>
      </PageSection>

      <PageSection
        title="How we build these salary guides"
        description="Each guide is assembled from live $100k+ tech job listings scraped directly from company career pages. We normalize compensation, remove expired or lowball postings, and tag every role with title, seniority, country, currency, and remote eligibility."
      >
        <ul className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <li className="rounded-lg border border-border bg-card px-3 py-2">
            <span className="font-semibold text-foreground block mb-1">Real-time data</span>
            Numbers refresh continuously as companies post or close roles — not once a year.
          </li>
          <li className="rounded-lg border border-border bg-card px-3 py-2">
            <span className="font-semibold text-foreground block mb-1">Local currencies</span>
            Country guides show GBP, EUR, CAD, AUD, SGD ranges so you can benchmark locally.
          </li>
          <li className="rounded-lg border border-border bg-card px-3 py-2">
            <span className="font-semibold text-foreground block mb-1">Direct to jobs</span>
            Every salary range links to the live openings behind it — research to application in one click.
          </li>
        </ul>
      </PageSection>
    </main>
  )
}
