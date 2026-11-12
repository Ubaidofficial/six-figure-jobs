import type { ReactNode } from 'react'
import Link from 'next/link'

import { SearchBar } from '@/components/search/SearchBar'
import { CountryFlag } from '@/components/ui/CountryFlag'
import { HIGH_SALARY_THRESHOLDS } from '@/lib/currency/thresholds'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'
import type { SalarySnapshot } from '@/lib/jobs/salarySnapshot'
import { FLOOR_MARKET_COUNTRIES } from '@/lib/jobs/remoteRegions'
import { countInCountries, type SiteCounts } from '@/lib/jobs/siteCounts'
import type { FeedItem } from '@/lib/jobs/latestFeed'

import { HeroSalaryBands } from './HeroSalaryBands'
import styles from './Hero.module.css'
import { formatRelativeTime } from '@/lib/utils/time'

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
  { market: 'United States', flag: 'US', currency: 'USD', href: '/jobs/location/united-states' },
  { market: 'United Kingdom', flag: 'GB', currency: 'GBP', href: '/jobs/location/united-kingdom' },
  { market: 'Europe', flag: 'EU', currency: 'EUR', href: '/remote?remoteRegion=europe', title: 'Remote jobs in Europe' },
  { market: 'Canada', flag: 'CA', currency: 'CAD', href: '/jobs/location/canada' },
  { market: 'Australia', flag: 'AU', currency: 'AUD', href: '/jobs/location/australia' },
] as const

/**
 * A salary band opens the jobs paying at least its lower edge: a salary tier page where its range covers the band
 * ($100k-$199k for $100k-$150k, $200k-$299k for $200k-$300k, $400k+), otherwise /jobs?minSalary=. The open "$300k+" band
 * must not open the $300k-$399k page, which leaves out $400k+ jobs.
 */
function bandHref(min: number): string {
  return [100_000, 200_000, 400_000].includes(min) ? `/jobs/${min / 1000}k-plus` : `/jobs?minSalary=${min}`
}

/** "3h ago", the same style as the job rows. The newest job is the first of the "Most Recent" list (by posting date). */
function formatNewest(iso: string | null | undefined): string | null {
  return iso ? formatRelativeTime(iso) : null
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
      <p className={`eyebrow-pill ${styles.eyebrow}`}>
        <span className="eyebrow-pill-icon" aria-hidden="true">$</span>
        <Link href="/jobs/location/united-states"><CountryFlag code="US" className="mr-1.5" />US</Link> ·{' '}
        <Link href="/jobs/location/united-kingdom"><CountryFlag code="GB" className="mr-1.5" />UK</Link> ·{' '}
        <Link href="/remote?remoteRegion=europe" title="Remote jobs in Europe"><CountryFlag code="EU" className="mr-1.5" />EU</Link> ·{' '}
        <Link href="/jobs/location/canada"><CountryFlag code="CA" className="mr-1.5" />Canada</Link> ·{' '}
        <Link href="/jobs/location/australia"><CountryFlag code="AU" className="mr-1.5" />Australia</Link>
      </p>

      {/* Light + semibold weights in one headline (2026-11 refresh). The text is unchanged: "Six-figure jobs.No salary guessing." */}
      <h1 className={styles.headline}>
        <span className={styles.thin}>Six-figure</span> jobs.
        <span className={styles.accent}>
          <span className={styles.thin}>No salary</span> guessing.
        </span>
      </h1>

      <p className={styles.subheadline}>
        {jobCount.toLocaleString()} high-paying 6-figure roles
        {companyCount > 0 ? ` at ${companyCount.toLocaleString()} companies` : ''}. Every listing shows its pay range.
        Every apply button says where it goes: the employer&rsquo;s own site, or the job board the role was posted on.
      </p>

      <form className={styles.searchForm} method="GET" action="/jobs">
        <SearchBar id="hero-q" />

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
          {newest ? `newest posted ${newest}` : null}
        </p>
      ) : null}
      </div>

      {/* Salary snapshot card on the right of the copy from 1180px (under it at 1024-1179px, hidden on phones). */}
      <aside className={`panel-hairline ${styles.panel}`} aria-label="Typical salary and pay floors">
        <div className={styles.panelHead}>
          <div>
            <p className={styles.panelHeadTitle}>Salary snapshot</p>
            <p className={styles.panelHeadSub}>
              {salarySnapshot
                ? `Median of ${salarySnapshot.count.toLocaleString()} listings paid in USD`
                : `${jobCount.toLocaleString()} roles in ${FLOORS.length} markets`}
            </p>
          </div>
          {salarySnapshot ? (
            <dl className={styles.tiles}>
              <div className={styles.tile}>
                <dt>Typical salary</dt>
                <dd>{formatCurrencyShort(Math.round(salarySnapshot.median / 1000) * 1000, 'USD')}</dd>
              </div>
              <div className={styles.tile}>
                <dt>Most roles pay</dt>
                <dd>
                  {formatCurrencyShort(Math.round(salarySnapshot.p25 / 1000) * 1000, 'USD')}
                  {'\u2013'}
                  {formatCurrencyShort(Math.round(salarySnapshot.p75 / 1000) * 1000, 'USD')}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        <div className={styles.panelBody}>
          {salarySnapshot ? (
            <>
              <h2 className={styles.panelTitle}>Jobs by salary band</h2>
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

        <div className={styles.panelSplit}>
          <div>
            <h2 className={styles.panelTitle}>Pay floor by market</h2>
            <ul className={styles.floors}>
              {FLOORS.map((floor) => {
                const { market, flag, currency, href } = floor
                const jobs = siteCounts ? countInCountries(siteCounts.byCountry, FLOOR_MARKET_COUNTRIES[currency] ?? []) : null
                return (
                  <li key={currency}>
                    <Link href={href} className={styles.floor} title={'title' in floor ? floor.title : undefined}>
                      <span>
                        <CountryFlag code={flag} className="mr-2" />
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
          </div>

          {siteCounts ? (
            <div>
              <h2 className={styles.panelTitle}>Jobs by type</h2>
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
            </div>
          ) : null}
        </div>

        <div className={styles.panelFoot}>
          <p className={styles.panelNote}>
            {siteCounts ? `Counted ${formatCounted(siteCounts.computedAt)}; recounted about every hour.` : null}
          </p>
          <Link href="/salary" className="arrow-link">
            <span className="arrow-link-label">Salary guides by role</span>
            <span className="arrow-chip" aria-hidden="true">&#8599;</span>
          </Link>
        </div>
      </aside>
    </section>
  )
}
