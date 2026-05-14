// app/jobs/visa-sponsorship/page.tsx
// pSEO landing page: $100k+ tech jobs with H1B / visa sponsorship.
// Targets: "tech jobs visa sponsorship", "h1b visa sponsorship jobs", "software engineer visa sponsorship"

import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '../../../lib/prisma'
import { queryJobs, buildWhere, type JobWithCompany } from '../../../lib/jobs/queryJobs'
import JobList from '../../components/JobList'
import { SITE_NAME, getSiteUrl } from '../../../lib/seo/site'
import { buildItemListJsonLd } from '../../../lib/seo/itemListJsonLd'
import { buildJobSlugHref } from '../../../lib/jobs/jobSlug'

export const dynamic = 'force-dynamic'
export const revalidate = 600

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type SearchParams = Record<string, string | string[] | undefined>

function parsePage(sp: SearchParams): number {
  return Math.max(1, Number((sp.page as string) || '1') || 1)
}

const TOP_SPONSOR_ROLES = [
  { slug: 'software-engineer', label: 'Software Engineer' },
  { slug: 'backend-engineer', label: 'Backend Engineer' },
  { slug: 'data-engineer', label: 'Data Engineer' },
  { slug: 'data-scientist', label: 'Data Scientist' },
  { slug: 'devops-engineer', label: 'DevOps Engineer' },
  { slug: 'product-manager', label: 'Product Manager' },
  { slug: 'machine-learning-engineer', label: 'ML Engineer' },
  { slug: 'full-stack-engineer', label: 'Full-Stack Engineer' },
]

