import { Bell, Rss } from 'lucide-react'

import { alertsEnabled } from '@/lib/alerts/config'

import styles from './Listing.module.css'

/**
 * After a search on /jobs: "Get alerts for “seo” jobs" (jumps to the email alert box above the results), or, while email
 * alerts are off, "Follow “seo” jobs" as an RSS feed of that search.
 */
export function SavedSearchChip({ keyword }: { keyword: string }) {
  const alerts = alertsEnabled()
  const href = alerts ? '#job-alert' : `/feeds/jobs.rss?${new URLSearchParams({ q: keyword }).toString()}`
  const Icon = alerts ? Bell : Rss
  return (
    <p className={styles.savedSearch}>
      <a href={href} className={styles.savedSearchChip} rel={alerts ? undefined : 'nofollow'}>
        <span className={styles.savedSearchIcon} aria-hidden="true">
          <Icon size={14} />
        </span>
        {alerts ? 'Get alerts for' : 'Follow'} &ldquo;{keyword}&rdquo; jobs
        {alerts ? null : <span className={styles.savedSearchNote}>RSS</span>}
      </a>
    </p>
  )
}
