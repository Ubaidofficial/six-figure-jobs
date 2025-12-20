'use client'

import * as React from 'react'
import { Bookmark, BookmarkCheck, Share2 } from 'lucide-react'

import styles from './JobActions.module.css'

const STORAGE_KEY = 'sfj:savedJobs:v1'

function readSaved(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function writeSaved(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

export function JobActions({
  jobId,
  shareUrl,
}: {
  jobId: string
  shareUrl: string
}) {
  const [saved, setSaved] = React.useState(false)
  const [status, setStatus] = React.useState<string>('')

  React.useEffect(() => {
    setSaved(readSaved().includes(jobId))
  }, [jobId])

  const toggleSaved = React.useCallback(() => {
    const current = readSaved()
    const next = current.includes(jobId)
      ? current.filter((id) => id !== jobId)
      : [...current, jobId]
    writeSaved(next)
    setSaved(next.includes(jobId))
    setStatus(next.includes(jobId) ? 'Saved job' : 'Removed saved job')
  }, [jobId])

  const share = React.useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ url: shareUrl })
        setStatus('Shared job')
        return
      }
    } catch {
      // fall back to copy
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setStatus('Copied link')
    } catch {
      setStatus('Unable to copy link')
    }
  }, [shareUrl])

  return (
    <>
      <span className={styles.status} aria-live="polite">
        {status}
      </span>
      <button
        type="button"
        className={styles.iconButton}
        onClick={toggleSaved}
        aria-label={saved ? 'Unsave job' : 'Save job'}
        aria-pressed={saved}
      >
        {saved ? <BookmarkCheck /> : <Bookmark />}
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={share}
        aria-label="Share job"
      >
        <Share2 />
      </button>
    </>
  )
}

