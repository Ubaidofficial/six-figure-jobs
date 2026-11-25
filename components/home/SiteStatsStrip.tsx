// components/home/SiteStatsStrip.tsx
// "From 4.8M jobs to the ones that pay", as one compact band under the companies strip: what we screen (a live job
// catalogue plus the careers sites we read directly) -> how few make it -> what is listed, then three facts about the
// list. Redesigned 2026-11-10 at the owner's request: it was two tall panels near the foot of the page (~380 px), it is
// now one band (~150 px) right after "Top Companies Hiring Now". The typical salary is left out: the hero shows it.
// A number that is missing (its query failed) is left out rather than shown as 0; without the catalogue only the listed
// side shows.
//
// Live (owner's request, 2026-11-16): the page renders these numbers on the server, and after load the band asks
// /api/stats/live once a minute while the tab is visible and counts to whatever the database and the live catalogue now say
// (AnimatedNumber counts a changed number). Nothing is made up between answers: a number moves only when the answer moved,
// and an answer that fails or does not parse leaves the band as it was. Polling stops after 30 minutes of one visit and
// resumes when the tab is shown again. Without JavaScript, or under reduced motion, the numbers are simply the server's.
'use client'

import * as React from 'react'

import Link from '@/components/ui/Link'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { DIRECT_EMPLOYERS } from '@/lib/constants/directEmployers'
import type { FreehireCatalog } from '@/lib/jobs/freehireCatalog'
import { parseLiveSiteStats, type LiveSiteStats } from '@/lib/jobs/siteStatsShape'

import styles from './SiteStatsStrip.module.css'

const n = (v: number) => v.toLocaleString('en-US')

/** "about 1 in 334": how many screened jobs there are for each one listed; null when it would not read sensibly. */
export function screenRatio(screened: number, listed: number): number | null {
  if (!(screened > 0) || !(listed > 0) || screened <= listed) return null
  return Math.round(screened / listed)
}

/**
 * "Nov 13, 2026, 08:10 UTC": an absolute time, because the page is cached for minutes and "5 minutes ago" would be wrong
 * by the time anyone reads it. Null for a missing or invalid date.
 */
export function formatRefreshedAt(date: Date | null | undefined): string | null {
  if (!date || Number.isNaN(date.getTime())) return null
  const text = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    // h23, not hour12:false: some ICU builds print midnight as "24:00" with hour12:false (seen in CI, 2026-11-13).
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(date)
  return `${text} UTC`
}

// The counts behind /api/stats/live are at most a minute old (plus 30 s at the edge): asking every 30 s shows a change
// within about a minute of it happening. 60 polls = 30 minutes of one visit, as before.
const POLL_MS = 30_000
const MAX_POLLS_PER_VISIT = 60

