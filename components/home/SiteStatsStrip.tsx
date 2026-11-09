// components/home/SiteStatsStrip.tsx
// "6figjobs today": the size of the board in a few big numbers, all live counts the homepage already loads.
// A number that is missing (its query failed) is left out rather than shown as 0.
import { Briefcase, Building2, Database, DollarSign, Globe2, Layers, ScanSearch, Sparkles, type LucideIcon } from 'lucide-react'

import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { DIRECT_EMPLOYERS } from '@/lib/constants/directEmployers'
import { FREEHIRE_OPEN_URL, type FreehireCatalog } from '@/lib/jobs/freehireCatalog'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'

import styles from './SiteStatsStrip.module.css'

type Stat = { icon: LucideIcon; value: string; label: string }

const n = (v: number) => v.toLocaleString('en-US')

const catalogStats = (c: FreehireCatalog): Stat[] => [
  { icon: ScanSearch, value: n(c.jobs), label: 'open jobs screened' },
  { icon: Building2, value: n(c.companies), label: 'companies' },
  { icon: Database, value: n(c.sources), label: 'sources' },
  { icon: Layers, value: n(c.atsPlatforms), label: 'ATS platforms' },
]

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
  /** freehire's live catalogue size; the line naming it is left out when it could not be read. */
  catalog: FreehireCatalog | null
}) {
  const stats: Stat[] = [
    { icon: Briefcase, value: jobs.toLocaleString('en-US'), label: '$100k+ jobs with published pay' },
    { icon: Building2, value: companies.toLocaleString('en-US'), label: 'companies hiring' },
    { icon: Sparkles, value: newThisWeek.toLocaleString('en-US'), label: 'new this week' },
    ...(countries ? [{ icon: Globe2, value: countries.toLocaleString('en-US'), label: 'countries' }] : []),
    ...(medianUsd
      ? [{ icon: DollarSign, value: formatCurrencyShort(Math.round(medianUsd / 1000) * 1000, 'USD'), label: 'typical salary' }]
      : []),
  ]
  if (jobs <= 0) return null

  return (
    <section className={styles.section} aria-labelledby="site-stats-title">
      <p id="site-stats-title" className={styles.eyebrow}>
        {'// 6figjobs today'}
      </p>
      <dl className={styles.grid}>
        {stats.map(({ icon: Icon, value, label }) => (
          <div key={label} className={styles.stat}>
            <dt className={styles.label}>
              <Icon className={styles.icon} aria-hidden="true" />
              {label}
            </dt>
            <dd className={styles.value}>
              <AnimatedNumber text={value} reveal />
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}>Counted from our own job database, refreshed every few minutes.</p>
      {catalog && (
        // What we screen, not what we list: freehire collects the jobs, we keep only those with published six-figure
        // pay. Its numbers are read live from the endpoint it publishes for quoting (lib/jobs/freehireCatalog.ts).
        <div className={styles.catalog}>
          <p id="site-catalog-title" className={styles.eyebrow}>
            {'// The catalogue we screen, today'}
          </p>
          <dl className={styles.grid} aria-labelledby="site-catalog-title">
            {catalogStats(catalog).map(({ icon: Icon, value, label }) => (
              <div key={label} className={styles.stat}>
                <dt className={styles.label}>
                  <Icon className={styles.icon} aria-hidden="true" />
                  {label}
                </dt>
                <dd className={styles.value}>
                  <AnimatedNumber text={value} reveal />
                </dd>
              </div>
            ))}
          </dl>
          <p className={styles.note}>
            Collected by{' '}
            <a href={FREEHIRE_OPEN_URL} className={styles.link}>
              freehire (live numbers)
            </a>
            , plus {n(DIRECT_EMPLOYERS.length)} employers&apos; careers sites we read directly. We list only the jobs
            whose published pay clears our six-figure line.
          </p>
        </div>
      )}
    </section>
  )
}
