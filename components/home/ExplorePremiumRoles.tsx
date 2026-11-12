import Link from '@/components/ui/Link'
import { ArrowUpRight } from 'lucide-react'

import { RoleIllustration } from '@/components/roles/RoleIllustration'
import { pluralize } from '@/lib/utils/number'
import styles from './ExplorePremiumRoles.module.css'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

export type PremiumRoleCard = {
  slug: string
  name: string
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
        <SectionHeading eyebrow="Roles" light="Explore" strong="Premium Roles" />
        <p className={styles.subtitle}>Explore six-figure opportunities by position</p>
      </header>

      <div className={styles.grid} data-reveal="" data-reveal-stagger="">
        {roles.map((role) => (
          <Link key={role.slug} href={`/jobs/${role.slug}`} className={styles.card}>
            <div className={styles.content}>
              <div className={styles.roleName}>
                {role.name}
                {role.trending ? <span className={styles.trending}>Trending</span> : null}
              </div>
              <div className={styles.count}>
                <AnimatedNumber text={role.count.toLocaleString('en-US')} reveal /> {pluralize(role.count, 'job')}
              </div>
              <div className={styles.avg}>{formatUsdAvg(role.avgUsdAnnual)}</div>
            </div>

            <RoleIllustration slug={role.slug} size={88} className={styles.art} />

            <span className={styles.arrow} aria-hidden="true">
              <ArrowUpRight className={styles.arrowIcon} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
