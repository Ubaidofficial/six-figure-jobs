'use client'

// components/home/ActivityTicker.tsx
//
// Honest version of the remoteyeah.com "live activity" pattern. Instead of
// synthesizing fake "Someone from X applied to Y" messages, this rotates
// through REAL recently-posted jobs from the DB: "Anthropic posted Senior
// Engineer · 12 minutes ago". Same psychological "the site is alive"
// effect, no fabricated data.
//
// Rendering strategy: the server passes an array of recent events to this
// client component. We render one event at a time and rotate the index on
// a fixed interval. Relative timestamps re-compute on each render so a user
// who sits on the page sees "8 minutes ago" tick up naturally.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import styles from './ActivityTicker.module.css'

export type ActivityEvent = {
  id: string
  company: string
  title: string
  postedAtISO: string
  href: string
}

type Props = {
  events: ActivityEvent[]
  // How long each event stays on screen before rotating. Default keeps the
  // motion gentle — fast enough to feel live, slow enough to actually read.
  rotateMs?: number
}

function formatRelative(iso: string, now: number): string {
  const ms = now - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  // Anything older than 30 days probably shouldn't be in a "live" ticker.
  // Fall back to a static label so we don't pretend to be fresh.
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ActivityTicker({ events, rotateMs = 4500 }: Props) {
  const validEvents = useMemo(() => events.filter((e) => e && e.id && e.title), [events])
  const [index, setIndex] = useState(0)
  // We re-snapshot `now` on a slower interval (every 30s) so the relative
  // timestamps stay accurate without thrashing React state every frame.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (validEvents.length < 2) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % validEvents.length)
    }, rotateMs)
    return () => clearInterval(id)
  }, [validEvents.length, rotateMs])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (validEvents.length === 0) return null

  const event = validEvents[index] ?? validEvents[0]
  const relative = formatRelative(event.postedAtISO, now)

  return (
    <div
      className={styles.tickerWrap}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={styles.tickerInner}>
        <span className={styles.livePill} aria-hidden="true">
          <span className={styles.liveDot} />
          LIVE
        </span>
        <Link href={event.href} className={styles.tickerEvent}>
          <span className={styles.eventCompany}>{event.company}</span>
          <span className={styles.eventVerb}>posted</span>
          <span className={styles.eventTitle}>{event.title}</span>
          <span className={styles.eventTime}>· {relative}</span>
        </Link>
      </div>
    </div>
  )
}
