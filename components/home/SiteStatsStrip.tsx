// components/home/SiteStatsStrip.tsx
// "From 4.8M jobs to the ones that pay": what we screen (freehire's live catalogue plus the careers sites we read
// directly) and what is left on 6figjobs (our own live counts), as two panels with one big number each. Replaced two
// rows of nine equal big numbers (2026-11-09), which read as a wall of figures and did not say how they relate.
// A number that is missing (its query failed) is left out rather than shown as 0; without the catalogue only the
// second panel shows.
import { ArrowRight } from 'lucide-react'

import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { DIRECT_EMPLOYERS } from '@/lib/constants/directEmployers'
import { FREEHIRE_OPEN_URL, type FreehireCatalog } from '@/lib/jobs/freehireCatalog'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'

import styles from './SiteStatsStrip.module.css'

const n = (v: number) => v.toLocaleString('en-US')

/** "about 1 in 334": how many screened jobs there are for each one listed; null when it would not read sensibly. */
export function screenRatio(screened: number, listed: number): number | null {
  if (!(screened > 0) || !(listed > 0) || screened <= listed) return null
  return Math.round(screened / listed)
}

export function SiteStatsStrip({
  jobs,
  companies,
  newThisWeek,
  countries,
  medianUsd,
  catalog,
}: {
  jobs: number
  companies: number
  newThisWeek: number
  countries: number | null
  medianUsd: number | null
  /** freehire's live catalogue size; the "We screen" panel is left out when it could not be read. */
  catalog: FreehireCatalog | null
}) {
  if (jobs <= 0) return null
  const ratio = catalog ? screenRatio(catalog.jobs, jobs) : null
  const listedFacts = [
    `${n(companies)} companies`,
    `${n(newThisWeek)} new this week`,
    countries ? `${n(countries)} countries` : null,
    medianUsd ? `${formatCurrencyShort(Math.round(medianUsd / 1000) * 1000, 'USD')} typical salary` : null,
  ].filter((f): f is string => Boolean(f))

  return (
    <section className={styles.section} aria-labelledby="site-stats-title">
      <p id="site-stats-title" className={styles.eyebrow}>
        {'// 6figjobs today'}
      </p>
      <div className={`${styles.funnel} ${catalog ? '' : styles.single}`}>
        {catalog ? (
          <>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>We screen</p>
              <p className={styles.big}>
                <AnimatedNumber text={n(catalog.jobs)} reveal />
              </p>
              <p className={styles.bigLabel}>open jobs in the catalogue</p>
              <ul className={styles.facts}>
                <li>{n(catalog.companies)} companies</li>
                <li>
                  {n(catalog.sources)} sources and {n(catalog.atsPlatforms)} hiring platforms
                </li>
                <li>plus {n(DIRECT_EMPLOYERS.length)} careers sites we read directly</li>
              </ul>
            </div>
            <div className={styles.arrow} aria-hidden={ratio ? undefined : 'true'}>
              <ArrowRight className={styles.arrowIcon} aria-hidden="true" />
              {ratio ? <span className={styles.ratio}>about 1 in {n(ratio)} makes the list</span> : null}
            </div>
          </>
        ) : null}
        <div className={`${styles.panel} ${styles.panelMain}`}>
          <p className={styles.panelLabel}>You see</p>
          <p className={styles.big}>
            <AnimatedNumber text={n(jobs)} reveal />
          </p>
          <p className={styles.bigLabel}>$100k+ jobs with published pay</p>
          <ul className={styles.facts}>
            {listedFacts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className={styles.note}>
        {catalog ? (
          <>
            Screened jobs from{' '}
            <a href={FREEHIRE_OPEN_URL} className={styles.link}>
              freehire&apos;s live catalogue
            </a>
            ; listed jobs counted from our own database, refreshed every few minutes.
          </>
        ) : (
          'Counted from our own job database, refreshed every few minutes.'
        )}
      </p>
    </section>
  )
}
