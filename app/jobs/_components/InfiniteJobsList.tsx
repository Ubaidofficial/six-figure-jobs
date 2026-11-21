'use client'

// The job list on /jobs and the role pages (owner's request, 2026-11-21: show 5 jobs, load more as the reader scrolls, and
// show new jobs live like the homepage feed). The server renders every job of the page, so all their links are in the HTML
// for Google; here the rows past the first 5 are hidden (only where scripts run: InfiniteJobsList.module.css) and 5 more
// are shown each time the reader scrolls to the end, then the next pages are loaded from /api/jobs. On the "recent" order,
// page 1 is asked again every 30 seconds while the tab is visible and the jobs added since the page loaded go in at the
// top: straight away when the reader is at the top and not using the list, otherwise behind a "Show N new jobs" button, so
// a row never moves under a thumb. Polling stops after 30 minutes of one visit and starts again when the tab is shown.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { JobRow, JobRowList } from '@/components/jobs/JobRow'
import { formatAgo } from '@/lib/jobs/formatAgo'
import { newArrivals, newestAddedIso, rankTime, revealMore, shouldInsertNow, REVEAL_STEP } from '@/lib/jobs/liveList'
import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { cn } from '@/lib/utils'
import styles from '@/components/listing/Listing.module.css'
import live from './InfiniteJobsList.module.css'

const POLL_MS = 30_000
const TICK_MS = 5_000
const MAX_POLLS_PER_VISIT = 60

interface InfiniteJobsListProps {
  initialJobs: JobWithCompany[]
  initialPage: number
  totalPages: number
  /** Set on a role page: the role's slug, so "load more" and the live poll read the page the way the role page does. */
  scopeRole?: string
  /** Only on the "recent" order, page 1: look for jobs added since the page loaded. */
  live?: boolean
  /** The server's clock when the page was rendered, so the first client render matches the server HTML. */
  serverNow: string
}

