'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import JobCard from '../../components/JobCard'
import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import styles from '../JobsPage.module.css'

interface InfiniteJobsListProps {
  initialJobs: JobWithCompany[]
  initialPage: number
  totalPages: number
  view: 'grid' | 'list'
}

export function InfiniteJobsList({
  initialJobs,
  initialPage,
  totalPages,
  view,
}: InfiniteJobsListProps) {
  const [jobs, setJobs] = useState(initialJobs)
  const [page, setPage] = useState(initialPage)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(page < totalPages)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    setJobs(initialJobs)
    setPage(initialPage)
    setHasMore(initialPage < totalPages)
  }, [searchParams, initialJobs, initialPage, totalPages])

  useEffect(() => {
    if (!hasMore || loading) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { rootMargin: '400px' }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, loading, page])

  const loadMore = async () => {
    if (loading || !hasMore) return

    setLoading(true)
    const nextPage = page + 1

    try {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(nextPage))

      const response = await fetch(`/api/jobs?${params.toString()}`)
      const data = await response.json()

      if (data.jobs && data.jobs.length > 0) {
        setJobs((prev) => [...prev, ...data.jobs])
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
  }

  return (
    <>
      <div className={view === 'list' ? styles.list : styles.grid}>
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {loading && (
        <div className={view === 'list' ? styles.list : styles.grid}>
          {[...Array(6)].map((_, i) => (
            <SkeletonJobCard key={`skeleton-${i}`} />
          ))}
        </div>
      )}

      <div ref={loadMoreRef} className={styles.loadMoreTrigger} />

      {!hasMore && jobs.length > 0 && (
        <div className={styles.endMessage}>
          <p>You've reached the end! 🎉</p>
          <p className="text-sm text-slate-400">
            Showing all {jobs.length} jobs matching your filters
          </p>
        </div>
      )}
    </>
  )
}

function SkeletonJobCard() {
  return (
    <article className={`${styles.card} skeleton-shimmer`}>
      <div className={styles.cardInner}>
        <div className={styles.logoContainer}>
          <div className={`${styles.logoBox} bg-slate-800/50`} />
        </div>

        <div className={styles.content}>
          <div className={styles.titleRow}>
            <div className="h-5 w-3/4 rounded bg-slate-800/50" />
            <div className="mt-2 h-4 w-1/2 rounded bg-slate-800/50" />
          </div>

          <div className={styles.metadata}>
            <div className="h-6 w-16 rounded-full bg-slate-800/50" />
            <div className="h-6 w-20 rounded-full bg-slate-800/50" />
            <div className="h-6 w-24 rounded-full bg-slate-800/50" />
          </div>

          <div className="mt-3 space-y-2">
            <div className="h-3 w-full rounded bg-slate-800/50" />
            <div className="h-3 w-5/6 rounded bg-slate-800/50" />
          </div>
        </div>

        <div className={styles.actions}>
          <div className="h-16 w-full rounded-lg bg-slate-800/50" />
        </div>
      </div>
    </article>
  )
}
