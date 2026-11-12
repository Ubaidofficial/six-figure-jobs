'use client'

// The homepage live feed: the newest jobs we added, with how long ago. The server renders the first list (so it is in
// the HTML and the page stays static); after load this asks /api/jobs/latest once a minute while the tab is visible.
// New jobs wait behind a "Show N new jobs" button instead of being pushed into the list, so nothing moves under a
// reader's thumb. Polling stops after 30 minutes of one visit and resumes when the tab is shown again.

import * as React from 'react'
import Link from '@/components/ui/Link'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { CountryFlag } from '@/components/ui/CountryFlag'
import { FEED_SIZE, formatAgo, newestAddedAt, type FeedItem } from '@/lib/jobs/latestFeed'

import styles from './LiveJobFeed.module.css'

const POLL_MS = 60_000
const TICK_MS = 30_000
const MAX_POLLS_PER_VISIT = 30

export function LiveJobFeed({ initialItems, serverNow }: { initialItems: FeedItem[]; serverNow: string }) {
  const [items, setItems] = React.useState(initialItems)
  const [pending, setPending] = React.useState<FeedItem[]>([])
  const [fresh, setFresh] = React.useState<Set<string>>(new Set())
  // First client render uses the server's clock so it matches the server HTML; the effect below moves it to the real one.
  const [now, setNow] = React.useState(() => Date.parse(serverNow))
  const known = React.useRef(initialItems)
  const lastPoll = React.useRef(0)
  const polls = React.useRef(0)

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
      const data = (await res.json()) as { items?: FeedItem[] }
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

  const showPending = () => {
    setFresh(new Set(pending.map((i) => i.id)))
    setItems((cur) => [...pending, ...cur].slice(0, FEED_SIZE))
    setPending([])
  }

  if (items.length === 0 && pending.length === 0) return null

  return (
    <section className={styles.section} aria-labelledby="live-feed-heading">
      <header className={styles.header}>
        <div>
          <h2 id="live-feed-heading" className={styles.title}>
            <span className={styles.dot} aria-hidden="true" />
            <span>
              <span className="font-light">New jobs,</span> live
            </span>
          </h2>
          <p className={styles.sub}>
            {newest ? `Latest job added ${formatAgo(newest, now)}.` : 'Updated continuously.'} This list refreshes while you
            are here.
          </p>
        </div>
        {/* The "Show N new jobs" button sits beside the link, in a row that is always there, so it never moves the list. */}
        <div className={styles.actions}>
          <span aria-live="polite">
            {pending.length > 0 ? (
              <button type="button" className={styles.pending} onClick={showPending}>
                Show {pending.length} new {pending.length === 1 ? 'job' : 'jobs'}
              </button>
            ) : null}
          </span>
          <Link href="/jobs?sort=recent" className={`arrow-link ${styles.all}`}>
            <span className="arrow-link-label">All new jobs</span>
            <span className="arrow-chip" aria-hidden="true">&#8599;</span>
          </Link>
        </div>
      </header>

      <ul className={styles.list}>
        {items.map((job) => (
          <li key={job.id} className={fresh.has(job.id) ? styles.fresh : undefined}>
            <Link href={job.href} prefetch={false} className={styles.row}>
              <span className={styles.logo}>
                <CompanyLogo name={job.company} src={job.logo} size="fill" />
              </span>
              <span className={styles.body}>
                <span className={styles.jobTitle}>{job.title}</span>
                <span className={styles.company}>{job.company}</span>
                <span className={styles.meta}>
                  <span className={styles.ago}>{formatAgo(job.addedAt, now)}</span>
                  {job.location ? (
                    <span className={styles.place}>
                      <CountryFlag code={job.countryCode} /> {job.location}
                    </span>
                  ) : null}
                  {job.salary ? <span className={styles.salary}>{job.salary}</span> : null}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
