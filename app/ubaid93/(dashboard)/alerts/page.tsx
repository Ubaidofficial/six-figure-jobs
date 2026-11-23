// Admin: who signed up for email job alerts, whether they confirmed, and which pages bring signups.
import { prisma } from '../../../../lib/prisma'
import { buildAlertLabel, sanitizeAlertFilters } from '../../../../lib/alerts/filters'
import { alertsEnabled } from '../../../../lib/alerts/config'
import { Figures, PageHead, Section, s } from '../ui'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000
const date = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : '–')

export default async function AlertsAdminPage() {
  const since7 = new Date(Date.now() - 7 * DAY)
  const since30 = new Date(Date.now() - 30 * DAY)

  let error: string | null = null
  let byStatus: Record<string, number> = {}
  let subscribers = 0
  let new7 = 0
  let new30 = 0
  let confirmed30 = 0
  let sources: Array<{ source: string; n: number }> = []
  let recent: Awaited<ReturnType<typeof loadRecent>> = []

  try {
    const [statuses, distinct, n7, n30, c30, src, rows] = await Promise.all([
      prisma.jobAlert.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.$queryRaw<Array<{ n: number }>>`SELECT COUNT(DISTINCT "email")::int AS n FROM "JobAlert" WHERE "status" = 'active'`,
      prisma.jobAlert.count({ where: { createdAt: { gte: since7 } } }),
      prisma.jobAlert.count({ where: { createdAt: { gte: since30 } } }),
      prisma.jobAlert.count({ where: { createdAt: { gte: since30 }, confirmedAt: { not: null } } }),
      prisma.jobAlert.groupBy({
        by: ['source'],
        where: { createdAt: { gte: since30 } },
        _count: { _all: true },
        orderBy: { _count: { source: 'desc' } },
        take: 15,
      }),
      loadRecent(),
    ])
    byStatus = Object.fromEntries(statuses.map((s) => [s.status, s._count._all]))
    subscribers = distinct[0]?.n ?? 0
    new7 = n7
    new30 = n30
    confirmed30 = c30
    sources = src.map((s) => ({ source: s.source ?? '(unknown)', n: s._count._all }))
    recent = rows
  } catch {
    error = 'Alert tables not available yet. Apply the add_job_alerts migration, then reload.'
  }

  const statusTone = (st: string) => (st === 'active' ? s.ok : st === 'pending' ? s.warn : s.muted)

  return (
    <>
      <PageHead
        title="Job alerts"
        lede={
          <>
            Email alert signups. An address counts as a subscriber only after it clicked the confirmation link.
            {alertsEnabled() ? '' : ' Alerts are switched off: no form is shown and nothing is sent (docs/job-alerts-launch-checklist.md).'}
          </>
        }
        actions={
          <a className={s.btn} href="/api/ubaid93/alerts/export">
            Download active subscribers (CSV)
          </a>
        }
      />

      {error ? (
        <p className={s.notice}>{error}</p>
      ) : (
        <>
          <Figures
            items={[
              { label: 'Subscribers', value: subscribers.toLocaleString(), sub: 'unique confirmed emails' },
              { label: 'Active alerts', value: (byStatus.active ?? 0).toLocaleString() },
              { label: 'Awaiting confirmation', value: (byStatus.pending ?? 0).toLocaleString() },
              { label: 'Unsubscribed', value: (byStatus.unsubscribed ?? 0).toLocaleString() },
              { label: 'Signups, 7 days', value: new7.toLocaleString(), sub: `${new30.toLocaleString()} in 30 days` },
              {
                label: 'Confirmed',
                value: new30 ? `${Math.round((confirmed30 / new30) * 100)}%` : '–',
                sub: 'of 30-day signups',
              },
            ]}
          />

          <Section title="Latest signups" note="Newest 100. Emails are personal data: do not copy them elsewhere.">
            <div className={`${s.panel} ${s.tableWrap}`}>
              {recent.length === 0 ? (
                <p className={s.empty}>No signups yet.</p>
              ) : (
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Alert</th>
                      <th>Status</th>
                      <th>From page</th>
                      <th>Signed up</th>
                      <th>Confirmed</th>
                      <th>Last email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.id}>
                        <td className={s.mono}>{r.email}</td>
                        <td>{r.firstName ?? <span className={s.dim}>–</span>}</td>
                        <td>
                          {buildAlertLabel(sanitizeAlertFilters(r.filters) ?? {})}
                          <div className={s.cellSub}>{r.frequency}</div>
                        </td>
                        <td>
                          <span className={`${s.status} ${statusTone(r.status)}`}>{r.status}</span>
                        </td>
                        <td className={`${s.mono} ${s.dim}`}>{r.source ?? '–'}</td>
                        <td className={s.mono}>{date(r.createdAt)}</td>
                        <td className={s.mono}>{date(r.confirmedAt)}</td>
                        <td className={s.mono}>{date(r.lastSentAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>

          <Section title="Where signups come from" note="30 days">
            <div className={s.panel}>
              {sources.length === 0 ? (
                <p className={s.empty}>No signups in 30 days.</p>
              ) : (
                <table className={s.table}>
                  <tbody>
                    {sources.map((x) => (
                      <tr key={x.source}>
                        <td className={s.mono}>{x.source}</td>
                        <td className={s.num}>{x.n.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        </>
      )}
    </>
  )
}

function loadRecent() {
  return prisma.jobAlert.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      email: true,
      firstName: true,
      filters: true,
      frequency: true,
      status: true,
      source: true,
      createdAt: true,
      confirmedAt: true,
      lastSentAt: true,
    },
  })
}
