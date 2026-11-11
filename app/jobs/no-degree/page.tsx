// app/jobs/no-degree/page.tsx
// Six-figure jobs whose posting does not ask for a college degree, or accepts equivalent experience instead.
// Targets "six figure jobs without a degree" (about 1,600 US searches a month per DataForSEO, 2026-11-09).
//
// Until 2026-11-09 this page listed every software, DevOps, data and sales job as "jobs that don't require a college
// degree" without reading them. It now reads each posting (lib/jobs/degreeRequirement.ts): a job is listed when its
// description names no degree, or names one and accepts equivalent experience.

import type { Metadata } from 'next'
import Link from 'next/link'
import { memoAsync } from '../../../lib/cache/memo'
import { loadDegreeRequiredJobIds } from '../../../lib/jobs/degreeRequirement'
import { buildWhere, queryJobs, type JobWithCompany } from '../../../lib/jobs/queryJobs'
import { prisma } from '../../../lib/prisma'
import { rankTopRolePages } from '../../../lib/roles/topRolePages'
import JobList from '../../components/JobList'
import { SITE_NAME, getSiteUrl, defaultOgImages } from '../../../lib/seo/site'
import { isPhaseIndexable } from '../../../lib/seo/indexingPhase'
import { buildItemListJsonLd } from '../../../lib/seo/itemListJsonLd'

export const revalidate = 600

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40
const TITLE = 'High-Paying Jobs Without a Degree ($100k+) | Six Figure Jobs'

type SearchParams = Record<string, string | string[] | undefined>

function parsePage(sp: SearchParams): number {
  return Math.max(1, Number((sp.page as string) || '1') || 1)
}

/** How many no-degree jobs there are, out of how many six-figure jobs in all; cached with the degree pass. */
async function loadCounts() {
  const pass = await loadDegreeRequiredJobIds()
  return memoAsync(`no-degree-counts:${pass.classifiedAt.toISOString()}`, 60 * 60 * 1000, async () => {
    const [open, all, groups] = await Promise.all([
      prisma.job.count({ where: buildWhere({ noDegreeRequired: pass }) }),
      prisma.job.count({ where: buildWhere({}) }),
      prisma.job.groupBy({
        by: ['roleSlug'],
        where: { AND: [buildWhere({ noDegreeRequired: pass }), { roleSlug: { not: null } }] },
        _count: { _all: true },
        orderBy: { _count: { roleSlug: 'desc' } },
        take: 60,
      }),
    ])
    const roles = rankTopRolePages(groups.map((g) => ({ roleSlug: g.roleSlug, count: g._count._all })), { limit: 8, minJobs: 5 })
    return { open, all, roles }
  })
}

function buildFaq(open: number, all: number) {
  const share = all > 0 ? Math.round((open / all) * 100) : 0
  return [
    {
      q: 'Can you earn $100k+ without a college degree?',
      a:
        open > 0
          ? `Yes. Right now ${open.toLocaleString('en-US')} of the ${all.toLocaleString('en-US')} six-figure jobs on ${SITE_NAME} (about ${share}%) either don't ask for a degree in the posting or accept equivalent experience instead. Every one publishes a salary of $100k or more (or the local equivalent).`
          : `Some do. This page lists the six-figure jobs on ${SITE_NAME} whose posting doesn't ask for a degree or accepts equivalent experience instead.`,
    },
    {
      q: 'How do you know a job does not require a degree?',
      a: `We read each posting. A job is listed here when its description doesn't ask for a degree at all, or asks for one "or equivalent experience" (or says no degree is required). Jobs that ask for a degree with no alternative are left out. It is a reading of the posting text, so check the full description before you apply.`,
    },
    {
      q: 'How do I compete against degree holders for $100k+ roles?',
      a: 'Show the work: a portfolio or GitHub profile, open source contributions, relevant certifications (for example in cloud platforms) and results you can point to, such as shipped projects or quota attainment. When a posting accepts equivalent experience, describe yours in the terms the posting uses.',
    },
    {
      q: 'Do all employers on Six Figure Jobs hire without degrees?',
      a: 'No. Many postings still ask for a degree, and those are not listed here. Some postings say a degree is "preferred" rather than required; it is usually worth applying to those if you meet the other requirements.',
    },
  ]
}

const PATHS = [
  { title: 'Coding bootcamp', desc: 'Full-stack, web development or data science bootcamps, then a portfolio of projects that shows the skills a posting asks for.', icon: '💻' },
  { title: 'Cloud certifications', desc: 'AWS, Google Cloud and Azure certifications are a common way to show cloud and DevOps skills without a computer science degree.', icon: '☁️' },
  { title: 'Self-taught + portfolio', desc: 'Open source contributions, side projects and a strong GitHub profile give employers something concrete to judge.', icon: '🛠️' },
  { title: 'Sales career path', desc: 'SDR to account executive to enterprise AE: sales roles are usually judged on results such as quota attainment.', icon: '📈' },
]

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = (await searchParams) || {}
  const page = parsePage(sp)

  let open = 0
  try {
    open = (await loadCounts()).open
  } catch (error) {
    void error
  }

  const description = `${open > 0 ? `${open.toLocaleString('en-US')} ` : ''}six-figure jobs whose posting doesn't ask for a college degree or accepts equivalent experience. Salary shown on every listing.`
  const canonical = page > 1 ? `${SITE_URL}/jobs/no-degree?page=${page}` : `${SITE_URL}/jobs/no-degree`

  // Indexable when the phase allows it (it is listed in ALWAYS_INDEXABLE_HUBS) and the list is not empty.
  const allowIndex = isPhaseIndexable({ pathname: '/jobs/no-degree' }) && open > 0

  return {
    title: TITLE,
    description,
    alternates: { canonical },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { images: defaultOgImages(), title: TITLE, description, url: canonical, siteName: SITE_NAME, type: 'website' },
    twitter: { card: 'summary_large_image', title: TITLE, description },
  }
}

