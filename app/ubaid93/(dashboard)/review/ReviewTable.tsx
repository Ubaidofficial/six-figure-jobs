'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import s from '../../admin.module.css'
import JobEditDrawer from '../jobs/JobEditModal'
import { ActionError, useAction } from '../useAction'

export type ReviewRow = {
  id: string
  title: string
  company: string | null
  location: string | null
  source: string
  posted: string
  pay: string | null
  href: string
  applyUrl: string | null
  reasons: string[]
}

export default function ReviewTable({ rows, kind }: { rows: ReviewRow[]; kind: 'pay' | 'titles' }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const { busy, failed, run } = useAction()

  async function act(id: string, body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    if (await run(id, '/api/ubaid93/jobs', { id, ...body })) setDone((d) => new Set(d).add(id))
  }

  const visible = rows.filter((r) => !done.has(r.id))
  if (visible.length === 0) return <p className={s.empty}>Nothing to review.</p>

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
              {/* On the pay tab every row's reason is the tab itself. */}
              {kind === 'titles' ? <th>Why</th> : null}
              <th>Posted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={{ maxWidth: 440 }}>
                  <a className={`${s.cellTitle} ${s.link}`} href={r.href} target="_blank" rel="noopener" style={{ wordBreak: 'break-word' }}>
                    {r.title}
                  </a>
                  <div className={s.cellSub}>{[r.company, r.location, r.source].filter(Boolean).join(' · ')}</div>
                </td>
                <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
                  {r.pay ?? <span className={s.dim}>not shown</span>}
                </td>
                {kind === 'titles' ? <td className={s.dim}>{r.reasons.join(', ') || 'odd title'}</td> : null}
                <td className={s.mono}>{r.posted}</td>
                <td>
                  <div className={s.actions}>
                    {r.applyUrl ? (
                      <a className={s.btn} href={r.applyUrl} target="_blank" rel="noopener noreferrer" title="Check the employer's page">
                        Employer ↗
                      </a>
                    ) : null}
                    <button className={s.btn} onClick={() => setEditing(r.id)}>
                      Edit
                    </button>
                    {kind === 'pay' ? (
                      <button className={s.btn} disabled={busy === r.id} onClick={() => act(r.id, { needsReview: false })}>
                        Pay is right
                      </button>
                    ) : null}
                    <button
                      className={`${s.btn} ${s.btnDanger}`}
                      disabled={busy === r.id}
                      onClick={() => act(r.id, { isExpired: true }, `Expire "${r.title}"? Its page will answer "gone" and Google is told.`)}
                    >
                      Expire
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
