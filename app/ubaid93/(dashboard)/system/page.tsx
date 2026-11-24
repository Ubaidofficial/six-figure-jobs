// Admin: the pipeline behind the site. Where jobs come from and how fresh each source is, the Google Indexing queue,
// which features are switched on (booleans only, never a value), and accounts. Read-only.
import { accountsEnabled } from '../../../../lib/accounts/enabled'
import { alertsEnabled } from '../../../../lib/alerts/config'
import { autoApplyEnabled, autoApplyLive } from '../../../../lib/autoapply/config'
import { ALERT_LABELS, ALERT_STATE_KEY, alertRecipient, emailConfigured, healthAlertsEveryMs, parseAlertState } from '../../../../lib/admin/healthAlerts'
import type { CheckKey } from '../../../../lib/admin/health'
import { maskEmail } from '../../../../lib/alerts/service'
import { prisma } from '../../../../lib/prisma'
import { loadHealthChecks } from '../overview'
import { PageHead, Section, Status, ago, lastDays, s, stamp } from '../ui'
import { Sparkline } from '../visuals'
import TestAlertButton from './TestAlertButton'
import { requireAdmin } from '../requireAdmin'

export const dynamic = 'force-dynamic'

type SourceRow = { source: string; live: number; added24h: number; added7d: number; newest: Date | null }

