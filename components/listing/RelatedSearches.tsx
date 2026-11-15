// "Related searches" card for listing sidebars: other pages worth opening from here, each with the number of jobs that
// page shows (lib/jobs/relatedSearches.ts counts them). Renders nothing when there is nothing to offer.
import { Search } from 'lucide-react'

import Link from '@/components/ui/Link'
import type { RelatedSearch } from '@/lib/jobs/relatedSearches'

import styles from './RelatedSearches.module.css'

export function RelatedSearches({ items, title = 'Related searches' }: { items: RelatedSearch[]; title?: string }) {
  if (items.length === 0) return null
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true">
          <Search size={16} />
        </span>
        <h2 className={styles.title}>{title}</h2>
      </div>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={styles.row}>
              <span className={styles.label}>{item.label}</span>
              {item.count !== undefined ? <span className={styles.count}>{item.count.toLocaleString('en-US')}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
