// app/jobs/no-degree/page.tsx
// pSEO landing page: $100k+ tech jobs that don't require a college degree.
// Targets: "6 figure jobs no degree", "high paying jobs without degree", "100k jobs no college"

import type { Metadata } from 'next'
import Link from 'next/link'
import { queryJobs, type JobWithCompany } from '../../../lib/jobs/queryJobs'
import JobList from '../../components/JobList'
import { SITE_NAME, getSiteUrl } from '../../../lib/seo/site'
import { buildItemListJsonLd } from '../../../lib/seo/itemListJsonLd'

export const dynamic = 'force-dynamic'
export const revalidate = 600

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type SearchParams = Record<string, string | string[] | undefined>

function parsePage(sp: SearchParams): number {
  return Math.max(1, Number((sp.page as string) || '1') || 1)
}

// Roles that are well-known to hire without degree requirements
const NO_DEGREE_ROLES = [
  { slug: 'software-engineer', label: 'Software Engineer', note: 'Portfolio + skills matter more than degrees' },
  { slug: 'devops-engineer', label: 'DevOps / SRE', note: 'Certifications (AWS, GCP) often replace degrees' },
  { slug: 'data-engineer', label: 'Data Engineer', note: 'Strong SQL/Python skills open doors without a degree' },
  { slug: 'full-stack-engineer', label: 'Full-Stack Engineer', note: 'Open source contributions & side projects count' },
  { slug: 'sales-development-representative', label: 'Sales (SDR/AE)', note: 'Track record beats formal education in sales' },
  { slug: 'product-manager', label: 'Product Manager', note: 'Product sense + domain expertise matters most' },
  { slug: 'customer-success', label: 'Customer Success', note: 'Communication skills + domain knowledge lead to $100k+' },
  { slug: 'account-executive', label: 'Account Executive', note: 'Performance-based; top AEs earn $150k–$300k+ without degrees' },
]

const FAQ = [
  {
    q: 'Can you really earn $100k+ in tech without a college degree?',
    a: 'Yes. Software engineering, DevOps, sales, and customer success roles routinely pay $100k–$200k+ and many companies (including top tech firms) have removed degree requirements. Google, Apple, IBM, and thousands of startups hire purely based on skills, portfolio, and experience.',
  },
  {
    q: 'Which six-figure tech jobs are most accessible without a degree?',
    a: 'Software engineering (bootcamp graduates hired regularly), DevOps/SRE (AWS/GCP certifications respected), sales/AE roles (quota attainment is the only metric), and customer success roles. Data engineering and product management are increasingly accessible too.',
  },
  {
    q: 'How do I compete against degree holders for $100k+ roles?',
    a: 'Build a strong portfolio on GitHub, contribute to open source projects, earn cloud certifications (AWS Solutions Architect, Google Cloud Professional), and accumulate verifiable results (shipped projects, quota performance, uptime numbers). These outweigh a degree at most companies.',
  },
  {
    q: 'Do all companies on Six Figure Jobs hire without degrees?',
    a: 'Not all — some enterprise companies still list degrees as preferred. However, many postings treat degrees as a soft preference, not a hard requirement. Apply even if the listing says "BS preferred." Tech hiring is skills-first.',
  },
]

