'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { JobRow, JobRowList } from '@/components/jobs/JobRow'
import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import styles from '@/components/listing/Listing.module.css'

interface InfiniteJobsListProps {
  initialJobs: JobWithCompany[]
  initialPage: number
  totalPages: number
}

export function InfiniteJobsList({
  initialJobs,
  initialPage,
  totalPages,
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
      <JobRowList>
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </JobRowList>

      {loading && (
        <div className={styles.rows} aria-hidden="true">
          {[...Array(4)].map((_, i) => (
            <SkeletonRow key={`skeleton-${i}`} />
          ))}
        </div>
      )}

      <div ref={loadMoreRef} aria-hidden="true" />

      {!hasMore && jobs.length > 0 && (
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
