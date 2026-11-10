// Admin: who signed up for email job alerts, whether they confirmed, and which pages bring signups.
import { prisma } from '../../../../lib/prisma'
import { buildAlertLabel, sanitizeAlertFilters } from '../../../../lib/alerts/filters'
import { alertsEnabled } from '../../../../lib/alerts/config'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000
const cell = { padding: '6px 8px', verticalAlign: 'top' as const }
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

  const tiles: Array<[string, string]> = [
    ['Subscribers (active, unique emails)', subscribers.toLocaleString()],
    ['Active alerts', (byStatus.active ?? 0).toLocaleString()],
    ['Waiting for confirmation', (byStatus.pending ?? 0).toLocaleString()],
    ['Unsubscribed', (byStatus.unsubscribed ?? 0).toLocaleString()],
    ['Signups, 7 days', new7.toLocaleString()],
    ['Signups, 30 days', new30.toLocaleString()],
    ['Confirmed, of 30-day signups', new30 ? `${Math.round((confirmed30 / new30) * 100)}%` : '–'],
  ]

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Job alerts</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Email alert signups. An address counts as a subscriber only after it clicked the confirmation link.
        {alertsEnabled() ? '' : ' Alerts are switched off: no form is shown and nothing is sent (see docs/job-alerts-launch-checklist.md).'}
      </p>

      {error ? (
        <p style={{ color: '#f87171' }}>{error}</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            {tiles.map(([label, value]) => (
              <div key={label} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: '14px 18px', minWidth: 150 }}>
                <div style={{ color: '#888', fontSize: 12 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          <p style={{ marginBottom: 24 }}>
            <a href="/api/ubaid93/alerts/export" style={{ color: '#84cc16' }}>
              Download active subscribers (CSV)
            </a>
          </p>

          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Where signups come from (30 days)</h2>
          {sources.length === 0 ? (
            <p style={{ color: '#888', marginBottom: 24 }}>No signups yet.</p>
          ) : (
            <table style={{ borderCollapse: 'collapse', fontSize: 14, marginBottom: 24 }}>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source} style={{ borderTop: '1px solid #1f1f1f' }}>
                    <td style={{ ...cell, fontWeight: 700 }}>{s.n}</td>
                    <td style={cell}>{s.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Latest 100 signups</h2>
          {recent.length === 0 ? (
            <p style={{ color: '#888' }}>No signups yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#888' }}>
                    {['Email', 'Alert', 'How often', 'Status', 'From page', 'Signed up', 'Confirmed', 'Last email'].map((h) => (
                      <th key={h} style={cell}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid #1f1f1f' }}>
                      <td style={cell}>{r.email}</td>
                      <td style={cell}>{buildAlertLabel(sanitizeAlertFilters(r.filters) ?? {})}</td>
                      <td style={cell}>{r.frequency}</td>
                      <td style={{ ...cell, color: r.status === 'active' ? '#84cc16' : r.status === 'pending' ? '#facc15' : '#888' }}>{r.status}</td>
                      <td style={{ ...cell, color: '#aaa' }}>{r.source ?? '–'}</td>
                      <td style={cell}>{date(r.createdAt)}</td>
                      <td style={cell}>{date(r.confirmedAt)}</td>
                      <td style={cell}>{date(r.lastSentAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function loadRecent() {
  return prisma.jobAlert.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      email: true,
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
