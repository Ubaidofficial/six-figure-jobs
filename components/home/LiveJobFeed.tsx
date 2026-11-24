'use client'

// The homepage "Latest Six Figure Opportunities": the newest jobs we added, live, with how long ago (owner's request,
// 2026-11-19: one list that updates in real time like freehire's "Just added", in place of a static list plus a separate
// live block). The server renders the first list (so it is in the HTML and the page stays static); after load this asks
// /api/jobs/latest every 20 seconds while the tab is visible, and new jobs slide in at the top. So nothing moves under a
// reader's thumb, arrivals wait while the pointer or keyboard focus is in the list, and Pause holds them behind a
// "Show N new jobs" button. Polling stops after 30 minutes of one visit and resumes when the tab is shown again.

import * as React from 'react'
import Link from '@/components/ui/Link'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { CountryFlag } from '@/components/ui/CountryFlag'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { FEED_SIZE, formatAgo, newestAddedAt, type FeedItem } from '@/lib/jobs/latestFeed'

import styles from './LiveJobFeed.module.css'

const POLL_MS = 20_000
const TICK_MS = 5_000
const MAX_POLLS_PER_VISIT = 90

export function LiveJobFeed({
  initialItems,
  serverNow,
  totalJobs,
  addedLastHour: serverAddedLastHour = null,
}: {
  initialItems: FeedItem[]
  serverNow: string
  totalJobs: number
  /** Listed jobs added in the last hour (counted on the server, refreshed with every poll); left out when unknown. */
  addedLastHour?: number | null
}) {
  const [items, setItems] = React.useState(initialItems)
  const [addedLastHour, setAddedLastHour] = React.useState(serverAddedLastHour)
  const [pending, setPending] = React.useState<FeedItem[]>([])
  const [fresh, setFresh] = React.useState<Set<string>>(new Set())
  // First client render uses the server's clock so it matches the server HTML; the effect below moves it to the real one.
  const [now, setNow] = React.useState(() => Date.parse(serverNow))
  const known = React.useRef(initialItems)
  const lastPoll = React.useRef(0)
  const polls = React.useRef(0)
  const [paused, setPaused] = React.useState(false)
  // The pointer or keyboard focus is in the list: arrivals wait so a row does not move under a tap.
  const [holding, setHolding] = React.useState(false)

  const newest = newestAddedAt([...items, ...pending])
  known.current = [...items, ...pending]

  React.useEffect(() => {
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(tick)
  }, [])

  const poll = React.useCallback(async () => {
    if (document.visibilityState !== 'visible' || polls.current >= MAX_POLLS_PER_VISIT) return
    polls.current += 1
    lastPoll.current = Date.now()
    try {
      const since = newestAddedAt(known.current)
      const res = await fetch(`/api/jobs/latest${since ? `?since=${encodeURIComponent(since)}` : ''}`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) return
      const data = (await res.json()) as { items?: FeedItem[]; addedLastHour?: number | null }
      if (typeof data.addedLastHour === 'number') setAddedLastHour(data.addedLastHour)
      const have = new Set(known.current.map((i) => i.id))
      const added = (data.items ?? []).filter((i) => i && i.id && !have.has(i.id))
      if (added.length) setPending((p) => [...added, ...p])
    } catch {
      // Offline or a hiccup: try again at the next tick.
    }
  }, [])

  React.useEffect(() => {
    const timer = setInterval(() => void poll(), POLL_MS)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      polls.current = 0
      setNow(Date.now())
      if (Date.now() - lastPoll.current >= POLL_MS) void poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [poll])

  const showPending = React.useCallback(() => {
    setPending((queued) => {
      if (queued.length) {
        setFresh(new Set(queued.map((i) => i.id)))
        setItems((cur) => [...queued, ...cur].slice(0, FEED_SIZE))
      }
      return []
    })
  }, [])

  // Live unless paused or held: new jobs go straight into the list.
  React.useEffect(() => {
    if (!paused && !holding && pending.length) showPending()
  }, [paused, holding, pending.length, showPending])

  return (
    <section className={styles.section} aria-labelledby="latest-jobs-heading">
      <header className={styles.header}>
        <div>
          <SectionHeading id="latest-jobs-heading" eyebrow="Latest jobs" light="Latest" strong="Six Figure Opportunities" />
          <p className={styles.live}>
            <span className={styles.dot} aria-hidden="true" />
            <span>
              <strong>Live.</strong>{' '}
              {addedLastHour && newest ? `${addedLastHour.toLocaleString('en-US')} added in the last hour, the latest ${formatAgo(newest, now)}.` : newest ? `Latest job added ${formatAgo(newest, now)}.` : 'Updated continuously.'}{' '}
              {paused ? 'Paused: new jobs wait until you resume.' : 'New jobs appear here as we add them.'}
            </span>
          </p>
        </div>
        {/* The buttons sit beside the link, in a row that is always there, so they never move the list. */}
        <div className={styles.actions}>
          <button type="button" className={styles.pause} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <span aria-live="polite">
            {paused && pending.length > 0 ? (
              <button type="button" className={styles.pending} onClick={showPending}>
                Show {pending.length} new {pending.length === 1 ? 'job' : 'jobs'}
              </button>
            ) : null}
          </span>
          <Link href="/jobs?sort=recent" className={`arrow-link ${styles.all}`}>
            <span className="arrow-link-label">Explore all opportunities</span>
            <span className="arrow-chip" aria-hidden="true">&#8599;</span>
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <p className={styles.empty}>New jobs appear here as we add them.</p>
      ) : (
        <ul
          className={styles.list}
          onPointerEnter={() => setHolding(true)}
          onPointerLeave={() => setHolding(false)}
          onFocus={() => setHolding(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHolding(false)
          }}
        >
          {items.map((job) => (
            <li key={job.id} className={fresh.has(job.id) ? styles.fresh : undefined}>
              <Link href={job.href} prefetch={false} className={styles.row}>
                <span className={styles.logo}>
                  <CompanyLogo name={job.company} src={job.logo} size="fill" />
                </span>
                <span className={styles.body}>
                  <span className={styles.jobTitle}>{job.title}</span>
                  <span className={styles.byline}>
                    <span className={styles.company}>{job.company}</span>
                    <span aria-hidden="true">·</span>
                    <span className={styles.ago}>{formatAgo(job.addedAt, now)}</span>
                  </span>
                </span>
                <span className={styles.side}>
                  {job.salary ? <span className={styles.salary}>{job.salary}</span> : null}
                  {job.location ? (
                    <span className={styles.place}>
                      <CountryFlag code={job.countryCode} /> {job.location}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.cta}>
        <Link href="/jobs" className={styles.ctaButton}>
          Explore all {totalJobs.toLocaleString('en-US')} opportunities <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}