const FAQ = [
  {
    q: 'Which companies sponsor H1B visas for tech jobs?',
    a: 'Large tech companies (Google, Meta, Amazon, Microsoft, Apple), high-growth startups, and consulting firms are the most active H1B sponsors. Companies on Six Figure Jobs are predominantly tech-first and many routinely sponsor H1B and other work visas for qualified candidates.',
  },
  {
    q: 'Do I need to ask about visa sponsorship before applying?',
    a: "When a job listing explicitly states 'visa sponsorship available,' you can apply directly. For listings without explicit mention, it's best to check the company's careers FAQ or ask during the initial recruiter screen.",
  },
  {
    q: 'What is the salary range for visa-sponsored tech jobs?',
    a: 'Every listing on this page is $100k+. Visa-sponsored roles at top tech companies typically range from $130k to $300k+ total compensation, often including equity and bonuses. The H1B prevailing wage rules actually ensure salaries meet or exceed market rates.',
  },
  {
    q: 'Are remote jobs eligible for visa sponsorship?',
    a: 'H1B visas are tied to a specific employer and worksite. Fully remote jobs can qualify, but the employer must have a valid LCA (Labor Condition Application) for the remote location. Many companies now file blanket LCAs covering multiple states.',
  },
]

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = (await searchParams) || {}
  const page = parsePage(sp)

  let total = 0
  try {
    const result = await queryJobs({ page: 1, pageSize: 1, visaSponsorship: true })
    total = result.total
  } catch (error) {
    void error
  }

  const title = `Visa Sponsorship Tech Jobs — $100k+ | ${SITE_NAME}`
  const description = `${total > 0 ? `${total.toLocaleString()} ` : ''}H1B and visa-sponsored $100k+ tech jobs. Software engineer, data scientist, and engineering manager roles at companies actively sponsoring work visas. Verified salaries, direct apply.`

  const canonical = page > 1 ? `${SITE_URL}/jobs/visa-sponsorship?page=${page}` : `${SITE_URL}/jobs/visa-sponsorship`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: SITE_NAME, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function VisaSponsorshipPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const sp = (await searchParams) || {}
  const page = parsePage(sp)

  // Primary: jobs explicitly flagged as visa sponsorship
  let result = await queryJobs({ page, pageSize: PAGE_SIZE, visaSponsorship: true, sortBy: 'date' })

  // Fallback: if no flagged jobs yet, use keyword search in descriptions
  // This ensures the page is never empty while the batch marking catches up
  if (result.total === 0) {
    result = await queryJobs({ page, pageSize: PAGE_SIZE, keyword: 'visa sponsorship', sortBy: 'date' })
  }

  const topCompanies = await prisma.company.findMany({
    where: {
      jobs: {
        some: result.total > 0
          ? { visaSponsorship: true }
          : { descriptionHtml: { contains: 'visa', mode: 'insensitive' } },
      },
    },
    select: { name: true, slug: true },
    take: 12,
  })

  const jobs = result.jobs as JobWithCompany[]
  const total = result.total
  const totalPages = result.totalPages

  const itemListJsonLd = buildItemListJsonLd({
    name: `Visa Sponsorship Tech Jobs on ${SITE_NAME}`,
    jobs: jobs.map((j) => ({ id: j.id, title: j.title })),
    page,
    pageSize: PAGE_SIZE,
  })

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${SITE_URL}/jobs` },
      { '@type': 'ListItem', position: 3, name: 'Visa Sponsorship', item: `${SITE_URL}/jobs/visa-sponsorship` },
    ],
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ fontSize: 14, color: '#a3a3a3', marginBottom: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link href="/" style={{ color: '#a3a3a3', textDecoration: 'none' }}>Home</Link>
        <span>/</span>
        <Link href="/jobs" style={{ color: '#a3a3a3', textDecoration: 'none' }}>Jobs</Link>
        <span>/</span>
        <span style={{ color: '#fff' }}>Visa Sponsorship</span>
      </nav>

      {/* Hero */}
      <header style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 32 }}>🛂</span>
          <span style={{ background: '#1a2e1a', border: '1px solid #84cc1640', borderRadius: 100, color: '#84cc16', fontSize: 12, fontWeight: 700, padding: '4px 12px' }}>
            VISA SPONSORSHIP
          </span>
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.15 }}>
          H1B &amp; Visa Sponsorship <span style={{ color: '#84cc16' }}>Tech Jobs</span> — $100k+
        </h1>
        <p style={{ fontSize: 18, color: '#a3a3a3', margin: 0 }}>
          {total.toLocaleString()} verified roles at companies actively sponsoring work visas.
          Salary ranges published upfront. Direct apply — no recruiter middleman.
        </p>
      </header>

      {/* Role filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
        {TOP_SPONSOR_ROLES.map((r) => (
          <Link
            key={r.slug}
            href={`/jobs/${r.slug}`}
            style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 100, color: '#a3a3a3', fontSize: 13, fontWeight: 500, padding: '6px 14px', textDecoration: 'none' }}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* Job listings */}
      <section aria-label="Visa sponsorship job listings">
        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a3a3a3' }}>
            <p>No visa-sponsored listings found right now. <Link href="/jobs/100k-plus" style={{ color: '#84cc16' }}>Browse all $100k+ jobs</Link></p>
          </div>
        ) : (
          <JobList jobs={jobs} />
        )}
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Pagination" style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 40 }}>
          {page > 1 && (
            <Link href={`/jobs/visa-sponsorship${page - 1 > 1 ? `?page=${page - 1}` : ''}`} style={{ color: '#84cc16' }}>← Previous</Link>
          )}
          <span style={{ color: '#a3a3a3' }}>Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/jobs/visa-sponsorship?page=${page + 1}`} style={{ color: '#84cc16' }}>Next →</Link>
          )}
        </nav>
      )}

      {/* Why section */}
      <section style={{ marginTop: 64, padding: '40px', background: '#111', borderRadius: 16, border: '1px solid #1f1f1f' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 16px' }}>
          Why use Six Figure Jobs for visa-sponsored roles?
        </h2>
        <ul style={{ color: '#a3a3a3', fontSize: 16, lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Every job is <strong style={{ color: '#fff' }}>$100k+ with a published salary range</strong> — no guessing, no negotiation from zero</li>
          <li>Jobs are scraped directly from company ATS systems (Greenhouse, Lever, Ashby, Workday) so the apply link goes straight to the hiring company</li>
          <li>Listings are refreshed daily and expired jobs are removed automatically</li>
          <li>Filter by role, country, remote mode, and seniority to find the right H1B opportunities</li>
        </ul>
      </section>

      {/* FAQ section */}
      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 24px' }}>Frequently asked questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {FAQ.map(({ q, a }) => (
            <div key={q} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: '20px 24px' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{q}</h3>
              <p style={{ color: '#a3a3a3', margin: 0, lineHeight: 1.7 }}>{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Related links */}
      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Related job searches</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { href: '/remote', label: 'Remote $100k+ jobs' },
            { href: '/jobs/software-engineer', label: 'Software Engineer jobs' },
            { href: '/jobs/location/united-states', label: 'US tech jobs' },
            { href: '/jobs/100k-plus', label: 'All $100k+ jobs' },
            { href: '/jobs/200k-plus', label: '$200k+ jobs' },
          ].map((l) => (
            <Link key={l.href} href={l.href} style={{ color: '#84cc16', fontSize: 14, textDecoration: 'none', border: '1px solid #84cc1640', borderRadius: 8, padding: '6px 14px' }}>
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
