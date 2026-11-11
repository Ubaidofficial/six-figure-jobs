import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { CountryFlag } from '@/components/ui/CountryFlag'
import { pluralize } from '@/lib/utils/number'
import styles from './TopLocations.module.css'
import { SectionHeading } from '@/components/ui/SectionHeading'

export type TopLocationCard = {
  slug: string
  name: string
  /** ISO code, for the flag; null for the worldwide remote card (a globe). */
  countryCode: string | null
  jobCount: number
  thresholdLabel: string
  topCity: string | null
  /** Defaults to the country page. */
  href?: string
  /** Replaces the "Most in" line. */
  detail?: string
}

export function TopLocations({ locations }: { locations: TopLocationCard[] }) {
  if (!locations?.length) return null

  return (
    <section className={styles.section} aria-label="Top locations for high-paying jobs">
      <header className={styles.header}>
        <SectionHeading eyebrow="Locations" light="Top Locations for" strong="Six Figure Jobs" />
        <p className={styles.subtitle}>Global opportunities with verified salary ranges</p>
      </header>

      <div className={styles.grid} data-reveal="" data-reveal-stagger="">
        {locations.map((loc) => (
          <Link key={loc.slug} href={loc.href ?? `/jobs/location/${loc.slug}`} className={styles.card}>
            <div className={styles.flag} aria-hidden="true">
              {loc.countryCode ? <CountryFlag code={loc.countryCode} className="h-9" /> : <span className={styles.globe}>🌍</span>}
            </div>

            <div className={styles.name}>{loc.name}</div>

            <div className={styles.meta}>
              <div className={styles.count}>{loc.jobCount.toLocaleString()} {pluralize(loc.jobCount, 'job')}</div>
              <div className={styles.threshold}>{loc.thresholdLabel}</div>
              {loc.detail ? (
                <div className={styles.city}>{loc.detail}</div>
              ) : loc.topCity ? (
                <div className={styles.city}>
                  Most in: <span className={styles.cityValue}>{loc.topCity}</span>
                </div>
              ) : null}
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