export default async function SystemPage() {
  await requireAdmin()
  const now = Date.now()
  // The 14 complete days before today, for the per-source sparklines (today's partial count would read as a drop).
  const days14 = lastDays(15).slice(0, -1)
  const [checks, sources, queue, failures, users, subs, alertRow, perDay] = await Promise.all([
    loadHealthChecks(now),
    prisma.$queryRaw<SourceRow[]>`
      SELECT source,
        count(*) FILTER (WHERE "isExpired" = false)::int AS live,
        count(*) FILTER (WHERE "createdAt" >= now() - interval '24 hours')::int AS "added24h",
        count(*) FILTER (WHERE "createdAt" >= now() - interval '7 days')::int AS "added7d",
        max("createdAt") AS newest
      FROM "Job"
      -- Only rows that can pass the HAVING below, so the long tail of old expired jobs is not read on every visit.
      WHERE "isExpired" = false OR "createdAt" >= now() - interval '30 days'
      GROUP BY source
      HAVING count(*) FILTER (WHERE "isExpired" = false) > 0 OR max("createdAt") >= now() - interval '30 days'
      ORDER BY live DESC LIMIT 40`,
    prisma.jobIndexingQueue.groupBy({ by: ['status', 'type'], _count: { _all: true } }),
    prisma.jobIndexingQueue.findMany({
      where: { status: 'failed' },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { url: true, type: true, lastError: true, attempts: true, updatedAt: true },
    }),
    prisma.user.groupBy({ by: ['emailVerified'], _count: { _all: true } }).catch(() => []),
    prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }).catch(() => []),
    prisma.siteConfig.findUnique({ where: { key: ALERT_STATE_KEY } }),
    prisma.$queryRaw<Array<{ source: string; d: string; n: number }>>`
      SELECT source, to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM "Job" WHERE "isExpired" IN (true, false) AND "createdAt" >= ${new Date(`${days14[0]}T00:00:00Z`)}
      GROUP BY 1, 2`,
  ])
  const added = new Map<string, number[]>()
  for (const r of perDay) {
    const row = added.get(r.source) ?? days14.map(() => 0)
    const i = days14.indexOf(r.d)
    if (i >= 0) row[i] = Number(r.n)
    added.set(r.source, row)
  }
  const liveTotal = sources.reduce((n, r) => n + r.live, 0) || 1
  const alertState = parseAlertState(alertRow?.value)
  const recipient = alertRecipient()
  const canEmail = Boolean(recipient) && emailConfigured()
  const everyMs = healthAlertsEveryMs()
  const openAlerts = (Object.keys(alertState.open) as CheckKey[]).map((k) => ALERT_LABELS[k] ?? k)

  const userTotal = users.reduce((n, u) => n + u._count._all, 0)
  const verified = users.filter((u) => u.emailVerified).reduce((n, u) => n + u._count._all, 0)
  const flags: Array<[string, boolean, string]> = [
    ['Accounts and billing', accountsEnabled(), 'ACCOUNTS_ENABLED'],
    ['Email job alerts', alertsEnabled(), 'ALERTS_ENABLED + email settings'],
    ['Auto-apply shown', autoApplyEnabled(), 'AUTO_APPLY_ENABLED'],
    ['Auto-apply submits for real', autoApplyLive(), 'AUTO_APPLY_LIVE'],
  ]

  return (
    <>
      <PageHead title="System" lede="Where jobs come from, how fresh each source is, and what is switched on." />

      <Section title="Health">
        <ul className={`${s.panel} ${s.checks}`}>
          {checks.map((c) => (
            <li key={c.label} className={s.check}>
              <span className={s.checkLabel}>{c.label}</span>
              <div>
                <Status tone={c.tone}>{c.state}</Status>
                {c.detail ? <div className={s.checkNote}>{c.detail}</div> : null}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Alert emails" note="When a check above turns red, and when it is fixed">
        <ul className={`${s.panel} ${s.checks}`}>
          <li className={s.check}>
            <span className={s.checkLabel}>Sends to</span>
            <span>
              <Status tone={canEmail ? 'ok' : 'warn'}>
                {recipient ? maskEmail(recipient) : 'No address set'}
                {recipient && !emailConfigured() ? ' (no email provider set)' : ''}
              </Status>
              <span className={s.checkDetail}>OPS_ALERT_EMAIL, else ALERTS_OWNER_EMAIL</span>
              <div style={{ marginTop: 8 }}>
                <TestAlertButton disabled={!canEmail} />
              </div>
            </span>
          </li>
          <li className={s.check}>
            <span className={s.checkLabel}>Checks</span>
            <span>
              {everyMs ? `Every ${Math.round(everyMs / 60_000)} minutes` : 'Off (HEALTH_ALERTS_EVERY_MIN is 0 or below)'}
              <span className={s.checkDetail}>
                {alertState.lastRunAt ? `last run ${ago(alertState.lastRunAt, now)}` : 'not run yet (first run 10 minutes after a deploy)'}
                {openAlerts.length ? ` · emailed about, still open: ${openAlerts.join(', ')}` : ''}
              </span>
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Sources" note="Sources with live jobs or a job added in the last 30 days">
        <div className={`${s.panel} ${s.tableWrap}`}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Source</th>
                <th className={s.num}>Not expired</th>
                <th>Share</th>
                <th>Added per day, 14 days</th>
                <th className={s.num}>Added 24 h</th>
                <th className={s.num}>Added 7 days</th>
                <th>Last job added</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((r) => {
                const hours = r.newest ? (now - new Date(r.newest).getTime()) / 3_600_000 : Infinity
                return (
                  <tr key={r.source}>
                    <td className={s.mono}>{r.source.replace(/^board:/, '')}</td>
                    <td className={s.num}>{r.live.toLocaleString('en-US')}</td>
                    <td style={{ minWidth: 120 }}>
                      <span className={s.barTrack} style={{ display: 'block' }} title={`${Math.round((r.live / liveTotal) * 100)}% of jobs not expired`}>
                        <span className={s.barFill} style={{ width: `${Math.max(1, (r.live / liveTotal) * 100)}%` }} />
                      </span>
                    </td>
                    <td>
                      <Sparkline values={added.get(r.source) ?? days14.map(() => 0)} width={110} height={22} />
                    </td>
                    <td className={s.num}>{r.added24h.toLocaleString('en-US')}</td>
                    <td className={s.num}>{r.added7d.toLocaleString()}</td>
                    <td>
                      <Status tone={hours <= 24 ? 'ok' : hours <= 72 ? 'warn' : 'muted'}>{ago(r.newest, now)}</Status>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className={s.grid2}>
        <Section title="Google Indexing queue">
          <div className={s.panel}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Notice</th>
                  <th className={s.num}>Count</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={s.dim}>
                      Empty.
                    </td>
                  </tr>
                ) : (
                  queue
                    .sort((a, b) => a.status.localeCompare(b.status) || a.type.localeCompare(b.type))
                    .map((q) => (
                      <tr key={`${q.status}-${q.type}`}>
                        <td>
                          <Status tone={q.status === 'failed' ? 'bad' : q.status === 'pending' ? 'warn' : q.status === 'sent' ? 'ok' : 'muted'}>
                            {q.status}
                          </Status>
                        </td>
                        <td className={s.mono}>{q.type}</td>
                        <td className={s.num}>{q._count._all.toLocaleString()}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
            {failures.length > 0 ? (
              <div className={s.panelPad} style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className={s.figureLabel}>Latest failures</div>
                {failures.map((f) => (
                  <div key={f.url + f.type} className={s.cellSub} style={{ wordBreak: 'break-word' }}>
                    {stamp(f.updatedAt)} · {f.type} · {f.url} · {(f.lastError ?? 'no error text').slice(0, 160)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Switches" note="Set in Openship; values are never shown">
          <ul className={`${s.panel} ${s.checks}`}>
            {flags.map(([label, on, env]) => (
              <li key={label} className={s.check}>
                <span className={s.checkLabel}>{label}</span>
                <span>
                  <Status tone={on ? 'ok' : 'muted'}>{on ? 'On' : 'Off'}</Status>
                  <span className={s.checkDetail}>{env}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className={s.grid2}>
        <Section title="Accounts">
          <ul className={`${s.panel} ${s.checks}`}>
            <li className={s.check}>
              <span className={s.checkLabel}>Users</span>
              <span className={s.mono}>
                {userTotal.toLocaleString()} <span className={s.dim}>({verified.toLocaleString()} with a verified email)</span>
              </span>
            </li>
            <li className={s.check}>
              <span className={s.checkLabel}>Subscriptions</span>
              <span className={s.mono}>
                {subs.length === 0
                  ? 'none'
                  : subs.map((x) => `${x._count._all.toLocaleString()} ${x.status}`).join(' · ')}
              </span>
            </li>
          </ul>
        </Section>

      </div>
    </>
  )
}