export function InfiniteJobsList({ initialJobs, initialPage, totalPages, scopeRole, live: isLive = false, serverNow }: InfiniteJobsListProps) {
  const [jobs, setJobs] = useState(initialJobs)
  const [page, setPage] = useState(initialPage)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialPage < totalPages)
  const [visible, setVisible] = useState(REVEAL_STEP)
  const [pending, setPending] = useState<JobWithCompany[]>([])
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [paused, setPaused] = useState(false)
  // The pointer or keyboard focus is in the list: new jobs wait so a row does not move under a tap.
  const [holding, setHolding] = useState(false)
  const [now, setNow] = useState(() => Date.parse(serverNow))
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const searchParams = useSearchParams()
  const query = searchParams.toString()

  // Read by the poll and the scroll handler, which outlive a render.
  const jobsRef = useRef(jobs)
  const pendingRef = useRef(pending)
  jobsRef.current = jobs
  pendingRef.current = pending

  const apiQuery = useCallback(
    (extra: Record<string, string>) => {
      const params = new URLSearchParams(query)
      if (scopeRole) {
        params.set('scope', 'role')
        params.set('role', scopeRole)
      }
      for (const [k, v] of Object.entries(extra)) params.set(k, v)
      return params.toString()
    },
    [query, scopeRole],
  )

  // A new page of results (a filter changed): start again from what the server sent.
  useEffect(() => {
    setJobs(initialJobs)
    setPage(initialPage)
    setHasMore(initialPage < totalPages)
    setVisible(REVEAL_STEP)
    setPending([])
    setFresh(new Set())
  }, [query, initialJobs, initialPage, totalPages])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    const nextPage = page + 1
    try {
      const response = await fetch(`/api/jobs?${apiQuery({ page: String(nextPage) })}`)
      const data = await response.json()
      if (data.jobs && data.jobs.length > 0) {
        setJobs((prev) => {
          const have = new Set(prev.map((j) => j.id))
          return [...prev, ...(data.jobs as JobWithCompany[]).filter((j) => !have.has(j.id))]
        })
        setPage(nextPage)
        setHasMore(nextPage < data.totalPages)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('Failed to load more jobs:', error)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, page, apiQuery])

  // Scrolled to the end of what is shown: show 5 more; when all are shown, load the next page.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    if (visible >= jobs.length && (!hasMore || loading)) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (visible < jobs.length) setVisible((v) => revealMore(v, jobs.length))
        else void loadMore()
      },
      { rootMargin: '300px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible, jobs.length, hasMore, loading, loadMore])

  // Time of day for "Latest job added 40 sec ago".
  useEffect(() => {
    if (!isLive) return
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(tick)
  }, [isLive])

  const insertPending = useCallback(() => {
    const queued = pendingRef.current
    if (!queued.length) return
    setPending([])
    setFresh(new Set(queued.map((j) => j.id)))
    setJobs((cur) => {
      const have = new Set(cur.map((j) => j.id))
      return [...queued.filter((j) => !have.has(j.id)), ...cur]
    })
    setVisible((v) => v + queued.length) // the rows that were shown stay shown
  }, [])

  const scrolledPastTop = useCallback(() => {
    const top = listRef.current?.getBoundingClientRect().top
    return top !== undefined && top < -120
  }, [])

  // The poll: page 1 again, jobs that rank at or above the list's first job and are not in the list yet.
  useEffect(() => {
    if (!isLive) return
    let polls = 0
    let last = 0
    const poll = async () => {
      if (document.visibilityState !== 'visible' || polls >= MAX_POLLS_PER_VISIT) return
      polls += 1
      last = Date.now()
      try {
        const res = await fetch(`/api/jobs?${apiQuery({ page: '1', live: '1' })}`, { headers: { accept: 'application/json' } })
        if (!res.ok) return
        const data = (await res.json()) as { jobs?: JobWithCompany[] }
        const known = [...pendingRef.current, ...jobsRef.current]
        const added = newArrivals(data.jobs ?? [], new Set(known.map((j) => j.id)), known[0] ? rankTime(known[0]) : 0)
        if (added.length) setPending((p) => [...added, ...p])
      } catch {
        // Offline or a hiccup: try again at the next tick.
      }
    }
    const timer = setInterval(() => void poll(), POLL_MS)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      polls = 0
      setNow(Date.now())
      if (Date.now() - last >= POLL_MS) void poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isLive, apiQuery])

  // New jobs go in at once when the list is idle and the reader is at the top; otherwise they wait behind the button.
  useEffect(() => {
    if (!pending.length) return
    const maybeInsert = () => {
      if (shouldInsertNow({ holding, paused, scrolledPastTop: scrolledPastTop() })) insertPending()
    }
    maybeInsert()
    window.addEventListener('scroll', maybeInsert, { passive: true })
    return () => window.removeEventListener('scroll', maybeInsert)
  }, [pending.length, holding, paused, scrolledPastTop, insertPending])

  const newest = newestAddedIso([...pending, ...jobs])

  return (
    <>
      {isLive ? (
        <div className={live.bar}>
          <span className={live.status}>
            <span className={live.dot} aria-hidden="true" />
            <span>
              <strong>Live.</strong> {newest ? `Latest job added ${formatAgo(newest, now)}.` : 'New jobs appear here as we add them.'}
            </span>
          </span>
          <button type="button" className={live.pause} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <span aria-live="polite">
            {pending.length > 0 ? (
              <button type="button" className={live.pending} onClick={insertPending}>
                Show {pending.length} new {pending.length === 1 ? 'job' : 'jobs'}
              </button>
            ) : null}
          </span>
        </div>
      ) : null}

      <div
        ref={listRef}
        onPointerEnter={() => setHolding(true)}
        onPointerLeave={() => setHolding(false)}
        onFocus={() => setHolding(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHolding(false)
        }}
      >
        <JobRowList>
          {jobs.map((job, i) => (
            <JobRow key={job.id} job={job} className={cn(i >= visible && live.later, fresh.has(job.id) && live.fresh)} />
          ))}
        </JobRowList>
      </div>

      {loading && (
        <div className={styles.rows} aria-hidden="true">
          {[...Array(4)].map((_, i) => (
            <SkeletonRow key={`skeleton-${i}`} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} aria-hidden="true" />

      {!hasMore && visible >= jobs.length && jobs.length > 0 && (
        <p className={styles.count} style={{ marginTop: 16 }}>
          That&rsquo;s all {jobs.length.toLocaleString()} jobs matching your filters.
        </p>
      )}
    </>
  )
}

function SkeletonRow() {
  return (
    <div
      style={{
        height: 76,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-1)',
      }}
    />
  )
}
