'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import s from '../../admin.module.css'
import JobEditDrawer from './JobEditModal'
import type { JobRow } from './page'

const MODE: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }

export default function JobsTable({ jobs }: { jobs: JobRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function toggleExpired(job: JobRow) {
    if (!job.isExpired && !window.confirm(`Expire "${job.title}"? Its page will answer "gone" and Google is told.`)) return
    setBusy(job.id)
    const res = await fetch('/api/ubaid93/jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: job.id, isExpired: !job.isExpired }),
    })
    setBusy(null)
    if (res.ok) router.refresh()
  }

  if (jobs.length === 0) return <p className={s.empty}>No jobs match.</p>

  return (
    <>
      {editing ? (
        <JobEditDrawer
          id={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      ) : null}
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Job</th>
              <th>Pay shown</th>
              <th>Source</th>
              <th>Posted</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>
                  <a className={`${s.cellTitle} ${s.link}`} href={j.href} target="_blank" rel="noopener" title="Open the job page">
                    <span className={s.truncate} style={{ display: 'inline-block', verticalAlign: 'bottom' }}>
                      {j.title}
                    </span>
                  </a>
                  <div className={s.cellSub}>
                    {[j.company, j.location, j.remoteMode ? MODE[j.remoteMode] ?? j.remoteMode : null].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
                  {j.pay ?? <span className={s.dim}>not shown</span>}
                </td>
                <td className={s.mono}>{j.source}</td>
                <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
                  {j.posted}
                </td>
                <td>
                  <span className={`${s.status} ${j.isExpired ? s.muted : s.ok}`}>{j.isExpired ? 'Expired' : 'Live'}</span>
                </td>
                <td>
                  <div className={s.actions}>
                    <button className={s.btn} onClick={() => setEditing(j.id)}>
                      Edit
                    </button>
                    <button
                      className={`${s.btn} ${j.isExpired ? '' : s.btnDanger}`}
                      disabled={busy === j.id}
                      onClick={() => toggleExpired(j)}
                    >
                      {j.isExpired ? 'Restore' : 'Expire'}
                    </button>
                    {j.applyUrl ? (
                      <a className={s.btn} href={j.applyUrl} target="_blank" rel="noopener noreferrer" title="The employer's apply page">
                        Apply ↗
                      </a>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
