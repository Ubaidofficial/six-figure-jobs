'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import s from '../../admin.module.css'

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  'broken-link': 'Broken link',
  'wrong-salary': 'Wrong salary',
  'wrong-logo': 'Wrong logo',
  'recruiter-posting': 'Recruiter posting',
  'fake-job': 'Fake or scam job',
  'job-other': 'Job report',
  suggestion: 'Suggestion',
  other: 'Other',
}

type Item = {
  id: string
  type: string
  message: string
  url: string | null
  hasScreenshot: boolean
  userAgent: string | null
  status: string
  createdAt: string
}

const NEXT: Record<string, Array<[string, string]>> = {
  new: [['reviewed', 'Mark reviewed'], ['resolved', 'Resolve']],
  reviewed: [['resolved', 'Resolve'], ['new', 'Mark new']],
  resolved: [['new', 'Reopen']],
}

/** The page a message was sent from, shown as its path; the full link opens it. */
function pageOf(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return url
  }
}

export default function FeedbackList({ items }: { items: Item[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function setStatus(id: string, status: string) {
    setBusy(id)
    const res = await fetch('/api/ubaid93/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setBusy(null)
    if (res.ok) router.refresh()
  }

  if (items.length === 0) return <p className={s.empty}>No messages here.</p>

  return (
    <ul className={s.checks}>
      {items.map((item) => (
        <li key={item.id} className={s.check} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <div className={s.cellSub} style={{ marginTop: 0, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span className={`${s.status} ${item.status === 'new' ? s.warn : item.status === 'reviewed' ? s.muted : s.ok}`}>
                {TYPE_LABELS[item.type] ?? item.type}
              </span>
              <span className={s.mono}>{item.createdAt.slice(0, 16).replace('T', ' ')}</span>
              <span>{item.status}</span>
            </div>
            <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.message}</p>
            {item.url ? (
              <a className={`${s.link} ${s.cellSub}`} style={{ display: 'inline-block', wordBreak: 'break-all' }} href={item.url} target="_blank" rel="noopener">
                {pageOf(item.url)}
              </a>
            ) : null}
            {item.hasScreenshot ? <ScreenshotThumb id={item.id} /> : null}
          </div>
          <div className={s.actions}>
            {(NEXT[item.status] ?? NEXT.new).map(([to, label]) => (
              <button key={to} className={s.btn} disabled={busy === item.id} onClick={() => setStatus(item.id, to)}>
                {label}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}

/** The pasted screenshot, opened full size in a new tab. Feedback sent before 2026-11-10 kept no image (404). */
function ScreenshotThumb({ id }: { id: string }) {
  const [missing, setMissing] = useState(false)
  const src = `/api/ubaid93/feedback/${encodeURIComponent(id)}/screenshot`
  if (missing) return <p className={s.cellSub}>Screenshot not stored (sent before screenshots were saved).</p>
  return (
    <a href={src} target="_blank" rel="noopener" style={{ display: 'inline-block', marginTop: 10 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- admin-only image behind a session check */}
      <img
        src={src}
        alt="Screenshot sent with this message"
        loading="lazy"
        onError={() => setMissing(true)}
        style={{ maxWidth: 320, maxHeight: 200, borderRadius: 8, boxShadow: '0 0 0 1px var(--color-border)', display: 'block' }}
      />
    </a>
  )
}
