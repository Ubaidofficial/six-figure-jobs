import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import NextImage from 'next/image'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'

import styles from './Hero.module.css'

export type HeroCompanyLogo = {
  slug: string
  name: string
  logoUrl: string | null
}

type HeroProps = {
  jobCount?: number
  companyCount?: number
  countryCount?: number
  newThisWeek?: number
  // Top 6-8 hiring company logos rendered above the fold as a trust strip
  // (the remoteyeah pattern — "these real companies trust this site").
  companyLogos?: HeroCompanyLogo[]
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
  companyLogos,
  children,
}: HeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.content}>
          <div className={styles.badge} style={delay(0)}>
            <span className={styles.liveOrb} aria-hidden="true" />
            <span>
              {jobCount.toLocaleString()} verified $100k+ jobs • Updated daily
            </span>
          </div>

          <h1 className={styles.headline} style={delay(120)}>
            <span>The Premium Job Board for</span>
            <br />
            <span className={styles.gradientText}>Six Figure Jobs</span>
            <br />
            <span>with Published Salaries</span>
          </h1>

          <p className={styles.subheadline} style={delay(240)}>
            Browse <strong>{jobCount.toLocaleString()}+</strong> verified $100k+ roles from{' '}
            <strong>{companyCount.toLocaleString()}</strong> companies. Salary ranges, work mode,
            and apply paths are shown upfront so you can move from search to application faster.
          </p>

          <form
            className={styles.searchForm}
            style={delay(360)}
            method="GET"
            action="/jobs"
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
                  placeholder="Try: software engineer, remote, $200k..."
                  className={styles.searchInput}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button variant="primary" size="lg" type="submit" className={styles.cta}>
                  Search jobs <span aria-hidden="true">→</span>
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
            <span className={styles.popularLabel}>Quick filters:</span>{' '}
            <Link className={styles.popularLink} href="/remote">
              Remote $100k+
            </Link>
            ,{' '}
            <Link className={styles.popularLink} href="/jobs/200k-plus">
              $200k+ jobs
            </Link>
            ,{' '}
            <Link className={styles.popularLink} href="/jobs/no-degree">
              No-degree roles
            </Link>
            ,{' '}
            <Link className={styles.popularLink} href="/jobs/visa-sponsorship">
              Visa sponsorship
            </Link>
          </p>

          {typeof newThisWeek === 'number' ? (
            <p className={styles.helper} style={delay(520)}>
              <span className={styles.helperStrong}>{newThisWeek.toLocaleString()}</span> new this
              week • Updated daily
            </p>
          ) : null}

          {companyLogos && companyLogos.length > 0 ? (
            <div
              className={styles.logoStrip}
              style={delay(560)}
              aria-label="Companies actively hiring on Six Figure Jobs"
            >
              <span className={styles.logoStripLabel}>Companies hiring now</span>
              <ul className={styles.logoStripList}>
                {companyLogos.slice(0, 8).map((c) => (
                  <li key={c.slug} className={styles.logoStripItem}>
                    <Link
                      href={`/company/${c.slug}`}
                      className={styles.logoStripLink}
                      title={c.name}
                    >
                      {c.logoUrl ? (
                        <NextImage
                          src={c.logoUrl}
                          alt={c.name}
                          width={88}
                          height={32}
                          className={styles.logoStripImg}
                          unoptimized
                        />
                      ) : (
                        <span className={styles.logoStripFallback}>{c.name}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
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