/** The newest answer from /api/stats/live, or null until one arrives (the server's numbers show until then). */
function useLiveSiteStats(): LiveSiteStats | null {
  const [live, setLive] = React.useState<LiveSiteStats | null>(null)
  const lastPoll = React.useRef(0)
  const polls = React.useRef(0)

  const poll = React.useCallback(async () => {
    if (document.visibilityState !== 'visible' || polls.current >= MAX_POLLS_PER_VISIT) return
    polls.current += 1
    lastPoll.current = Date.now()
    try {
      const res = await fetch('/api/stats/live', { headers: { accept: 'application/json' } })
      if (!res.ok) return
      const next = parseLiveSiteStats(await res.json())
      // A part this answer could not read (the screened-jobs figure, the refresh time) keeps its last good value, so the band
      // never steps back to the older numbers the page was rendered with.
      if (next)
        setLive((prev) => ({
          ...next,
          countries: next.countries ?? prev?.countries ?? null,
          catalog: next.catalog ?? prev?.catalog ?? null,
          refreshedAt: next.refreshedAt ?? prev?.refreshedAt ?? null,
        }))
    } catch {
      // Offline or a hiccup: the band keeps what it shows and tries again at the next tick.
    }
  }, [])

  React.useEffect(() => {
    const timer = setInterval(() => void poll(), POLL_MS)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      polls.current = 0
      if (Date.now() - lastPoll.current >= POLL_MS) void poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [poll])

  return live
}

export function SiteStatsStrip({
  jobs: serverJobs,
  companies: serverCompanies,
  newThisWeek: serverNewThisWeek,
  countries: serverCountries,
  catalog: serverCatalog,
  refreshedAt: serverRefreshedAt,
  compact = false,
}: {
  jobs: number
  companies: number
  newThisWeek: number
  countries: number | null
  /** The live catalogue's size; the "We screen" side is left out when it could not be read. */
  catalog: FreehireCatalog | null
  /** When the daily sync last refreshed the listings; the "Updated" line is left out when it could not be read. */
  refreshedAt?: Date | null
  /** For a column narrower than the homepage's (the pricing page): the two-row layout at any desktop width. Off by default. */
  compact?: boolean
}) {
  const live = useLiveSiteStats()
  const jobs = live?.jobs ?? serverJobs
  const companies = live?.companies ?? serverCompanies
  const newThisWeek = live?.newThisWeek ?? serverNewThisWeek
  const countries = live?.countries ?? serverCountries
  const catalog = live?.catalog ?? serverCatalog
  const refreshedAt = live?.refreshedAt ? new Date(live.refreshedAt) : serverRefreshedAt

  if (jobs <= 0) return null
  const refreshed = formatRefreshedAt(refreshedAt)
  const ratio = catalog ? screenRatio(catalog.jobs, jobs) : null
  const facts: Array<[number, string]> = [
    [companies, 'companies hiring'],
    [newThisWeek, 'new this week'],
    ...(countries ? ([[countries, 'countries']] as Array<[number, string]>) : []),
  ]

  return (
    <section className={`${styles.band} ${compact ? styles.compact : ''}`} aria-labelledby="site-stats-title">
      <h2 id="site-stats-title" className={`eyebrow-pill ${styles.eyebrow}`}>
        Live now
      </h2>
      <div className={`${styles.row} ${catalog ? '' : styles.noScreen}`}>
        {catalog ? (
          <>
            <div className={styles.step}>
              <p className={styles.label}>We screen</p>
              <p className={styles.big}>
                <AnimatedNumber text={n(catalog.jobs)} reveal roll />
              </p>
              <p className={styles.sub}>
                open jobs from {n(catalog.sources)} sources, {n(catalog.atsPlatforms)} hiring platforms and{' '}
                {n(DIRECT_EMPLOYERS.length)} careers sites
              </p>
            </div>
            <div className={styles.connector} aria-hidden={ratio ? undefined : 'true'}>
              <span className={styles.line} aria-hidden="true" />
              {ratio ? <span className={styles.ratio}>about 1 in {n(ratio)} makes the list</span> : null}
            </div>
          </>
        ) : null}
        <div className={`${styles.step} ${styles.stepMain}`}>
          <p className={styles.label}>You see</p>
          <p className={`${styles.big} ${styles.bigMain}`}>
            <AnimatedNumber text={n(jobs)} reveal roll />
          </p>
          <p className={styles.sub}>$100k+ jobs with published pay</p>
        </div>
        <ul className={styles.facts}>
          {facts.map(([value, label]) => (
            <li key={label}>
              <span className={styles.factValue}>
                <AnimatedNumber text={n(value)} reveal roll />
              </span>
              <span className={styles.factLabel}>{label}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.note}>
        {catalog
          ? 'Screened jobs counted across the sources and hiring platforms we read; listed jobs counted from our own database every minute.'
          : 'Counted from our own job database every minute.'}
        {refreshed && refreshedAt ? (
          <>
            {' '}
            Job list last refreshed <time dateTime={refreshedAt.toISOString()}>{refreshed}</time>.
          </>
        ) : null}{' '}
        <Link href="/method" className={styles.noteLink}>
          How it works
        </Link>
      </p>
    </section>
  )
}
