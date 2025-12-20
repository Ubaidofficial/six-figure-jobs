import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import styles from './ExplorePremiumRoles.module.css'

export type PremiumRoleCard = {
  slug: string
  name: string
  emoji: string
  count: number
  avgUsdAnnual: number | null
  trending: boolean
}

function formatUsdAvg(avgUsdAnnual: number | null): string {
  if (!avgUsdAnnual || !Number.isFinite(avgUsdAnnual)) return '—'
  const k = Math.round(avgUsdAnnual / 1000)
  return `$${k}k avg`
}

export function ExplorePremiumRoles({ roles }: { roles: PremiumRoleCard[] }) {
  if (!roles?.length) return null

  return (
    <section className={styles.section} aria-label="Explore premium roles">
      <header className={styles.header}>
        <h2 className={styles.title}>Explore Premium Roles</h2>
        <p className={styles.subtitle}>Explore $100k+ opportunities by position</p>
      </header>

      <div className={styles.grid}>
        {roles.map((role) => (
          <Link key={role.slug} href={`/jobs/${role.slug}`} className={styles.card}>
            <div className={styles.topRow}>
              <span className={styles.emoji} aria-hidden="true">
                {role.emoji}
              </span>
              {role.trending ? <span className={styles.trending}>Trending</span> : null}
            </div>

            <div className={styles.content}>
              <div className={styles.roleName}>{role.name}</div>
              <div className={styles.count}>{role.count.toLocaleString()} jobs</div>
              <div className={styles.avg}>{formatUsdAvg(role.avgUsdAnnual)}</div>
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
