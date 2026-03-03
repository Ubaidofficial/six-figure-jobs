import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import styles from './TopLocations.module.css'

export type TopLocationCard = {
  slug: string
  name: string
  flag: string
  jobCount: number
  thresholdLabel: string
  topCity: string | null
}

export function TopLocations({ locations }: { locations: TopLocationCard[] }) {
  if (!locations?.length) return null

  return (
    <section className={styles.section} aria-label="Top locations for high-paying jobs">
      <header className={styles.header}>
        <h2 className={styles.title}>Top Locations for Six Figure Jobs</h2>
        <p className={styles.subtitle}>Global opportunities with PPP-adjusted thresholds</p>
      </header>

      <div className={styles.grid}>
        {locations.map((loc) => (
          <Link key={loc.slug} href={`/jobs/location/${loc.slug}`} className={styles.card}>
            <div className={styles.flag} aria-hidden="true">
              {loc.flag}
            </div>

            <div className={styles.name}>{loc.name}</div>

            <div className={styles.meta}>
              <div className={styles.count}>{loc.jobCount.toLocaleString()} jobs</div>
              <div className={styles.threshold}>{loc.thresholdLabel}</div>
              <div className={styles.city}>
                Most in: <span className={styles.cityValue}>{loc.topCity ?? '—'}</span>
              </div>
            </div>

            <span className={styles.arrow} aria-hidden="true">
              <ArrowUpRight className={styles.arrowIcon} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
