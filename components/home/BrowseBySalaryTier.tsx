import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import styles from './BrowseBySalaryTier.module.css'

export type SalaryTier = {
  slug: '100k-plus' | '200k-plus' | '300k-plus' | '400k-plus'
  label: string
  count: number
  icon: string
}

const ROUTES: Record<SalaryTier['slug'], string> = {
  '100k-plus': '/jobs/100k-plus',
  '200k-plus': '/jobs/200k-plus',
  '300k-plus': '/jobs/300k-plus',
  '400k-plus': '/jobs/400k-plus',
}

export function BrowseBySalaryTier({ tiers }: { tiers: SalaryTier[] }) {
  if (!tiers?.length) return null

  return (
    <section className={styles.section} aria-label="Browse by salary tier">
      <header className={styles.header}>
        <h2 className={styles.title}>Browse by Salary Tier</h2>
        <p className={styles.subtitle}>Find opportunities matching your expectations</p>
      </header>

      <div className={styles.grid}>
        {tiers.map((tier) => (
          <Link
            key={tier.slug}
            href={ROUTES[tier.slug]}
            className={`${styles.card} ${styles[`tier_${tier.slug}`]}`}
          >
            <div className={styles.icon} aria-hidden="true">
              {tier.icon}
            </div>

            <div className={styles.content}>
              <div className={styles.tierLabel}>{tier.label} Jobs</div>
              <div className={styles.count}>
                {tier.count.toLocaleString()}
                <span className={styles.countSuffix}> jobs</span>
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

