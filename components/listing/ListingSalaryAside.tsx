// components/listing/ListingSalaryAside.tsx
// The white "Typical salary" card shown at the right of a listing page's header. An async server component: it loads
// the figures for the page's own filters and renders nothing when there are too few listings (or the lookup fails),
// so a page never shows a number it cannot back up.

import { loadListingSalaryStats } from '@/lib/jobs/listingSalaryStats'
import type { JobQueryInput } from '@/lib/jobs/queryJobs'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'

import styles from './Listing.module.css'

const round1k = (n: number) => Math.round(n / 1000) * 1000

export async function ListingSalaryAside({ input }: { input: JobQueryInput }) {
  let stats: Awaited<ReturnType<typeof loadListingSalaryStats>> = null
  try {
    stats = await loadListingSalaryStats(input)
  } catch {
    return null
  }
  if (!stats) return null
  const { snapshot, currency } = stats
  const max = Math.max(...snapshot.bands.map((b) => b.count), 1)

  return (
    <aside className={styles.salaryAside} aria-label="Typical salary on this page">
      <h2 className={styles.asideTitle}>Typical salary</h2>
      <p className={styles.asideBig}>{formatCurrencyShort(round1k(snapshot.median), currency)}</p>
      <p className={styles.asideNote}>
        Most roles pay {formatCurrencyShort(round1k(snapshot.p25), currency)}
        {'\u2013'}
        {formatCurrencyShort(round1k(snapshot.p75), currency)}. Median of {snapshot.count.toLocaleString()} listings paid
        in {currency}.
      </p>
      <ul className={styles.asideBars} aria-label="Listings by salary band">
        {snapshot.bands.map((band) => (
          <li key={band.label} className={styles.asideBarRow}>
            <span className={styles.asideBarLabel}>{band.label}</span>
            <span className={styles.asideBarTrack} aria-hidden="true">
              <span className={styles.asideBarFill} style={{ width: `${Math.max(4, (band.count / max) * 100)}%` }} />
            </span>
            <span className={styles.asideBarCount}>{band.count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
