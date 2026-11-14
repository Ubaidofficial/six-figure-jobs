// app/jobs/4-day-week/page.tsx
// Six-figure jobs on a four-day week: reduced hours at full pay, as labelled by 4dayweek.io (lib/jobs/fourDayWeek.ts).
// Targets "4 day work week jobs" (asked for by the owner, 2026-11-09). Compressed weeks (40 hours in four days) are not
// four-day weeks and are not listed.

import type { Metadata } from 'next'
import { keywordsFor } from '@/lib/seo/keywordMap'
import Link from '@/components/ui/Link'

import { memoAsync } from '../../../lib/cache/memo'
import {
  FOUR_DAY_WEEK_MIN_JOBS_TO_INDEX,
  FOUR_DAY_WEEK_PATH,
  loadFourDayWeekListings,
  type FourDayWeekListing,
} from '../../../lib/jobs/fourDayWeek'
import { buildWhere, queryJobs, type JobWithCompany } from '../../../lib/jobs/queryJobs'
import { prisma } from '../../../lib/prisma'
import { rankTopRolePages } from '../../../lib/roles/topRolePages'
import { isPhaseIndexable } from '../../../lib/seo/indexingPhase'
import { buildDescription, buildListingTitle, freshnessClosing } from '../../../lib/seo/metaText'
import { buildItemListJsonLd } from '../../../lib/seo/itemListJsonLd'
import { SITE_NAME, defaultOgImages, getSiteUrl } from '../../../lib/seo/site'
import JobList from '../../components/JobList'
import styles from './page.module.css'

export const revalidate = 600

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 40

type SearchParams = Record<string, string | string[] | undefined>

function parsePage(sp: SearchParams): number {
  return Math.max(1, Number((sp.page as string) || '1') || 1)
}

/** How many four-day-week jobs there are, how many are remote, and the roles with the most of them (cached 1 hour). */
function loadCounts(listings: readonly FourDayWeekListing[]) {
  return memoAsync(`four-day-week-counts:${listings.length}`, 60 * 60 * 1000, async () => {
    const where = buildWhere({ fourDayWeek: listings })
    const [open, remote, groups] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.count({ where: buildWhere({ fourDayWeek: listings, remoteMode: 'remote' }) }),
      prisma.job.groupBy({
        by: ['roleSlug'],
        where: { AND: [where, { roleSlug: { not: null } }] },
        _count: { _all: true },
        orderBy: { _count: { roleSlug: 'desc' } },
        take: 60,
      }),
    ])
    const roles = rankTopRolePages(groups.map((g) => ({ roleSlug: g.roleSlug, count: g._count._all })), { limit: 8, minJobs: 2 })
    return { open, remote, roles }
  })
}

function buildFaq(open: number, remote: number) {
  return [
    {
      q: 'What is a 4-day work week job?',
      a: 'A job where you work four days a week for full-time pay, with fewer hours: most of these jobs are 32 hours a week, and nearly all the rest 34 to 37. It is not the same as a compressed week, where the usual 40 hours are fitted into four longer days; compressed weeks are not listed here.',
    },
    {
      q: 'Are there 4-day week jobs that pay $100k or more?',
      a:
        open > 0
          ? `Yes. Right now ${open.toLocaleString('en-US')} four-day-week jobs on ${SITE_NAME} publish a salary of $100k or more (or the local equivalent, such as £75k or €80k)${remote > 0 ? `, and ${remote.toLocaleString('en-US')} of them are remote` : ''}.`
          : `Some do. This page lists the four-day-week jobs on ${SITE_NAME} that publish a salary of $100k or more (or the local equivalent).`,
    },
    {
      q: 'How do you know a job is a 4-day week?',
      a: 'We list a job here only when 4dayweek.io labels it a four-day week (reduced hours at full pay) and the hours are under 40. Each job keeps that label only while the listing is live there. Check the hours and the pay in the full posting before you apply.',
    },
    {
      q: 'Is the pay lower on a 4-day week?',
      a: 'Not for the jobs listed here: a four-day week in this sense keeps full-time pay for fewer hours. Every job on this page shows its published salary range.',
    },
  ]
}

