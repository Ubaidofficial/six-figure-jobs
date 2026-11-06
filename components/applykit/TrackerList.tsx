'use client'

import * as React from 'react'
import Link from 'next/link'

import { KIT_STATUSES } from '@/lib/applykit/config'

import styles from './applykit.module.css'

export interface TrackerRow {
  id: string
  jobSlug: string
  jobTitle: string
  companyName: string
  applyUrl: string | null
  status: string
  notes: string
  createdAt: string
}

const LABELS: Record<string, string> = { saved: 'Saved', applied: 'Applied', interview: 'Interview', offer: 'Offer', rejected: 'Rejected' }

async function patch(id: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/kit/status', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    return res.ok
  } catch {
    return false
  }
}

function Row({ row }: { row: TrackerRow }) {
  const [status, setStatus] = React.useState(row.status)
  const [notes, setNotes] = React.useState(row.notes)
  const [saved, setSaved] = React.useState(row.notes)
  const [error, setError] = React.useState(false)
  const safeApply = row.applyUrl && /^https?:\/\//i.test(row.applyUrl) ? row.applyUrl : null

  return (
    <tr>
      <td>
        <Link href={`/account/kit/${encodeURIComponent(row.jobSlug)}`} prefetch={false}>
          {row.jobTitle}
        </Link>
        <div className={styles.small}>{row.companyName}</div>
        {safeApply ? (
          <a href={safeApply} target="_blank" rel="noopener noreferrer nofollow" className={styles.small}>
            Apply on the employer site
          </a>
        ) : null}
      </td>
      <td>
        <select
          className={styles.select}
          aria-label={`Status for ${row.jobTitle}`}
          value={status}
          onChange={async (e) => {
            const next = e.target.value
            const previous = status
            setStatus(next)
            const ok = await patch(row.id, { status: next })
            setError(!ok)
            if (!ok) setStatus(previous)
          }}
        >
          {KIT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <textarea
          className={`${styles.textarea} ${styles.notes}`}
          aria-label={`Notes for ${row.jobTitle}`}
          value={notes}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={async () => {
            if (notes === saved) return
            const ok = await patch(row.id, { notes })
            setError(!ok)
            if (ok) setSaved(notes)
          }}
        />
        {error ? (
          <p role="alert" className={styles.small}>
            Could not save. Try again.
          </p>
        ) : null}
      </td>
    </tr>
  )
}

export function TrackerList({ rows }: { rows: TrackerRow[] }) {
  if (rows.length === 0) {
    return <p className={styles.hint}>Nothing here yet. Open a job and choose “Write a cover letter for this job”.</p>
  }
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Status</th>
          <th scope="col">Notes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Row key={r.id} row={r} />
        ))}
      </tbody>
    </table>
  )
}
