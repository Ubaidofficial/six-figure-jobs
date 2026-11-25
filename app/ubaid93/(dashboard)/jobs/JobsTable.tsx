'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import s from '../../admin.module.css'
import { ActionError, useAction } from '../useAction'
import JobEditDrawer from './JobEditModal'
import type { JobRow } from './page'

const MODE: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }
const STATUS: Record<JobRow['availability'], { label: string; tone: string; title: string }> = {
  available: { label: 'Live', tone: s.ok, title: 'The job page is up' },
  stale: { label: 'Too old', tone: s.warn, title: 'Not expired, but posted too long ago: the job page answers "gone" and no listing shows it' },
  expired: { label: 'Expired', tone: s.muted, title: 'The job page answers "gone"' },
}

function modeLabel(j: JobRow): string | null {
  const mode = j.remoteMode ? MODE[j.remoteMode] ?? j.remoteMode : null
  return mode && mode.toLowerCase() !== (j.location ?? '').trim().toLowerCase() ? mode : null
}

export default function JobsTable({ jobs }: { jobs: JobRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const { busy, failed, run } = useAction()

  async function toggleExpired(job: JobRow) {
    if (!job.isExpired && !window.confirm(`Expire "${job.title}"? Its page will answer "gone" and Google is told.`)) return
    await run(job.id, '/api/ubaid93/jobs', { id: job.id, isExpired: !job.isExpired })
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
      <ActionError message={failed} />
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
                    {/* The work arrangement only when the location does not already say it ("Remote · Remote"). */}
                    {[j.company, j.location, modeLabel(j)].filter(Boolean).join(' · ')}
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
                  <span className={`${s.status} ${STATUS[j.availability].tone}`} title={STATUS[j.availability].title}>
                    {STATUS[j.availability].label}
                  </span>
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
