'use client'

import { useEffect, useRef, useState } from 'react'

import { JobRow, JobRowList } from '@/components/jobs/JobRow'
import { companyJobsPagePath, companyJobsShowingText } from '@/lib/companies/jobsPaging'
import type { JobWithCompany } from '@/lib/jobs/queryJobs'

import styles from './CompanyJobsMore.module.css'

type Props = {
  slug: string
  /** The chunk the server rendered above this component (1 = the first ten jobs). */
  page: number
  /** Offset of that chunk's first job, and the offset after its last. */
  start: number
  end: number
  total: number
}

/**
 * Under the server-rendered jobs: "Showing 10 of 37 jobs" and a "Show more jobs" link to the next chunk's own page.
 * Without JavaScript it stays a link, so every job is reachable. With it, the link becomes a button that fetches the
 * next ten from /api/company/<slug>/jobs, appends them, moves focus to the first new job and announces the result.
 */
export function CompanyJobsMore({ slug, page, start, end, total: initialTotal }: Props) {
  const [extra, setExtra] = useState<JobWithCompany[]>([])
  const [loadedPage, setLoadedPage] = useState(page)
  const [total, setTotal] = useState(initialTotal)
  const [exhausted, setExhausted] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [announcement, setAnnouncement] = useState('')
  const [interactive, setInteractive] = useState(false)
  const rowsRef = useRef<HTMLDivElement | null>(null)
  const focusFrom = useRef<number | null>(null)

  useEffect(() => setInteractive(true), [])

  // After the new jobs are in the DOM, put keyboard focus on the first of them.
  useEffect(() => {
    if (focusFrom.current === null) return
    const firstNew = rowsRef.current?.querySelectorAll('article')[focusFrom.current]
    focusFrom.current = null
    firstNew?.querySelector<HTMLElement>('a[href]')?.focus()
  }, [extra])

  const shownEnd = end + extra.length
  const hasMore = !exhausted && shownEnd < total
  if (!hasMore && extra.length === 0 && start === 0 && total <= end) return null

  const loadMore = async () => {
    if (state === 'loading') return
    setState('loading')
    try {
      const response = await fetch(`/api/company/${encodeURIComponent(slug)}/jobs?page=${loadedPage + 1}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as { jobs?: JobWithCompany[]; total?: number }
      const known = new Set(extra.map((job) => job.id))
      const fresh = (data.jobs ?? []).filter((job) => !known.has(job.id))
      const nextTotal = typeof data.total === 'number' ? data.total : total
      focusFrom.current = extra.length
      setExtra([...extra, ...fresh])
      setLoadedPage(loadedPage + 1)
      setTotal(nextTotal)
      setExhausted(fresh.length === 0)
      setAnnouncement(
        fresh.length === 0
          ? 'No more jobs to load.'
          : `${fresh.length} more ${fresh.length === 1 ? 'job' : 'jobs'} loaded. ${companyJobsShowingText(start, end + extra.length + fresh.length, nextTotal)}.`,
      )
      setState('idle')
    } catch {
      setState('error')
      setAnnouncement('Could not load more jobs. Try again, or open the next page.')
    }
  }

  const nextHref = companyJobsPagePath(slug, loadedPage + 1)
  const label = state === 'loading' ? 'Loading…' : 'Show more jobs'

  return (
    <>
      {extra.length > 0 ? (
        <div ref={rowsRef} className={styles.rows}>
          <JobRowList>
            {extra.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </JobRowList>
        </div>
      ) : null}

      <div className={styles.more}>
        <p className={styles.count}>{companyJobsShowingText(start, shownEnd, total)}</p>
        {hasMore ? (
          interactive ? (
            <button type="button" className={styles.button} onClick={loadMore} aria-busy={state === 'loading'} disabled={state === 'loading'}>
              {label}
            </button>
          ) : (
            <a className={styles.button} href={nextHref} rel="next">
              {label}
            </a>
          )
        ) : null}
        {state === 'error' ? (
          <p className={styles.error}>
            Could not load more jobs. <a href={nextHref}>Open the next page</a> instead.
          </p>
        ) : null}
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </>
  )
}
