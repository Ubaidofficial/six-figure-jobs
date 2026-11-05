// components/listing/ListingSalaryAside.tsx
// The white "Typical salary" card shown at the right of a listing page's header. An async server component: it loads
// the figures for the page's own filters and renders nothing when there are too few listings (or the lookup fails),
// so a page never shows a number it cannot back up.

import { describeVsMarket, loadListingSalaryStats } from '@/lib/jobs/listingSalaryStats'
import type { JobQueryInput } from '@/lib/jobs/queryJobs'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'

import styles from './Listing.module.css'

const round1k = (n: number) => Math.round(n / 1000) * 1000

/**
 * `scope` names the segment the page is about, as a plural noun phrase ("Software Engineer roles", "roles in London").
 * With it the card says whose pay it shows and how that compares with every listing; without it (the all-jobs page)
 * the card is the market itself. `compare={false}` drops the comparison where it would be true by construction (a
 * $200k+ page is always above the all-listings median).
 */
export async function ListingSalaryAside({
  input,
  scope,
  compare = true,
}: {
  input: JobQueryInput
  scope?: string
  compare?: boolean
}) {
  let stats: Awaited<ReturnType<typeof loadListingSalaryStats>> = null
  let market: Awaited<ReturnType<typeof loadListingSalaryStats>> = null
  try {
    stats = await loadListingSalaryStats(input)
    // The market is the same country (so the same currency) with no other filter; cached, so shared by every page.
    if (stats && scope && compare) market = await loadListingSalaryStats(input.countryCode ? { countryCode: input.countryCode } : {})
  } catch {
    return null
  }
  if (!stats) return null
  const { snapshot, currency } = stats
  const max = Math.max(...snapshot.bands.map((b) => b.count), 1)
  const vsMarket =
    market && market.currency === currency && market.snapshot.count !== snapshot.count
      ? describeVsMarket(snapshot.median, market.snapshot.median, currency)
      : null

  return (
    <aside className={styles.salaryAside} aria-label={`Typical salary for ${scope ?? 'roles on this page'}`}>
      <h2 className={styles.asideTitle}>Typical salary</h2>
      <p className={styles.asideBig}>{formatCurrencyShort(round1k(snapshot.median), currency)}</p>
      <p className={styles.asideNote}>
        Most {scope ?? 'roles'} pay {formatCurrencyShort(round1k(snapshot.p25), currency)}
        {'\u2013'}
        {formatCurrencyShort(round1k(snapshot.p75), currency)}. Median of {snapshot.count.toLocaleString()} listings paid
        in {currency}. {vsMarket ? <strong>{vsMarket}</strong> : null}
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
