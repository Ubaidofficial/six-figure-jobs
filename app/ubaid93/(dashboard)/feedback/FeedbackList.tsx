'use client'
import { useState } from 'react'

import s from '../../admin.module.css'
import JobEditDrawer from '../jobs/JobEditModal'
import { ActionError, useAction } from '../useAction'

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

/** The job a report is about, as the job page shows it. */
export type ReportedJob = {
  id: string
  title: string
  company: string | null
  source: string
  isExpired: boolean
  pay: string | null
  href: string
  applyUrl: string | null
  openReports: number
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
  jobId: string | null
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

/** A report's message without the "Job: … (id)" line, which the job card replaces. */
function reportText(message: string): string {
  return message
    .split('\n')
    .filter((l) => !/^Job: .*\([^()]+\)\s*$/.test(l))
    .join('\n')
}

export default function FeedbackList({ items, jobs }: { items: Item[]; jobs: Record<string, ReportedJob> }) {
  const [editing, setEditing] = useState<string | null>(null)
  const { busy, failed, run, refresh } = useAction()

  const setStatus = (id: string, status: string) => run(id, '/api/ubaid93/feedback', { id, status })

  /** Expires the job (Google is told, as by the automatic checks) and resolves every report about it. */
  async function expireAndResolve(itemId: string, job: ReportedJob) {
    if (!window.confirm(`Expire "${job.title}" and resolve its ${job.openReports} open report${job.openReports === 1 ? '' : 's'}?`)) return
    if (await run(itemId, '/api/ubaid93/jobs', { id: job.id, isExpired: true }, { refresh: false })) {
      await run(itemId, '/api/ubaid93/feedback', { jobId: job.id, status: 'resolved' })
    } else refresh()
  }

  const resolveAll = (itemId: string, job: ReportedJob) => run(itemId, '/api/ubaid93/feedback', { jobId: job.id, status: 'resolved' })

  if (items.length === 0) return <p className={s.empty}>No messages here.</p>

  return (
    <>
      {editing ? (
        <JobEditDrawer
          id={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      ) : null}
      <ActionError message={failed} />
      <ul className={s.checks}>
        {items.map((item) => {
          const job = item.jobId ? jobs[item.jobId] : undefined
          return (
            <li key={item.id} className={s.check} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}>
                <div className={s.cellSub} style={{ marginTop: 0, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span className={`${s.status} ${item.status === 'new' ? s.warn : item.status === 'reviewed' ? s.muted : s.ok}`}>
                    {TYPE_LABELS[item.type] ?? item.type}
                  </span>
                  <span className={s.mono}>{item.createdAt.slice(0, 16).replace('T', ' ')}</span>
                  <span>{item.status}</span>
                </div>
                <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {item.jobId ? reportText(item.message) : item.message}
                </p>

                {item.jobId ? (
                  job ? (
                    <div className={s.notice} style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                      <div>
                        <a className={`${s.cellTitle} ${s.link}`} href={job.href} target="_blank" rel="noopener">
                          {job.title}
                        </a>
                        <div className={s.cellSub}>
                          {[job.company, job.source, job.pay ?? 'no pay shown'].filter(Boolean).join(' · ')}
                        </div>
                        <div className={s.cellSub}>
                          <span className={`${s.status} ${job.isExpired ? s.muted : s.ok}`}>{job.isExpired ? 'Expired' : 'Live'}</span>
                          {job.openReports > 1 ? <span className={s.checkDetail}>{job.openReports} open reports on this job</span> : null}
                        </div>
                      </div>
                      <div className={s.toolbar} style={{ margin: 0 }}>
                        <button className={s.btn} onClick={() => setEditing(job.id)}>
                          Edit job
                        </button>
                        {!job.isExpired ? (
                          <button className={`${s.btn} ${s.btnDanger}`} disabled={busy === item.id} onClick={() => expireAndResolve(item.id, job)}>
                            Expire and resolve
                          </button>
                        ) : null}
                        {job.openReports > 1 ? (
                          <button className={s.btn} disabled={busy === item.id} onClick={() => resolveAll(item.id, job)}>
                            Resolve all {job.openReports}
                          </button>
                        ) : null}
                        {job.applyUrl ? (
                          <a className={s.btn} href={job.applyUrl} target="_blank" rel="noopener noreferrer" title="Check the employer's page">
                            Employer page ↗
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className={s.cellSub}>The reported job is no longer in the database.</p>
                  )
                ) : item.url ? (
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
          )
        })}
      </ul>
    </>
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
