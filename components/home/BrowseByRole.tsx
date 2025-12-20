import Link from 'next/link'

import styles from './BrowseByRole.module.css'

interface RoleCard {
  slug: string
  name: string
  count: number
  emoji: string
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
        {roles.map((role) => (
          <Link key={role.slug} href={`/jobs/${role.slug}`} className={styles.card}>
            <span className={styles.emoji} aria-hidden="true">
              {role.emoji}
            </span>
            <div className={styles.content}>
              <h3 className={styles.roleName}>{role.name}</h3>
              <p className={styles.count}>{role.count.toLocaleString()} 6 figure jobs</p>
            </div>
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
