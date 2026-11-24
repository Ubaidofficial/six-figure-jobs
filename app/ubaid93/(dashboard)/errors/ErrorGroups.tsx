'use client'
import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import s from '../../admin.module.css'
import type { ErrorGroup } from '../../../../lib/admin/errorReports'
import { Sparkline } from '../visuals'
import { ActionError, useAction } from '../useAction'
import { ago } from '../ui'

type Group = Omit<ErrorGroup, 'firstSeen' | 'lastSeen' | 'ids' | 'daily'> & { firstSeen: string; lastSeen: string; recent: number[] }

export default function ErrorGroups({ groups, view, reportCount }: { groups: Group[]; view: string; reportCount: number }) {
  const [open, setOpen] = useState<string | null>(null)
  const { busy, failed, run } = useAction()
  const patch = (body: Record<string, unknown>, key: string) => run(key, '/api/ubaid93/errors', body)

  if (groups.length === 0) {
    return (
      <div className={s.panel}>
        <p className={s.empty}>{view === 'open' ? 'No open issues.' : 'Nothing here.'}</p>
      </div>
    )
  }

  return (
    <div className={s.panel}>
      <ActionError message={failed} />
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
              <th>14 days</th>
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
                    <td>
                      <Sparkline values={g.recent} width={84} height={22} />
                    </td>
                    <td className={s.num}>
                      {g.count.toLocaleString('en-US')}
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
                      <td colSpan={6}>
                        <div className={s.grid2}>
                          <div>
                            <div className={s.figureLabel}>Pages</div>
                            {g.pages.map((p) => (
                              <div key={p.path} className={s.mono}>
                                {p.count.toLocaleString('en-US')} · {p.path}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className={s.figureLabel}>Browsers</div>
                            {g.browsers.map((b) => (
                              <div key={b.name} className={s.mono}>
                                {b.count.toLocaleString('en-US')} · {b.name}
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
          {groups.length.toLocaleString('en-US')} issue{groups.length === 1 ? '' : 's'} · {reportCount.toLocaleString('en-US')} reports
        </span>
      </div>
    </div>
  )
}
