// "Browse by category" icon row for the jobs hub. Server component; each tile links to the category page.
import Link from '@/components/ui/Link'
import { BarChart3, Brain, Code2, Handshake, Megaphone, Package, PenTool, Server, type LucideIcon } from 'lucide-react'

import styles from './Listing.module.css'

export type CategoryRowItem = { slug: string; label: string; count: number }

// One icon per entry in lib/seo/jobCategories.ts; a category without one still shows, just without an icon.
const ICONS: Record<string, LucideIcon> = {
  engineering: Code2,
  product: Package,
  data: BarChart3,
  design: PenTool,
  devops: Server,
  mlai: Brain,
  sales: Handshake,
  marketing: Megaphone,
}

export function CategoryRow({ items }: { items: CategoryRowItem[] }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Browse by category">
      <ul className={styles.categoryRow}>
        {items.map((c) => {
          const Icon = ICONS[c.slug]
          return (
            <li key={c.slug} className={styles.categoryItem}>
              <Link href={`/jobs/category/${c.slug}`} className={styles.categoryLink}>
                <span className={styles.categoryIcon} aria-hidden="true">
                  {Icon ? <Icon size={22} strokeWidth={2} /> : null}
                </span>
                <span className={styles.categoryLabel}>{c.label}</span>
                <span className={styles.categoryCount}>{c.count.toLocaleString()} jobs</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
