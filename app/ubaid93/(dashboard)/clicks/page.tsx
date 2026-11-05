import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

export default async function ApplyClicksPage() {
  const since7 = new Date(Date.now() - 7 * DAY)
  const since30 = new Date(Date.now() - 30 * DAY)

  let error: string | null = null
  let total7 = 0
  let total30 = 0
  let rows: Array<{ jobId: string; clicks: number; title: string; company: string | null; expired: boolean }> = []
  let byDevice: Array<{ device: string; clicks: number }> = []

  try {
    const [t7, t30, grouped, devices] = await Promise.all([
      prisma.applyClick.count({ where: { createdAt: { gte: since7 } } }),
      prisma.applyClick.count({ where: { createdAt: { gte: since30 } } }),
      prisma.applyClick.groupBy({
        by: ['jobId'],
        where: { createdAt: { gte: since30 } },
        _count: { _all: true },
        orderBy: { _count: { jobId: 'desc' } },
        take: 50,
      }),
      prisma.applyClick.groupBy({ by: ['device'], where: { createdAt: { gte: since30 } }, _count: { _all: true } }),
    ])
    total7 = t7
    total30 = t30
    byDevice = devices.map((d) => ({ device: d.device, clicks: d._count._all }))
    const jobs = await prisma.job.findMany({
      where: { id: { in: grouped.map((g) => g.jobId) } },
      select: { id: true, title: true, company: true, isExpired: true },
    })
    const byId = new Map(jobs.map((j) => [j.id, j]))
    rows = grouped.map((g) => {
      const j = byId.get(g.jobId)
      return { jobId: g.jobId, clicks: g._count._all, title: j?.title ?? '(job removed)', company: j?.company ?? null, expired: j?.isExpired ?? true }
    })
  } catch (e) {
    error = 'Apply-click table not available yet. Apply the add_apply_click migration, then reload.'
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Apply clicks</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Clicks on the Apply button (no visitor data is stored; Do Not Track visitors are not counted; repeat clicks within 10 minutes count once).
      </p>

      {error ? (
        <p style={{ color: '#f87171' }}>{error}</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              ['Last 7 days', total7],
              ['Last 30 days', total30],
              ...byDevice.map((d) => [`${d.device} (30d)`, d.clicks] as [string, number]),
            ].map(([label, value]) => (
              <div key={String(label)} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: '14px 18px', minWidth: 130 }}>
                <div style={{ color: '#888', fontSize: 12 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{Number(value).toLocaleString()}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Most-clicked jobs (30 days)</h2>
          {rows.length === 0 ? (
            <p style={{ color: '#888' }}>No clicks recorded yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#888' }}>
                  <th style={{ padding: '6px 8px' }}>Clicks</th>
                  <th style={{ padding: '6px 8px' }}>Job</th>
                  <th style={{ padding: '6px 8px' }}>Company</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.jobId} style={{ borderTop: '1px solid #1f1f1f' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700 }}>{r.clicks}</td>
                    <td style={{ padding: '6px 8px' }}>
                      {r.title}
                      {r.expired ? <span style={{ color: '#888' }}> (expired)</span> : null}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#aaa' }}>{r.company ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