export async function generateMetadata({ searchParams }: { searchParams?: Promise<SearchParams> }): Promise<Metadata> {
  const sp = (await searchParams) || {}
  const page = parsePage(sp)

  let open = 0
  try {
    open = (await loadCounts(await loadFourDayWeekListings())).open
  } catch (error) {
    void error
  }

  const title = buildListingTitle({ topic: '4-Day Work Week Jobs', count: open, qualifier: 'Paying $100k+' })
  const description = buildDescription(
    'Four-day work week jobs paying $100k+: reduced hours at full pay, with the salary on every listing.',
    [['Remote and on-site roles.']],
    freshnessClosing(open),
  )
  const canonical = page > 1 ? `${SITE_URL}${FOUR_DAY_WEEK_PATH}?page=${page}` : `${SITE_URL}${FOUR_DAY_WEEK_PATH}`

  // Indexable when the phase allows it (ALWAYS_INDEXABLE_HUBS), it has enough jobs not to be thin, and it is page 1.
  const allowIndex =
    page === 1 && isPhaseIndexable({ pathname: FOUR_DAY_WEEK_PATH }) && open >= FOUR_DAY_WEEK_MIN_JOBS_TO_INDEX

  return {
    title,
    description,
    keywords: keywordsFor('fourDayWeek'),
    alternates: { canonical },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { images: defaultOgImages(), title, description, url: canonical, siteName: SITE_NAME, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function FourDayWeekJobsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = (await searchParams) || {}
  const page = parsePage(sp)

  const listings = await loadFourDayWeekListings()
  const [result, counts] = await Promise.all([
    // Highest pay first: stable, and the first import adds every job at once, so "newest added" would mean nothing.
    // Cached like the counts: matching our jobs against every listing took ~3.5 s on each visit (2026-11-11).
    memoAsync(`four-day-week-page:${listings.length}:${page}`, 10 * 60 * 1000, () =>
      queryJobs({ page, pageSize: PAGE_SIZE, sortBy: 'salary', fourDayWeek: listings }),
    ),
    loadCounts(listings),
  ])

  const jobs = result.jobs as JobWithCompany[]
  const { total, totalPages } = result
  const faq = buildFaq(counts.open, counts.remote)

  const itemListJsonLd = buildItemListJsonLd({
    name: `4-day work week jobs paying $100k+ on ${SITE_NAME}`,
    jobs: jobs.map((j) => ({ id: j.id, title: j.title })),
    page,
    pageSize: PAGE_SIZE,
  })
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${SITE_URL}/jobs` },
      { '@type': 'ListItem', position: 3, name: '4-day work week jobs', item: `${SITE_URL}${FOUR_DAY_WEEK_PATH}` },
    ],
  }

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link href="/">Home</Link>
        <span aria-hidden="true">›</span>
        <Link href="/jobs">Jobs</Link>
        <span aria-hidden="true">›</span>
        <span>4-day work week</span>
      </nav>

      <header className={styles.hero}>
        <p className={`eyebrow-pill ${styles.eyebrow}`}>Reduced hours · full pay</p>
        <h1 className={styles.title}>
          4-day work week jobs <span className={styles.accent}>paying $100k+</span>
        </h1>
        <p className={styles.lede}>
          {total.toLocaleString('en-US')} jobs where you work four days a week, with fewer hours (most are 32 a week),
          for a full salary. Every one publishes its pay. Compressed weeks (40 hours in four days) are left out.
        </p>
        <dl className={styles.stats}>
          <div>
            <dt>Open jobs</dt>
            <dd>{counts.open.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>Remote</dt>
            <dd>{counts.remote.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>Most common week</dt>
            <dd>32 hours</dd>
          </div>
        </dl>
      </header>

      {counts.roles.length > 0 ? (
        <section className={styles.section} aria-labelledby="fdw-roles">
          <h2 id="fdw-roles" className={styles.h2}>
            Roles with the most 4-day week jobs
          </h2>
          <ul className={styles.chips}>
            {counts.roles.map((r) => (
              <li key={r.slug}>
                <Link href={`/jobs/${r.slug}`} className={styles.chip}>
                  {r.label} <span className={styles.chipCount}>{r.count.toLocaleString('en-US')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="fdw-jobs">
        <h2 id="fdw-jobs" className={styles.h2}>
          Live 4-day week jobs: {total.toLocaleString('en-US')} openings
        </h2>
        {jobs.length > 0 ? (
          <JobList jobs={jobs} headingLevel={3} />
        ) : (
          <p className={styles.empty}>
            No four-day-week jobs paying $100k+ are open right now. New ones are added every day; meanwhile, see{' '}
            <Link href="/remote">remote $100k+ jobs</Link>.
          </p>
        )}
        {totalPages > 1 ? (
          <nav aria-label="Pagination" className={styles.pagination}>
            {page > 1 ? <Link href={page - 1 > 1 ? `${FOUR_DAY_WEEK_PATH}?page=${page - 1}` : FOUR_DAY_WEEK_PATH}>← Previous</Link> : null}
            <span>
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? <Link href={`${FOUR_DAY_WEEK_PATH}?page=${page + 1}`}>Next →</Link> : null}
          </nav>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="fdw-what">
        <h2 id="fdw-what" className={styles.h2}>
          What counts as a 4-day week here
        </h2>
        <div className={styles.compare}>
          <div className={`${styles.card} ${styles.cardYes}`}>
            <h3>Listed: a true 4-day week</h3>
            <p>Four working days and fewer hours (most often 32 a week), with full-time pay. The fifth day is off.</p>
          </div>
          <div className={styles.card}>
            <h3>Not listed: a compressed week</h3>
            <p>The same 40 hours squeezed into four 10-hour days. Same hours, longer days.</p>
          </div>
          <div className={styles.card}>
            <h3>Not listed: a 9/80 schedule</h3>
            <p>80 hours over nine days, so every other Friday is off. Same hours over two weeks.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="fdw-faq">
        <h2 id="fdw-faq" className={styles.h2}>
          Frequently asked questions
        </h2>
        <div className={styles.faq}>
          {faq.map(({ q, a }) => (
            <div key={q} className={styles.faqItem}>
              <h3>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
        </div>
      </section>

      <p className={styles.credit}>
        Four-day-week labels from{' '}
        <a href="https://4dayweek.io" rel="noopener">
          4dayweek.io
        </a>
        , the job board for reduced-hours roles.
      </p>

      <section className={styles.section} aria-labelledby="fdw-more">
        <h2 id="fdw-more" className={styles.h2}>
          More high-paying job searches
        </h2>
        <ul className={styles.chips}>
          {[
            { href: '/remote', label: 'Remote $100k+ jobs' },
            { href: '/high-paying-jobs', label: 'High-paying jobs ranked by pay' },
            { href: '/jobs/no-degree', label: 'Jobs without a degree' },
            { href: '/jobs/visa-sponsorship', label: 'Visa sponsorship jobs' },
            { href: '/jobs/200k-plus', label: '$200k+ jobs' },
            { href: '/salary', label: 'Salary guides' },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={styles.chip}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
