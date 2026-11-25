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
  /** "≈ US$735k" beside pay in another currency; null for US dollars. */
  usdPay: string | null
  /** Days until the job page answers "gone" because the job is too old; null when unknown. */
  daysLeft: number | null
  href: string
  applyUrl: string | null
  reasons: string[]
  /** What the title cleaner would make of the title (lib/jobs/cleanTitle.ts); null when it leaves it as it is. */
  cleanedTitle: string | null
}

type Check = { verdict: 'closed' | 'open' | 'unknown'; lines: string[] } | { verdict: 'pending' } | { verdict: 'failed'; message: string }
const CHECK_TONE = { closed: s.bad, open: s.ok, unknown: s.warn } as const
const CHECK_LABEL = { closed: 'Looks closed', open: 'Looks open', unknown: 'Not sure' } as const

function daysLeftText(d: number | null): string | null {
  if (d == null) return null
  return d === 0 ? 'page gone within a day' :`page up ${d} more day${d === 1 ? '' : 's'}`
}

export default function ReviewTable({ rows, kind }: { rows: ReviewRow[]; kind: 'pay' | 'titles' }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [checks, setChecks] = useState<Record<string, Check>>({})
  const { busy, failed, run } = useAction()

  async function act(id: string, body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    if (await run(id, '/api/ubaid93/jobs', { id, ...body })) setDone((d) => new Set(d).add(id))
  }

  /** "Pay is right" or "Expire" on every ticked job, in one request. */
  async function actOnPicked(body: Record<string, unknown>, confirmText?: string) {
    const ids = visible.filter((r) => picked.has(r.id)).map((r) => r.id)
    if (ids.length === 0 || (confirmText && !window.confirm(confirmText.replace('{n}', String(ids.length))))) return
    if (await run('bulk', '/api/ubaid93/jobs', { ids, ...body })) {
      setDone((d) => new Set([...d, ...ids]))
      setPicked(new Set())
    }
  }

  async function checkEmployer(id: string) {
    setChecks((c) => ({ ...c, [id]: { verdict: 'pending' } }))
    try {
      const res = await fetch(`/api/ubaid93/jobs/check?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      setChecks((c) => ({ ...c, [id]: res.ok ? data : { verdict: 'failed', message: data?.error ?? `the server answered ${res.status}` } }))
    } catch {
      setChecks((c) => ({ ...c, [id]: { verdict: 'failed', message: 'the request did not reach the server' } }))
    }
  }

  const visible = rows.filter((r) => !done.has(r.id))
  if (visible.length === 0) return <p className={s.empty}>Nothing to review.</p>
  const pickedCount = visible.filter((r) => picked.has(r.id)).length
  const allPicked = pickedCount === visible.length
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
      {pickedCount > 0 ? (
        <div className={s.toolbar} style={{ margin: 0, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }} role="region" aria-label="Selected jobs">
          <strong>{pickedCount} selected</strong>
          {kind === 'pay' ? (
            <button className={s.btn} disabled={busy === 'bulk'} onClick={() => actOnPicked({ needsReview: false })}>
              Pay is right
            </button>
          ) : null}
          <button
            className={`${s.btn} ${s.btnDanger}`}
            disabled={busy === 'bulk'}
            onClick={() => actOnPicked({ isExpired: true }, 'Expire {n} jobs? Their pages will answer "gone" and Google is told.')}
          >
            Expire
          </button>
          <button className={s.btn} onClick={() => setPicked(new Set())}>
            Clear
          </button>
        </div>
      ) : null}
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  className={s.tick}
                  aria-label={allPicked ? 'Untick all' : 'Tick all'}
                  checked={allPicked}
                  onChange={() => setPicked(allPicked ? new Set() : new Set(visible.map((r) => r.id)))}
                />
              </th>
              <th>Job</th>
              <th>Pay shown</th>
              {/* On the pay tab every row's reason is the tab itself. */}
              {kind === 'titles' ? <th>Why</th> : null}
              <th>Posted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const check = checks[r.id]
              return (
                <tr key={r.id}>
                  <td>
                    <input type="checkbox" className={s.tick} aria-label={`Tick ${r.title}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  <td style={{ maxWidth: 440 }}>
                    <a className={`${s.cellTitle} ${s.link}`} href={r.href} target="_blank" rel="noopener" style={{ wordBreak: 'break-word' }}>
                      {r.title}
                    </a>
                    <div className={s.cellSub}>{[r.company, r.location, r.source].filter(Boolean).join(' · ')}</div>
                    {r.cleanedTitle ? (
                      <div className={s.cellSub} style={{ marginTop: 6 }}>
                        Cleaned: <strong style={{ wordBreak: 'break-word' }}>{r.cleanedTitle}</strong>{' '}
                        <button
                          className={s.btn}
                          disabled={busy === r.id}
                          onClick={() => act(r.id, { cleanTitle: true }, `Change the title to "${r.cleanedTitle}"? The page address changes; the old one redirects.`)}
                        >
                          Use cleaned title
                        </button>
                      </div>
                    ) : null}
                    {check ? (
                      <div className={s.cellSub} style={{ marginTop: 6 }} aria-live="polite">
                        {check.verdict === 'pending' ? (
                          'Checking the employer…'
                        ) : check.verdict === 'failed' ? (
                          <span className={s.error}>Check failed: {check.message}.</span>
                        ) : (
                          <>
                            <span className={`${s.status} ${CHECK_TONE[check.verdict]}`}>{CHECK_LABEL[check.verdict]}</span> {check.lines.join(' ')}
                          </>
                        )}
                      </div>
                    ) : null}
                  </td>
                  <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
                    {r.pay ?? <span className={s.dim}>not shown</span>}
                    {r.usdPay ? <div className={s.cellSub}>{r.usdPay}</div> : null}
                  </td>
                  {kind === 'titles' ? <td className={s.dim}>{r.reasons.join(', ') || 'odd title'}</td> : null}
                  <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
                    {r.posted}
                    {daysLeftText(r.daysLeft) ? <div className={s.cellSub}>{daysLeftText(r.daysLeft)}</div> : null}
                  </td>
                  <td>
                    <div className={s.actions}>
                      {r.applyUrl ? (
                        <>
                          <a className={s.btn} href={r.applyUrl} target="_blank" rel="noopener noreferrer" title="Open the employer's page">
                            Employer ↗
                          </a>
                          <button
                            className={s.btn}
                            disabled={check?.verdict === 'pending'}
                            onClick={() => checkEmployer(r.id)}
                            title="Ask whether the job is still open where it was posted (nothing is changed)"
                          >
                            Check
                          </button>
                        </>
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
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
