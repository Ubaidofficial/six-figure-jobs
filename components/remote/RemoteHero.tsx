import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'

import styles from './RemoteHero.module.css'

type RemoteHeroProps = {
  remoteJobCount: number
  companyCount: number
  countryCount: number
  avgSalaryUsd: number | null
  activeRemoteRegion: string | null
}

function delay(ms: number) {
  return { ['--d' as any]: `${ms}ms` } as CSSProperties
}

function formatUsdAnnual(avgUsd: number | null): string {
  if (!avgUsd || !Number.isFinite(avgUsd)) return '—'
  return `$${Math.round(avgUsd / 1000)}k`
}

const FILTERS: Array<{ key: string; label: string; remoteRegion: string | null }> = [
  { key: 'remote-only', label: 'Remote Only', remoteRegion: null },
  { key: 'worldwide', label: 'Worldwide', remoteRegion: 'global' },
  { key: 'us', label: 'US Remote', remoteRegion: 'us-only' },
  { key: 'eu', label: 'EU Remote', remoteRegion: 'emea' },
  { key: 'apac', label: 'APAC Remote', remoteRegion: 'apac' },
]

export function RemoteHero({
  remoteJobCount,
  companyCount,
  countryCount,
  avgSalaryUsd,
  activeRemoteRegion,
}: RemoteHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.content}>
          <div className={styles.badge} style={delay(0)}>
            <span aria-hidden="true">🌍</span> <span>Work From Anywhere</span>
          </div>

          <h1 className={styles.headline} style={delay(120)}>
            Remote $100k+ Jobs
          </h1>

          <p className={styles.subheadline} style={delay(240)}>
            <strong>{remoteJobCount.toLocaleString()}</strong> fully remote positions from{' '}
            <strong>{companyCount.toLocaleString()}</strong> companies worldwide. No commute, just
            premium pay.
          </p>

          <form className={styles.searchForm} action="/search" method="get" style={delay(360)}>
            <input type="hidden" name="location" value="remote" />
            {activeRemoteRegion ? (
              <input type="hidden" name="remoteRegion" value={activeRemoteRegion} />
            ) : null}

            <div className={styles.searchBar}>
              <label className={styles.srOnly} htmlFor="remote-q">
                Find remote $100k+ jobs
              </label>
              <Search className={styles.searchIcon} aria-hidden="true" />
              <input
                id="remote-q"
                name="q"
                type="text"
                placeholder="Find roles, companies, or skills…"
                className={styles.searchInput}
                autoComplete="off"
                spellCheck={false}
              />
              <Button variant="primary" size="lg" type="submit" className={styles.cta}>
                Find remote jobs <span aria-hidden="true">→</span>
              </Button>
            </div>
          </form>

          <div className={styles.stats} style={delay(480)}>
            <div className={styles.statCard}>
              <div className={`${styles.statValue} ${styles.statValueAccent}`}>
                {remoteJobCount.toLocaleString()}
              </div>
              <div className={styles.statLabel}>Total remote jobs</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{countryCount.toLocaleString()}</div>
              <div className={styles.statLabel}>Countries hiring remotely</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>
                <span className={styles.statValueAccent}>{formatUsdAnnual(avgSalaryUsd)}</span>
              </div>
              <div className={styles.statLabel}>Average remote salary (USD)</div>
            </div>
          </div>

          <div className={styles.filtersRow} style={delay(600)} aria-label="Quick filters">
            {FILTERS.map((f) => {
              const isActive = (activeRemoteRegion || null) === f.remoteRegion
              const href = f.remoteRegion ? `/remote?remoteRegion=${encodeURIComponent(f.remoteRegion)}` : '/remote'
              return (
                <Link
                  key={f.key}
                  href={href}
                  scroll={false}
                  className={`${styles.filterPill} ${isActive ? styles.filterActive : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {f.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
