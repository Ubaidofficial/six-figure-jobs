import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import styles from './BrowseBySalaryTier.module.css'
import { SectionHeading } from '@/components/ui/SectionHeading'

export type SalaryTier = {
  slug: '100k-plus' | '200k-plus' | '300k-plus' | '400k-plus'
  label: string
  count: number
}

const ROUTES: Record<SalaryTier['slug'], string> = {
  '100k-plus': '/jobs/100k-plus',
  '200k-plus': '/jobs/200k-plus',
  '300k-plus': '/jobs/300k-plus',
  '400k-plus': '/jobs/400k-plus',
}

export function BrowseBySalaryTier({ tiers }: { tiers: SalaryTier[] }) {
  if (!tiers?.length) return null
  const total = tiers.reduce((sum, t) => sum + t.count, 0)

  return (
    <section className={styles.section} aria-label="Browse by salary tier">
      <header className={styles.header}>
        <SectionHeading eyebrow="Salary" light="Browse by" strong="Salary Tier" />
        <p className={styles.subtitle}>US-dollar salaries, grouped by the top of each job&apos;s pay range</p>
      </header>

      <div className={styles.grid} data-reveal="" data-reveal-stagger="">
        {tiers.map((tier) => {
          // Each tier's share of the US-dollar jobs, drawn as a bar so the four cards compare at a glance.
          const share = total > 0 ? Math.round((tier.count / total) * 100) : 0
          return (
            <Link
              key={tier.slug}
              href={ROUTES[tier.slug]}
              className={`${styles.card} ${styles[`tier_${tier.slug}`]}`}
            >
              <div className={styles.tierLabel}>{tier.label}</div>
              <div className={styles.count}>
                {tier.count.toLocaleString()}
                <span className={styles.countSuffix}> jobs</span>
              </div>
              <div className={styles.bar} aria-hidden="true">
                <span className={styles.barFill} style={{ width: `${Math.max(share, 2)}%` }} />
              </div>
              <div className={styles.share}>{share}% of US-dollar listings</div>

              <span className={styles.arrow} aria-hidden="true">
                <ArrowUpRight className={styles.arrowIcon} />
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
