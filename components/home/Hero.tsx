import type { ReactNode } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { HIGH_SALARY_THRESHOLDS } from '@/lib/currency/thresholds'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'
import type { SalarySnapshot } from '@/lib/jobs/salarySnapshot'
import { FLOOR_MARKET_COUNTRIES } from '@/lib/jobs/remoteRegions'
import { countInCountries, type SiteCounts } from '@/lib/jobs/siteCounts'
import type { FeedItem } from '@/lib/jobs/latestFeed'

import { HeroSalaryBands } from './HeroSalaryBands'
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
  /** Jobs per country and per job type, counted from the database (refreshed about every hour). */
  siteCounts?: SiteCounts | null
  /** Up to three recent roles per salary band of the snapshot (same order), shown when a band is picked. */
  bandSamples?: FeedItem[][] | null
  /** The role / location / work-mode / salary filters, rendered inside the search form. */
  children?: ReactNode
}

// Pay floors shown in the panel come from the same table the site filters with, so they cannot drift.
// `href` is where each market's row goes. There is no page for all Europe jobs yet, so Europe opens its remote jobs.
const FLOORS = [
  { market: 'United States', currency: 'USD', href: '/jobs/location/united-states' },
  { market: 'United Kingdom', currency: 'GBP', href: '/jobs/location/united-kingdom' },
  { market: 'Europe', currency: 'EUR', href: '/remote?remoteRegion=europe', title: 'Remote jobs in Europe' },
  { market: 'Canada', currency: 'CAD', href: '/jobs/location/canada' },
  { market: 'Australia', currency: 'AUD', href: '/jobs/location/australia' },
] as const

/**
 * A salary band opens the jobs paying at least its lower edge: a salary tier page where its range covers the band
 * ($100k-$199k for $100k-$150k, $200k-$299k for $200k-$300k, $400k+), otherwise /jobs?minSalary=. The open "$300k+" band
 * must not open the $300k-$399k page, which leaves out $400k+ jobs.
 */
function bandHref(min: number): string {
  return [100_000, 200_000, 400_000].includes(min) ? `/jobs/${min / 1000}k-plus` : `/jobs?minSalary=${min}`
}

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

export function Hero({ jobCount = 0, companyCount = 0, newThisWeek, newestPostedAtISO, salarySnapshot, siteCounts, bandSamples, children }: HeroProps) {
  const newest = formatNewest(newestPostedAtISO)

  return (
    <section className={styles.hero}>
      <div className={styles.main}>
      <p className={styles.eyebrow}>
        <Link href="/jobs/location/united-states">US</Link> · <Link href="/jobs/location/united-kingdom">UK</Link> ·{' '}
        <Link href="/remote?remoteRegion=europe" title="Remote jobs in Europe">EU</Link> · <Link href="/jobs/location/canada">Canada</Link> ·{' '}
        <Link href="/jobs/location/australia">Australia</Link>
      </p>

      <h1 className={styles.headline}>
        Six-figure jobs.
        <span className={styles.accent}>No salary guessing.</span>
      </h1>

      <p className={styles.subheadline}>
        {jobCount.toLocaleString()} high-paying 6-figure roles
        {companyCount > 0 ? ` at ${companyCount.toLocaleString()} companies` : ''}. Every listing shows its pay range.
        Every apply button says where it goes: the employer&rsquo;s own site, or the job board the role was posted on.
      </p>

      <form className={styles.searchForm} method="GET" action="/jobs">
        <div className={styles.searchBar}>
          <label className={styles.srOnly} htmlFor="hero-q">
            Search six-figure jobs
          </label>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <HeroSearchInput id="hero-q" name="q" placeholder="Job title, company or keyword" className={styles.searchInput} shortcut shortcutHint />
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
        <Link className={styles.quickLink} href="/jobs/4-day-week">
          4-day week
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
        <div className={styles.panelCol}>
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
            <HeroSalaryBands
              bands={salarySnapshot.bands.map((band, i) => ({
                label: band.label,
                count: band.count,
                href: bandHref(band.min),
                samples: bandSamples?.[i] ?? [],
              }))}
            />
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
        </div>

        <div className={`${styles.panelCol} ${styles.panelColSide}`}>
        <h2 className={`${styles.panelTitle} ${styles.panelTitleSpaced}`}>Pay floor by market</h2>
        <ul className={styles.floors}>
          {FLOORS.map((floor) => {
            const { market, currency, href } = floor
            const jobs = siteCounts ? countInCountries(siteCounts.byCountry, FLOOR_MARKET_COUNTRIES[currency] ?? []) : null
            return (
              <li key={currency}>
                <Link href={href} className={styles.floor} title={'title' in floor ? floor.title : undefined}>
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
                </Link>
              </li>
            )
          })}
        </ul>

        {siteCounts ? (
          <>
            <h2 className={`${styles.panelTitle} ${styles.panelTitleSpaced}`}>Jobs by type</h2>
            <ul className={styles.types}>
              {(
                [
                  ['Remote', siteCounts.byWorkType.remote, '/remote'],
                  ['Hybrid', siteCounts.byWorkType.hybrid, '/jobs?remoteMode=hybrid'],
                  ['On-site', siteCounts.byWorkType.onsite, '/jobs?remoteMode=onsite'],
                ] as const
              ).map(([label, count, href]) => (
                <li key={label}>
                  <Link href={href} className={styles.type}>
                    <span className={styles.typeLabel}>{label}</span>
                    <span className={styles.typeCount}>{count.toLocaleString()}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className={styles.panelNote}>
              Counted {formatCounted(siteCounts.computedAt)}; recounted about every hour.
            </p>
          </>
        ) : null}
        <Link href="/salary" className={styles.panelLink}>
          Salary guides by role <span aria-hidden="true">→</span>
        </Link>
        </div>
      </aside>
    </section>
  )
}
