// app/hooks/useJobScraper.js

'use client'

import { useState, useEffect, useCallback } from 'react'

const CACHE_KEY = 'jobs'
const CACHE_TIME_KEY = 'jobsCacheTime'
const CACHE_META_KEY = 'jobsCacheMeta'
const CACHE_DURATION_MS = 30 * 60 * 1000 // 30 minutes

export function useJobScraper() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('Initializing…')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [sourceStats, setSourceStats] = useState(null)

  // Small helper to read cache safely
  const loadCache = () => {
    if (typeof window === 'undefined') return null

    try {
      const rawJobs = window.localStorage.getItem(CACHE_KEY)
      const rawTime = window.localStorage.getItem(CACHE_TIME_KEY)
      const rawMeta = window.localStorage.getItem(CACHE_META_KEY)

      if (!rawJobs || !rawTime) return null

      const ts = parseInt(rawTime, 10)
      if (!Number.isFinite(ts)) return null

      const age = Date.now() - ts
      if (age > CACHE_DURATION_MS) return null

      const parsedJobs = JSON.parse(rawJobs)
      if (!Array.isArray(parsedJobs) || parsedJobs.length === 0) {
        // Don’t reuse an empty cache
        return null
      }

      const meta = rawMeta ? JSON.parse(rawMeta) : null

      return { jobs: parsedJobs, meta }
    } catch (e) {
      console.error('❌ Error loading cached jobs:', e)
      return null
    }
  }

  const saveCache = (jobsToCache, meta = null) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(jobsToCache))
      window.localStorage.setItem(CACHE_TIME_KEY, Date.now().toString())
      if (meta) {
        window.localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta))
      }
    } catch (e) {
      console.warn('⚠️ Failed to cache jobs:', e)
    }
  }

  const scrapeJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    setStatus('Fetching fresh roles…')
    setProgress(10)

    try {
      const response = await fetch('/api/scrape', {
        method: 'GET',
        cache: 'no-store',
      })

      setProgress(40)

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json().catch((e) => {
        throw new Error('Failed to parse API response JSON')
      })

      setProgress(70)

      const rawJobs = Array.isArray(data.jobs) ? data.jobs : []
      const jobsWithIds = rawJobs.map((job, index) => ({
        ...job,
        id:
          job.id ||
          `${job.source || 'job'}-${job.company || 'company'}-${job.title || 'role'}-${index}`
            .replace(/\s+/g, '-')
            .toLowerCase(),
      }))

      console.log('✅ Processed jobs:', jobsWithIds.length)
      if (data?.sourceStats) {
        console.log('📊 Source stats:', data.sourceStats)
        setSourceStats(data.sourceStats)
      } else {
        setSourceStats(null)
      }

      setJobs(jobsWithIds)
      setProgress(100)
      setStatus(
        jobsWithIds.length
          ? `Found ${jobsWithIds.length} $100k+ roles`
          : 'No roles found (try again soon)'
      )

      // Only cache if we actually have some jobs
      if (jobsWithIds.length > 0) {
        saveCache(jobsWithIds, { count: jobsWithIds.length })
      }
    } catch (err) {
      console.error('❌ Scraping error:', err)
      setError(err.message || 'Unknown error')
      setStatus('Error fetching roles')
      setProgress(100)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    const cached = loadCache()
    if (cached) {
      console.log('✅ Loaded jobs from cache:', cached.jobs.length)
      setJobs(cached.jobs)
      setSourceStats(cached.meta?.sourceStats || null)
      setLoading(false)
      setProgress(100)
      setStatus(`Loaded ${cached.jobs.length} cached $100k+ roles`)
      return
    }

    console.log('🚀 No fresh cache, starting auto-scrape…')
    scrapeJobs()
  }, [scrapeJobs])

  return {
    jobs,
    loading,
    status,
    progress,
    error,
    sourceStats,
    refreshJobs: scrapeJobs,
  }
}
