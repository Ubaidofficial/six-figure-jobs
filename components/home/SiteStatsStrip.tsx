// components/home/SiteStatsStrip.tsx
// "6figjobs today": the size of the board in a few big numbers, all live counts the homepage already loads.
// A number that is missing (its query failed) is left out rather than shown as 0.
import { Briefcase, Building2, DollarSign, Globe2, Sparkles, type LucideIcon } from 'lucide-react'

import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'

import styles from './SiteStatsStrip.module.css'

type Stat = { icon: LucideIcon; value: string; label: string }

export function SiteStatsStrip({
  jobs,
  companies,
  newThisWeek,
  countries,
  medianUsd,
}: {
  jobs: number
  companies: number
  newThisWeek: number
  countries: number | null
  medianUsd: number | null
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
    </section>
  )
}
