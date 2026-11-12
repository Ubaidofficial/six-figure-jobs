// Building blocks shared by every listing page. Server components; the toolbar/filters passed in are client components.
import type { ReactNode } from 'react'
import Link from '@/components/ui/Link'

import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { JobRow, JobRowList } from '@/components/jobs/JobRow'
import type { JobQueryInput, JobWithCompany } from '@/lib/jobs/queryJobs'
import { JobAlertBox } from '@/components/alerts/JobAlertBox'
import { pageLinkNumbers } from '@/lib/listing/pageNumbers'

import styles from './Listing.module.css'
import { toPublicJob } from '@/lib/jobs/publicJob'

export type ListingChip = {
  label: string
  href: string
  active?: boolean
  /** Filter toggles should not be crawled. */
  nofollow?: boolean
  count?: number
  /** Small company logo shown before the label. */
  logo?: ReactNode
}

/** Row of pill links: filters, related pages, cities, skills, companies. */
export function LinkChips({ items, label }: { items: ListingChip[]; label: string }) {
  if (items.length === 0) return null
  return (
    <ul className={styles.chips} aria-label={label}>
      {items.map((c) => (
        <li key={c.href + c.label}>
          <Link
            href={c.href}
            className={styles.chip}
            aria-current={c.active ? 'true' : undefined}
            rel={c.nofollow ? 'nofollow' : undefined}
            scroll={c.nofollow ? false : undefined}
          >
            {c.logo}
            {c.label}
            {c.count != null ? <span className={styles.chipCount}>{c.count.toLocaleString()}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function Accent({ children }: { children: ReactNode }) {
  return <span className={styles.accent}>{children}</span>
}

export function ListingPage({ children }: { children: ReactNode }) {
  return <main className={styles.page}>{children}</main>
}

export type ListingStat = {
  label: string
  href: string
  count: number
  /** Filter toggles should not be crawled. */
  nofollow?: boolean
}

/** Breadcrumb, H1, one summary line, optional action row, related-page chips, optional toolbar (sort/filters). */
export function ListingHeader({
  breadcrumb,
  title,
  accent,
  summary,
  cta,
  stats,
  chips,
  related,
  toolbar,
  aside,
  search,
}: {
  breadcrumb: Array<{ label: string; href?: string }>
  title: ReactNode
  /** Part of the title shown in the accent colour. */
  accent?: ReactNode
  summary?: ReactNode
  /** Primary button under the summary, e.g. "Browse 120 jobs"; jumps to the results (`#jobs`). */
  cta?: string
  /** Counted links beside the button: "42 remote roles". Only those with a count above zero are shown. */
  stats?: ListingStat[]
  chips?: ListingChip[]
  /** A second, labelled chip row under `chips`, e.g. "Trending in Marketing". */
  related?: { label: string; items: ListingChip[] }
  toolbar?: ReactNode
  /** A white card at the right of the header, e.g. <ListingSalaryAside />. Renders nothing when it has no data. */
  aside?: ReactNode
  /** A search form shown centred under the header, across its full width (e.g. <ListingSearch />, its own file). */
  search?: ReactNode
}) {
  return (
    <header className={`${styles.header} ${aside ? styles.headerWithAside : ''}`}>
      <div className={styles.headerMain}>
        <Breadcrumb items={breadcrumb} />
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>
              {accent ? <span className={styles.accent}>{accent}</span> : null}
              {accent ? ' ' : null}
              {title}
            </h1>
            {summary ? <p className={styles.summary}>{summary}</p> : null}
          </div>
          {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}
        </div>
        {cta || stats?.some((s) => s.count > 0) ? (
          <div className={styles.heroActions}>
            {cta ? (
              <a href="#jobs" className={styles.cta}>
                {cta}
                <span aria-hidden="true">↓</span>
              </a>
            ) : null}
            {stats
              ?.filter((s) => s.count > 0)
              .map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className={styles.stat}
                  rel={s.nofollow ? 'nofollow' : undefined}
                  scroll={s.nofollow ? false : undefined}
                >
                  <strong>{s.count.toLocaleString()}</strong> {s.label}
                </Link>
              ))}
          </div>
        ) : null}
        {chips ? <LinkChips items={chips} label="Related pages" /> : null}
        {related && related.items.length > 0 ? (
          <div className={styles.headerRelated}>
            <p className={styles.headerRelatedLabel}>{related.label}</p>
            <LinkChips items={related.items} label={related.label} />
          </div>
        ) : null}
      </div>
      {aside}
      {search ? <div className={styles.headerSearch}>{search}</div> : null}
    </header>
  )
}

/** Left filters + results column. */
export function ListingLayout({
  sidebar,
  bar,
  alert,
  children,
}: {
  sidebar?: ReactNode
  /** Above the results: the match count and active filters (ActiveFilters). */
  bar?: ReactNode
  /** The page's job query: offers an email alert for it above the results (nothing while alerts are off). */
  alert?: JobQueryInput
  children: ReactNode
}) {
  return (
    <div className={sidebar ? styles.layout : undefined}>
      {sidebar ? (
        <aside className={styles.sidebar} aria-label="Filters">
          {sidebar}
        </aside>
      ) : null}
      <div id="jobs" className={styles.results}>
        {bar}
        {alert ? <JobAlertBox query={alert} /> : null}
        {children}
      </div>
    </div>
  )
}

export function ResultsCount({ children }: { children: ReactNode }) {
  return <p className={styles.count}>{children}</p>
}

export function JobRows({
  jobs,
  empty,
}: {
  jobs: JobWithCompany[]
  empty?: { title: string; body: string; href?: string; hrefLabel?: string }
}) {
  if (jobs.length === 0) {
    return (
      <div className={styles.empty} role="status">
        <p className={styles.emptyTitle}>{empty?.title ?? 'No jobs found.'}</p>
        <p>{empty?.body ?? 'Try adjusting your filters.'}</p>
        {empty?.href ? (
          <p style={{ marginTop: 12 }}>
            <Link className={styles.pageLink} href={empty.href}>
              {empty.hrefLabel ?? 'Clear filters'}
            </Link>
          </p>
        ) : null}
      </div>
    )
  }
  return (
    <JobRowList>
      {jobs.map(toPublicJob).map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </JobRowList>
  )
}

export function Pagination({
  page,
  totalPages,
  hrefFor,
  numbered = false,
}: {
  page: number
  totalPages: number
  hrefFor: (page: number) => string
  /** Also link numbered pages (first, last, a window and jumps), so a crawler reaches deep pages in a few clicks. */
  numbered?: boolean
}) {
  if (totalPages <= 1) return null
  const numbers = numbered ? pageLinkNumbers(page, totalPages) : []
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <span>
        Page <strong>{page}</strong> of <strong>{totalPages}</strong>
      </span>
      <span className={styles.pageLinks}>
        {page > 1 ? (
          <Link className={styles.pageLink} href={hrefFor(page - 1)} scroll={false} rel="prev">
            Previous
          </Link>
        ) : null}
        {numbers.map((n, i) => (
          <span key={n} className={styles.pageNumberItem}>
            {i > 0 && n - numbers[i - 1] > 1 ? <span className={styles.pageGap} aria-hidden="true">…</span> : null}
            {n === page ? (
              <span className={`${styles.pageLink} ${styles.pageCurrent}`} aria-current="page">
                {n}
              </span>
            ) : (
              <Link className={styles.pageLink} href={hrefFor(n)} scroll={false} aria-label={`Page ${n}`}>
                {n}
              </Link>
            )}
          </span>
        ))}
        {page < totalPages ? (
          <Link className={styles.pageLink} href={hrefFor(page + 1)} scroll={false} rel="next">
            Next
          </Link>
        ) : null}
      </span>
    </nav>
  )
}

export function ListingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={title} data-reveal="">
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className={styles.prose}>{children}</div>
}

/** Visible FAQ. Must stay in sync with the page's FAQPage JSON-LD (pass the same items to both). */
export function Faq({ items }: { items: Array<{ question: string; answer: string }> }) {
  return (
    <dl className={styles.faq}>
      {items.map((item) => (
        <div key={item.question} className={styles.faqItem}>
          <dt className={styles.faqQuestion}>{item.question}</dt>
          <dd className={styles.faqAnswer}>{item.answer}</dd>
        </div>
      ))}
    </dl>
  )
}
