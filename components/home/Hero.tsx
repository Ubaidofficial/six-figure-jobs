import type { ReactNode } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'

import styles from './Hero.module.css'

type HeroProps = {
  jobCount?: number
  companyCount?: number
  newThisWeek?: number
  /** Posting date of the newest listing. Shown as a date, never as "updated daily". */
  newestPostedAtISO?: string | null
  /** The role / location / work-mode / salary filters, rendered inside the search form. */
  children?: ReactNode
}

function formatNewest(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function Hero({ jobCount = 0, companyCount = 0, newThisWeek, newestPostedAtISO, children }: HeroProps) {
  const newest = formatNewest(newestPostedAtISO)

  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>US · UK · EU · Canada · Australia</p>

      <h1 className={styles.headline}>
        Six-figure jobs.
        <span className={styles.accent}>No salary guessing.</span>
      </h1>

      <p className={styles.subheadline}>
        {jobCount.toLocaleString()} roles
        {companyCount > 0 ? ` at ${companyCount.toLocaleString()} companies` : ''}, every one with its pay
        range on the listing. Pay thresholds are set per currency, and every apply button goes to the
        employer&rsquo;s own application page.
      </p>

      <form className={styles.searchForm} method="GET" action="/jobs">
        <div className={styles.searchBar}>
          <label className={styles.srOnly} htmlFor="hero-q">
            Search six-figure jobs
          </label>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            id="hero-q"
            name="q"
            type="text"
            placeholder="Job title, company or keyword"
            className={styles.searchInput}
            autoComplete="off"
            spellCheck={false}
          />
          <Button variant="primary" size="lg" type="submit" className={styles.cta}>
            Search jobs
          </Button>
        </div>

        {children ? <div className={styles.filters}>{children}</div> : null}
      </form>

      <p className={styles.quick}>
        <span className={styles.quickLabel}>Popular:</span>
        <Link className={styles.quickLink} href="/remote">
          Remote $100k+
        </Link>
        <Link className={styles.quickLink} href="/jobs/200k-plus">
          $200k+
        </Link>
        <Link className={styles.quickLink} href="/jobs/no-degree">
          No degree required
        </Link>
        <Link className={styles.quickLink} href="/jobs/visa-sponsorship">
          Visa sponsorship
        </Link>
      </p>

      {newest || (typeof newThisWeek === 'number' && newThisWeek > 0) ? (
        <p className={styles.freshness}>
          {typeof newThisWeek === 'number' && newThisWeek > 0
            ? `${newThisWeek.toLocaleString()} new this week`
            : null}
          {typeof newThisWeek === 'number' && newThisWeek > 0 && newest ? ' · ' : null}
          {newest ? `Newest listing posted ${newest}` : null}
        </p>
      ) : null}
    </section>
  )
}
