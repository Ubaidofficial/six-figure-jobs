// components/home/SiteStatsStrip.tsx
// "From 4.8M jobs to the ones that pay", as one compact band under the companies strip: what we screen (a live job
// catalogue plus the careers sites we read directly) -> how few make it -> what is listed, then three facts about the
// list. Redesigned 2026-11-10 at the owner's request: it was two tall panels near the foot of the page (~380 px), it is
// now one band (~150 px) right after "Top Companies Hiring Now". The typical salary is left out: the hero shows it.
// A number that is missing (its query failed) is left out rather than shown as 0; without the catalogue only the listed
// side shows.
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { DIRECT_EMPLOYERS } from '@/lib/constants/directEmployers'
import type { FreehireCatalog } from '@/lib/jobs/freehireCatalog'

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
  catalog,
}: {
  jobs: number
  companies: number
  newThisWeek: number
  countries: number | null
  /** The live catalogue's size; the "We screen" side is left out when it could not be read. */
  catalog: FreehireCatalog | null
}) {
  if (jobs <= 0) return null
  const ratio = catalog ? screenRatio(catalog.jobs, jobs) : null
  const facts: Array<[number, string]> = [
    [companies, 'companies hiring'],
    [newThisWeek, 'new this week'],
    ...(countries ? ([[countries, 'countries']] as Array<[number, string]>) : []),
  ]

  return (
    <section className={styles.band} aria-labelledby="site-stats-title">
      <h2 id="site-stats-title" className={`eyebrow-pill ${styles.eyebrow}`}>
        6figjobs today
      </h2>
      <div className={`${styles.row} ${catalog ? '' : styles.noScreen}`}>
        {catalog ? (
          <>
            <div className={styles.step}>
              <p className={styles.label}>We screen</p>
              <p className={styles.big}>
                <AnimatedNumber text={n(catalog.jobs)} reveal />
              </p>
              <p className={styles.sub}>
                open jobs from {n(catalog.sources)} sources, {n(catalog.atsPlatforms)} hiring platforms and{' '}
                {n(DIRECT_EMPLOYERS.length)} careers sites
              </p>
            </div>
            <div className={styles.connector} aria-hidden={ratio ? undefined : 'true'}>
              <span className={styles.line} aria-hidden="true" />
              {ratio ? <span className={styles.ratio}>about 1 in {n(ratio)} makes the list</span> : null}
            </div>
          </>
        ) : null}
        <div className={`${styles.step} ${styles.stepMain}`}>
          <p className={styles.label}>You see</p>
          <p className={`${styles.big} ${styles.bigMain}`}>
            <AnimatedNumber text={n(jobs)} reveal />
          </p>
          <p className={styles.sub}>$100k+ jobs with published pay</p>
        </div>
        <ul className={styles.facts}>
          {facts.map(([value, label]) => (
            <li key={label}>
              <span className={styles.factValue}>
                <AnimatedNumber text={n(value)} reveal />
              </span>
              <span className={styles.factLabel}>{label}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.note}>
        {catalog
          ? 'Screened jobs counted across the sources and hiring platforms we read; listed jobs counted from our own database, refreshed every few minutes.'
          : 'Counted from our own job database, refreshed every few minutes.'}
      </p>
    </section>
  )
}
