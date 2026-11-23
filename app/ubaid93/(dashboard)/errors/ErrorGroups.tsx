'use client'
import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'

import s from '../../admin.module.css'
import type { ErrorGroup } from '../../../../lib/admin/errorReports'

type Group = Omit<ErrorGroup, 'firstSeen' | 'lastSeen'> & { firstSeen: string; lastSeen: string }

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 60) return `${Math.max(min, 1)} min ago`
  const h = Math.round(min / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}

export default function ErrorGroups({ groups, view, reportCount }: { groups: Group[]; view: string; reportCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function patch(body: Record<string, unknown>, busyKey: string) {
    setBusy(busyKey)
    const res = await fetch('/api/ubaid93/errors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(null)
    if (res.ok) router.refresh()
  }

  if (groups.length === 0) {
    return (
      <div className={s.panel}>
        <p className={s.empty}>{view === 'open' ? 'No open issues.' : 'Nothing here.'}</p>
      </div>
    )
  }

  return (
    <div className={s.panel}>
      {view === 'noise' ? (
        <div className={s.toolbar} style={{ padding: '12px 14px 0', justifyContent: 'space-between' }}>
          <span className={s.dim}>
            Not the site&apos;s bugs (browser warnings, extensions). New reports like these are no longer stored.
          </span>
          <button className={s.btn} disabled={busy === 'noise'} onClick={() => patch({ noise: true, status: 'resolved' }, 'noise')}>
            Resolve all noise
          </button>
        </div>
      ) : null}
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <th>Issue</th>
              <th className={s.num}>Reports</th>
              <th>Last seen</th>
              <th>First seen</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const expanded = open === g.key
              const resolved = g.newCount === 0
              return (
                <Fragment key={g.key}>
                  <tr>
                    <td>
                      <button
                        className={s.footLink}
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Hide details' : 'Show details'}
                        onClick={() => setOpen(expanded ? null : g.key)}
                      >
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td>
                      <div className={s.cellTitle} style={{ wordBreak: 'break-word' }}>
                        {g.message}
                      </div>
                      <div className={s.cellSub}>
                        {g.pages[0]?.path}
                        {g.pages.length > 1 ? ` and ${g.pages.length - 1} more page${g.pages.length > 2 ? 's' : ''}` : ''}
                        {' · '}
                        {g.browsers.map((b) => b.name).join(', ')}
                      </div>
                    </td>
                    <td className={s.num}>
                      {g.count.toLocaleString()}
                      {g.newCount > 0 && g.newCount < g.count ? <div className={s.cellSub}>{g.newCount} new</div> : null}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{ago(g.lastSeen)}</td>
                    <td className={s.dim} style={{ whiteSpace: 'nowrap' }}>
                      {ago(g.firstSeen)}
                    </td>
                    <td>
                      <div className={s.actions}>
                        <button
                          className={s.btn}
                          disabled={busy === g.key}
                          onClick={() => patch({ key: g.key, status: resolved ? 'new' : 'resolved' }, g.key)}
                        >
                          {resolved ? 'Reopen' : 'Resolve'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td />
                      <td colSpan={5}>
                        <div className={s.grid2}>
                          <div>
                            <div className={s.figureLabel}>Pages</div>
                            {g.pages.map((p) => (
                              <div key={p.path} className={s.mono}>
                                {p.count.toLocaleString()} · {p.path}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className={s.figureLabel}>Browsers</div>
                            {g.browsers.map((b) => (
                              <div key={b.name} className={s.mono}>
                                {b.count.toLocaleString()} · {b.name}
                              </div>
                            ))}
                          </div>
                        </div>
                        {g.latestUrl ? (
                          <div className={s.cellSub} style={{ marginTop: 10, wordBreak: 'break-all' }}>
                            Latest: {g.latestUrl}
                          </div>
                        ) : null}
                        {g.latestStack ? <pre className={s.pre}>{g.latestStack}</pre> : <p className={s.cellSub}>No stack trace was sent.</p>}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className={s.pager}>
        <span>
          {groups.length.toLocaleString()} issue{groups.length === 1 ? '' : 's'} · {reportCount.toLocaleString()} reports
        </span>
      </div>
    </div>
  )
}