const PATHS = [
  { title: 'Coding bootcamp', desc: 'Full-stack, web dev, or data science bootcamps. 3–6 months. Average bootcamp grad salary: $70k–$120k first job.', icon: '💻' },
  { title: 'Cloud certifications', desc: 'AWS, Google Cloud, Azure certifications are valued as much as (or more than) CS degrees for DevOps and cloud roles.', icon: '☁️' },
  { title: 'Self-taught + portfolio', desc: 'Open source contributions, side projects, and a strong GitHub profile can land $100k+ roles at top tech companies.', icon: '🛠️' },
  { title: 'Sales career path', desc: 'SDR → AE → Enterprise AE. Top enterprise AEs earn $200k–$400k+ total comp. No degree required — quota attainment is king.', icon: '📈' },
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
    const result = await queryJobs({ page: 1, pageSize: 1, roleSlugs: NO_DEGREE_ROLES.map((r) => r.slug) })
    total = result.total
  } catch (error) {
    void error
  }

  const title = `$100k+ Jobs Without a Degree | Six Figure Jobs`
  const description = `${total > 0 ? `${total.toLocaleString()} ` : ''}high-paying tech jobs that don't require a college degree. Software engineer, DevOps, sales, and data roles paying $100k–$300k+. Skills-first hiring. Apply directly.`
  const canonical = page > 1 ? `${SITE_URL}/jobs/no-degree?page=${page}` : `${SITE_URL}/jobs/no-degree`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: SITE_NAME, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function NoDegreeJobsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const sp = (await searchParams) || {}
  const page = parsePage(sp)

  // Filter to roles well-known for skills-first hiring (the same list shown in the cards above).
  // This prevents a topical mismatch where Google sees "no degree" content but an unfiltered feed.
  const noDegreeRoleSlugs = NO_DEGREE_ROLES.map((r) => r.slug)
  const result = await queryJobs({ page, pageSize: PAGE_SIZE, sortBy: 'date', roleSlugs: noDegreeRoleSlugs })

  const jobs = result.jobs as JobWithCompany[]
  const total = result.total
  const totalPages = result.totalPages

  const itemListJsonLd = buildItemListJsonLd({
    name: `$100k+ Jobs Without a Degree on ${SITE_NAME}`,
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
      { '@type': 'ListItem', position: 3, name: '$100k+ Jobs Without a Degree', item: `${SITE_URL}/jobs/no-degree` },
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
        <span style={{ color: '#fff' }}>No Degree Required</span>
      </nav>

      {/* Hero */}
      <header style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 32 }}>🎓</span>
          <span style={{ background: '#1a2e1a', border: '1px solid #84cc1640', borderRadius: 100, color: '#84cc16', fontSize: 12, fontWeight: 700, padding: '4px 12px' }}>
            SKILLS-FIRST HIRING
          </span>
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.15 }}>
          <span style={{ color: '#84cc16' }}>$100k+</span> Tech Jobs{' '}
          <span style={{ color: '#fff' }}>Without a Degree</span>
        </h1>
        <p style={{ fontSize: 18, color: '#a3a3a3', margin: '0 0 20px' }}>
          {total.toLocaleString()} verified six-figure jobs at companies that hire based on skills,
          not diplomas. Software engineering, DevOps, sales, and data roles paying $100k–$300k+.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ background: '#84cc1618', border: '1px solid #84cc1640', borderRadius: 100, color: '#84cc16', fontSize: 14, fontWeight: 700, padding: '8px 18px' }}>
            No degree filter required
          </span>
          <span style={{ background: '#3b82f618', border: '1px solid #3b82f640', borderRadius: 100, color: '#60a5fa', fontSize: 14, fontWeight: 700, padding: '8px 18px' }}>
            Verified salaries
          </span>
          <span style={{ background: '#6366f118', border: '1px solid #6366f140', borderRadius: 100, color: '#818cf8', fontSize: 14, fontWeight: 700, padding: '8px 18px' }}>
            Direct apply
          </span>
        </div>
      </header>

      {/* Best roles for non-degree holders */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Best $100k+ roles for non-degree holders</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {NO_DEGREE_ROLES.map((r) => (
            <Link
              key={r.slug}
              href={`/jobs/${r.slug}`}
              style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: '16px 20px', textDecoration: 'none', display: 'block' }}
            >
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{r.label}</div>
              <div style={{ color: '#a3a3a3', fontSize: 13 }}>{r.note}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Job listings */}
      <section aria-label="Job listings">
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
          Live $100k+ jobs — {total.toLocaleString()} openings
        </h2>
        <JobList jobs={jobs} />
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Pagination" style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 40 }}>
          {page > 1 && (
            <Link href={`/jobs/no-degree${page - 1 > 1 ? `?page=${page - 1}` : ''}`} style={{ color: '#84cc16' }}>← Previous</Link>
          )}
          <span style={{ color: '#a3a3a3' }}>Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/jobs/no-degree?page=${page + 1}`} style={{ color: '#84cc16' }}>Next →</Link>
          )}
        </nav>
      )}

      {/* Paths to $100k without a degree */}
      <section style={{ marginTop: 64 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>4 paths to $100k+ without a degree</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {PATHS.map((p) => (
            <div key={p.title} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{p.icon}</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{p.title}</div>
              <div style={{ color: '#a3a3a3', fontSize: 14, lineHeight: 1.6 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
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

      {/* Related */}
      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>More high-paying job searches</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { href: '/remote', label: 'Remote $100k+ jobs' },
            { href: '/jobs/visa-sponsorship', label: 'Visa sponsorship jobs' },
            { href: '/jobs/100k-plus', label: 'All $100k+ jobs' },
            { href: '/jobs/200k-plus', label: '$200k+ jobs' },
            { href: '/salary', label: 'Salary guides' },
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
