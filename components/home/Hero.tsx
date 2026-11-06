import type { ReactNode } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { HIGH_SALARY_THRESHOLDS } from '@/lib/currency/thresholds'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'
import type { SalarySnapshot } from '@/lib/jobs/salarySnapshot'
import { FLOOR_MARKET_COUNTRIES } from '@/lib/jobs/remoteRegions'
import { countInCountries, type SiteCounts } from '@/lib/jobs/siteCounts'

import { HeroSearchInput } from './HeroSearchInput'
import styles from './Hero.module.css'

type HeroProps = {
  jobCount?: number
  companyCount?: number
  newThisWeek?: number
  /** Posting date of the newest listing. Shown as a date, never as "updated daily". */
  newestPostedAtISO?: string | null
  /** Median and spread of USD listings; when missing the panel shows plain counts instead. */
  salarySnapshot?: SalarySnapshot | null
  /** Jobs per country and per job type, counted from the database (refreshed about every 6 hours). */
  siteCounts?: SiteCounts | null
  /** The role / location / work-mode / salary filters, rendered inside the search form. */
  children?: ReactNode
}

// Pay floors shown in the panel come from the same table the site filters with, so they cannot drift.
const FLOORS = [
  { market: 'United States', currency: 'USD' },
  { market: 'United Kingdom', currency: 'GBP' },
  { market: 'Europe', currency: 'EUR' },
  { market: 'Canada', currency: 'CAD' },
  { market: 'Australia', currency: 'AUD' },
] as const

function formatNewest(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function formatCounted(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'recently'
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  return `${day}, ${time} UTC`
}

export function Hero({ jobCount = 0, companyCount = 0, newThisWeek, newestPostedAtISO, salarySnapshot, siteCounts, children }: HeroProps) {
  const newest = formatNewest(newestPostedAtISO)

  return (
    <section className={styles.hero}>
      <div className={styles.main}>
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
          <HeroSearchInput id="hero-q" name="q" placeholder="Job title, company or keyword" className={styles.searchInput} />
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
      </div>

      <aside className={styles.panel} aria-label="Typical salary and pay floors">
        {salarySnapshot ? (
          <>
            <h2 className={styles.panelTitle}>Typical salary</h2>
            <p className={styles.bigNumber}>{formatCurrencyShort(Math.round(salarySnapshot.median / 1000) * 1000, 'USD')}</p>
            <p className={styles.bigNote}>
              Most roles pay {formatCurrencyShort(Math.round(salarySnapshot.p25 / 1000) * 1000, 'USD')}
              {'\u2013'}
              {formatCurrencyShort(Math.round(salarySnapshot.p75 / 1000) * 1000, 'USD')}. Median of{' '}
              {salarySnapshot.count.toLocaleString()} listings paid in USD.
            </p>
            <ul className={styles.bars} aria-label="Listings by salary band">
              {salarySnapshot.bands.map((band) => {
                const max = Math.max(...salarySnapshot.bands.map((x) => x.count), 1)
                return (
                  <li key={band.label} className={styles.barRow}>
                    <span className={styles.barLabel}>{band.label}</span>
                    <span className={styles.barTrack} aria-hidden="true">
                      <span className={styles.barFill} style={{ width: `${Math.max(4, (band.count / max) * 100)}%` }} />
                    </span>
                    <span className={styles.barCount}>{band.count.toLocaleString()}</span>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Roles</dt>
              <dd>{jobCount.toLocaleString()}</dd>
            </div>
            {companyCount > 0 ? (
              <div className={styles.stat}>
                <dt>Companies</dt>
                <dd>{companyCount.toLocaleString()}</dd>
              </div>
            ) : null}
            <div className={styles.stat}>
              <dt>Markets</dt>
              <dd>{FLOORS.length}</dd>
            </div>
          </dl>
        )}

        <h2 className={`${styles.panelTitle} ${styles.panelTitleSpaced}`}>Pay floor by market</h2>
        <ul className={styles.floors}>
          {FLOORS.map(({ market, currency }) => {
            const jobs = siteCounts ? countInCountries(siteCounts.byCountry, FLOOR_MARKET_COUNTRIES[currency] ?? []) : null
            return (
              <li key={currency} className={styles.floor}>
                <span>
                  {market}
                  {jobs !== null ? (
                    <span className={styles.floorJobs}>
                      {' '}
                      {jobs.toLocaleString()} {jobs === 1 ? 'job' : 'jobs'}
                    </span>
                  ) : null}
                </span>
                <span className={styles.floorValue}>
                  {formatCurrencyShort(Number(HIGH_SALARY_THRESHOLDS[currency]), currency)}+
                </span>
              </li>
            )
          })}
        </ul>

        {siteCounts ? (
          <>
            <h2 className={`${styles.panelTitle} ${styles.panelTitleSpaced}`}>Jobs by type</h2>
            <ul className={styles.floors}>
              {(
                [
                  ['Remote', siteCounts.byWorkType.remote],
                  ['Hybrid', siteCounts.byWorkType.hybrid],
                  ['On-site', siteCounts.byWorkType.onsite],
                ] as const
              ).map(([label, count]) => (
                <li key={label} className={styles.floor}>
                  <span>{label}</span>
                  <span className={styles.floorValue}>{count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <p className={styles.panelNote}>
              Counted {formatCounted(siteCounts.computedAt)}; recounted about every 6 hours.
            </p>
          </>
        ) : null}
        <Link href="/salary" className={styles.panelLink}>
          Salary guides by role <span aria-hidden="true">→</span>
        </Link>
      </aside>
    </section>
  )
}
