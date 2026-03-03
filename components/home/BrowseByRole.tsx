import type * as React from 'react'
import Link from 'next/link'
import {
  Brain,
  Briefcase,
  Code,
  Database,
  Laptop,
  Megaphone,
  PenTool,
  Shield,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'

import styles from './BrowseByRole.module.css'

interface RoleCard {
  slug: string
  name: string
  count: number
}

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  'software-engineer': Code,
  'senior-software-engineer': Laptop,
  'staff-software-engineer': Laptop,
  'product-manager': Target,
  'senior-product-manager': Target,
  'data-scientist': Database,
  'senior-data-scientist': Database,
  'machine-learning-engineer': Brain,
  'senior-machine-learning-engineer': Brain,
  'engineering-manager': Users,
  'account-executive': Briefcase,
  'senior-account-executive': Briefcase,
  'product-designer': PenTool,
  'security-engineer': Shield,
  'growth-manager': TrendingUp,
  'sales-manager': ShoppingCart,
  'marketing-manager': Megaphone,
}

function getRoleIcon(slug: string) {
  return ROLE_ICONS[slug] || Briefcase
}

export function BrowseByRole({ roles }: { roles: RoleCard[] }) {
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Browse 6 Figure Jobs by Role</h2>
          <p className={styles.subtitle}>
            Explore six figure salary jobs and high paying jobs across top tech roles
          </p>
        </div>
      </header>

      <div className={styles.grid}>
        {roles.map((role) => {
          const Icon = getRoleIcon(role.slug)
          return (
            <Link key={role.slug} href={`/jobs/${role.slug}`} className={styles.card}>
              <div className={styles.iconBox}>
                <Icon className={styles.icon} size={24} />
              </div>
              <div className={styles.content}>
                <h3 className={styles.roleName}>{role.name}</h3>
                <p className={styles.count}>{role.count.toLocaleString()} 6 figure jobs</p>
              </div>
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