export default async function NoDegreeJobsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const sp = (await searchParams) || {}
  const page = parsePage(sp)

  const pass = await loadDegreeRequiredJobIds()
  const [result, counts] = await Promise.all([
    queryJobs({ page, pageSize: PAGE_SIZE, sortBy: 'date', noDegreeRequired: pass }),
    loadCounts(),
  ])

  const jobs = result.jobs as JobWithCompany[]
  const total = result.total
  const totalPages = result.totalPages
  const faq = buildFaq(counts.open, counts.all)

  const itemListJsonLd = buildItemListJsonLd({
    name: `Six-figure jobs without a degree on ${SITE_NAME}`,
    jobs: jobs.map((j) => ({ id: j.id, title: j.title })),
    page,
    pageSize: PAGE_SIZE,
  })

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
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
      { '@type': 'ListItem', position: 3, name: 'Six-figure jobs without a degree', item: `${SITE_URL}/jobs/no-degree` },
    ],
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ fontSize: 14, color: 'var(--color-text-1)', marginBottom: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link href="/" style={{ color: 'var(--color-text-1)', textDecoration: 'none' }}>Home</Link>
        <span>/</span>
        <Link href="/jobs" style={{ color: 'var(--color-text-1)', textDecoration: 'none' }}>Jobs</Link>
        <span>/</span>
        <span style={{ color: 'var(--color-text-0)' }}>No Degree Required</span>
      </nav>

      {/* Hero */}
      <header style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 32 }}>🎓</span>
          <span style={{ background: 'color-mix(in srgb, var(--color-primary) 18%, transparent)', border: '1px solid #84cc1640', borderRadius: 100, color: '#3f6212', fontSize: 12, fontWeight: 700, padding: '4px 12px' }}>
            SKILLS-FIRST HIRING
          </span>
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.15 }}>
          <span style={{ color: 'var(--color-primary-text)' }}>High-paying</span> jobs{' '}
          <span style={{ color: 'var(--color-text-0)' }}>without a degree</span>
        </h1>
        <p style={{ fontSize: 18, color: 'var(--color-text-1)', margin: 0 }}>
          {total.toLocaleString('en-US')} jobs paying $100k+ whose posting doesn&apos;t ask for a college degree, or
          accepts equivalent experience instead. We read every posting; check the full description before you apply.
        </p>
      </header>

      {/* Roles with the most of these jobs right now */}
      {counts.roles.length > 0 ? (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Roles with the most six-figure jobs that don&apos;t require a degree</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {counts.roles.map((r) => (
              <Link
                key={r.slug}
                href={`/jobs/${r.slug}`}
                style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 20px', textDecoration: 'none', display: 'block' }}
              >
                <div style={{ color: 'var(--color-text-0)', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{r.label}</div>
                <div style={{ color: 'var(--color-text-1)', fontSize: 13 }}>{r.count.toLocaleString('en-US')} open jobs here</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Job listings */}
      <section aria-label="Job listings">
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
          Live $100k+ jobs — {total.toLocaleString('en-US')} openings
        </h2>
        <JobList jobs={jobs} />
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Pagination" style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 40 }}>
          {page > 1 && (
            <Link href={`/jobs/no-degree${page - 1 > 1 ? `?page=${page - 1}` : ''}`} style={{ color: 'var(--color-primary-text)' }}>← Previous</Link>
          )}
          <span style={{ color: 'var(--color-text-1)' }}>Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/jobs/no-degree?page=${page + 1}`} style={{ color: 'var(--color-primary-text)' }}>Next →</Link>
          )}
        </nav>
      )}

      {/* Paths to $100k without a degree */}
      <section style={{ marginTop: 64 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>4 paths to $100k+ without a degree</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {PATHS.map((p) => (
            <div key={p.title} style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{p.icon}</div>
              <div style={{ color: 'var(--color-text-0)', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{p.title}</div>
              <div style={{ color: 'var(--color-text-1)', fontSize: 14, lineHeight: 1.6 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 24px' }}>Frequently asked questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {faq.map(({ q, a }) => (
            <div key={q} style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '20px 24px' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{q}</h3>
              <p style={{ color: 'var(--color-text-1)', margin: 0, lineHeight: 1.7 }}>{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Related */}
      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>More high-paying job searches</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { href: '/high-paying-jobs', label: 'High-paying jobs ranked by pay' },
            { href: '/remote', label: 'Remote $100k+ jobs' },
            { href: '/jobs/visa-sponsorship', label: 'Visa sponsorship jobs' },
            { href: '/jobs/4-day-week', label: '4-day work week jobs' },
            { href: '/jobs/100k-plus', label: 'All $100k+ jobs' },
            { href: '/jobs/200k-plus', label: '$200k+ jobs' },
            { href: '/salary', label: 'Salary guides' },
          ].map((l) => (
            <Link key={l.href} href={l.href} style={{ color: 'var(--color-primary-text)', fontSize: 14, textDecoration: 'none', border: '1px solid #84cc1640', borderRadius: 8, padding: '6px 14px' }}>
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
