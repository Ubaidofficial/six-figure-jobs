import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'

import styles from './Hero.module.css'

type HeroProps = {
  jobCount?: number
  companyCount?: number
  countryCount?: number
  newThisWeek?: number
  children?: ReactNode
}

function delay(ms: number) {
  return { ['--d' as any]: `${ms}ms` } as CSSProperties
}

export function Hero({
  jobCount = 21_037,
  companyCount = 2_643,
  countryCount = 10,
  newThisWeek,
  children,
}: HeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.content}>
          <div className={styles.badge} style={delay(0)}>
            <span aria-hidden="true">🚀</span>{' '}
            <span>
              {jobCount.toLocaleString()} Premium Jobs • $100k+ USD
            </span>
          </div>

          <h1 className={styles.headline} style={delay(120)}>
            <span>Find Your Next </span>
            <span className={styles.gradientText}>6 Figure Jobs</span>
            <span> & </span>
            <span>Six-Figure</span>
            <br />
            <span>Opportunities</span>
          </h1>

          <p className={styles.subheadline} style={delay(240)}>
            Discover verified $100k+ jobs, six figure salary jobs, and high paying roles from{' '}
            <strong>{companyCount.toLocaleString()}</strong> companies. Browse remote, hybrid,
            and on-site opportunities with published salary ranges, fresh listings, and no
            entry-level clutter.
          </p>

          <form
            className={styles.searchForm}
            style={delay(360)}
            method="GET"
            action="/search"
          >
            <div className={styles.searchWrapper}>
              <div className={styles.searchBar}>
                <label className={styles.srOnly} htmlFor="hero-q">
                  Find your next six-figure job
                </label>
                <Search className={styles.searchIcon} aria-hidden="true" />
                <input
                  id="hero-q"
                  name="q"
                  type="text"
                  placeholder="Try: 6 figure jobs, software engineer, remote..."
                  className={styles.searchInput}
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
                <Button variant="primary" size="lg" type="submit" className={styles.cta}>
                  Find six-figure jobs <span aria-hidden="true">→</span>
                </Button>
              </div>
            </div>

            {children ? (
              <details className={styles.advancedDetails}>
                <summary className={styles.advancedSummary}>Advanced filters</summary>
                <div className={styles.advancedPanel}>{children}</div>
              </details>
            ) : null}
          </form>

          <p className={styles.popular} style={delay(480)}>
            <span className={styles.popularLabel}>Popular:</span>{' '}
            <Link className={styles.popularLink} href="/search?q=6%20Figure%20Jobs">
              6 Figure Jobs
            </Link>
            ,{' '}
            <Link className={styles.popularLink} href="/search?q=Six%20Figure%20Remote%20Jobs">
              Six Figure Remote Jobs
            </Link>
            ,{' '}
            <Link className={styles.popularLink} href="/search?q=Easy%206%20Figure%20Jobs">
              Easy 6 Figure Jobs
            </Link>
            ,{' '}
            <Link className={styles.popularLink} href="/search?q=High%20Paying%20Jobs%20No%20Degree">
              High Paying Jobs No Degree
            </Link>
          </p>

          {typeof newThisWeek === 'number' ? (
            <p className={styles.helper} style={delay(520)}>
              <span className={styles.helperStrong}>{newThisWeek.toLocaleString()}</span> new this
              week • Updated daily
            </p>
          ) : null}

          <div className={styles.stats} style={delay(600)}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{jobCount.toLocaleString()}</div>
              <div className={styles.statLabel}>Active Jobs</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{companyCount.toLocaleString()}</div>
              <div className={styles.statLabel}>Companies</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>$100k+</div>
              <div className={styles.statLabel}>Starting From</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{countryCount}</div>
              <div className={styles.statLabel}>Countries</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
