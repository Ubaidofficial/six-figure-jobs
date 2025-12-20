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
            <span className={styles.gradientText}>Six-Figure</span>
            <br />
            <span>Opportunity</span>
          </h1>

          <p className={styles.subheadline} style={delay(240)}>
            Exclusively curated high-paying positions from{' '}
            <strong>{companyCount.toLocaleString()}</strong> verified companies. No entry-level
            clutter. Just premium opportunities.
          </p>

          <form className={styles.searchForm} action="/search" method="get" style={delay(360)}>
            <div className={styles.searchBar}>
              <label className={styles.srOnly} htmlFor="hero-q">
                Find your next six-figure job
              </label>
              <Search className={styles.searchIcon} aria-hidden="true" />
              <input
                id="hero-q"
                name="q"
                type="text"
                placeholder="Find roles, companies, or skills…"
                className={styles.searchInput}
                autoComplete="off"
                spellCheck={false}
              />
              <Button variant="primary" size="lg" type="submit" className={styles.cta}>
                Find six-figure jobs <span aria-hidden="true">→</span>
              </Button>
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
            <Link className={styles.popularLink} href="/search?q=Software%20Engineer">
              Software Engineer
            </Link>
            ,{' '}
            <Link className={styles.popularLink} href="/search?q=Product%20Manager">
              Product Manager
            </Link>
            ,{' '}
            <Link className={styles.popularLink} href="/search?q=Data%20Scientist">
              Data Scientist
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
