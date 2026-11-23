import { buildJobSlugHref } from '../../../../lib/jobs/jobSlug'
import { prisma } from '../../../../lib/prisma'
import { loadDaily } from '../overview'
import { DailyBars, Figures, PageHead, Section, lastDays, s } from '../ui'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

type Row = { jobId: string; clicks: number; title: string; company: string | null; expired: boolean; href: string | null }

export default async function ApplyClicksPage() {
  const now = Date.now()
  const since7 = new Date(now - 7 * DAY)
  const since30 = new Date(now - 30 * DAY)
  const days = lastDays(30)

  let error: string | null = null
  let total7 = 0
  let total30 = 0
  let rows: Row[] = []
  let companies: Array<{ company: string; clicks: number }> = []
  let byDevice: Array<{ device: string; clicks: number }> = []
  let byPlace: Array<{ surface: string; clicks: number }> = []
  let daily: number[] = []

  try {
    const [t7, t30, grouped, devices, surfaces, d] = await Promise.all([
      prisma.applyClick.count({ where: { createdAt: { gte: since7 } } }),
      prisma.applyClick.count({ where: { createdAt: { gte: since30 } } }),
      prisma.applyClick.groupBy({
        by: ['jobId'],
        where: { createdAt: { gte: since30 } },
        _count: { _all: true },
        orderBy: { _count: { jobId: 'desc' } },
        take: 300,
      }),
      prisma.applyClick.groupBy({ by: ['device'], where: { createdAt: { gte: since30 } }, _count: { _all: true } }),
      prisma.applyClick.groupBy({ by: ['surface'], where: { createdAt: { gte: since30 } }, _count: { _all: true } }),
      loadDaily(days),
    ])
    total7 = t7
    total30 = t30
    daily = d.clicks
    byDevice = devices.map((x) => ({ device: x.device, clicks: x._count._all }))
    byPlace = surfaces.map((x) => ({ surface: x.surface, clicks: x._count._all }))
    const jobs = await prisma.job.findMany({
      where: { id: { in: grouped.map((g) => g.jobId) } },
      select: { id: true, shortId: true, title: true, company: true, isExpired: true },
    })
    const byId = new Map(jobs.map((j) => [j.id, j]))
    const all = grouped.map((g) => {
      const j = byId.get(g.jobId)
      return {
        jobId: g.jobId,
        clicks: g._count._all,
        title: j?.title ?? '(job removed)',
        company: j?.company ?? null,
        expired: j?.isExpired ?? true,
        href: j ? buildJobSlugHref(j) : null,
      }
    })
    rows = all.slice(0, 50)
    const perCompany = new Map<string, number>()
    for (const r of all) if (r.company) perCompany.set(r.company, (perCompany.get(r.company) ?? 0) + r.clicks)
    companies = [...perCompany.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([company, clicks]) => ({ company, clicks }))
  } catch {
    error = 'Apply-click table not available yet. Apply the add_apply_click migration, then reload.'
  }

  const SURFACE: Record<string, string> = { 'apply-card': 'Apply card', 'mobile-bar': 'Mobile bar' }

  return (
    <>
      <PageHead
        title="Apply clicks"
        lede="Clicks on a job's Apply button: the clearest sign a visitor found a job worth applying to. Nothing about the visitor is stored; Do Not Track visitors are not counted; repeat clicks within 10 minutes count once."
      />
      {error ? (
        <p className={s.notice}>{error}</p>
      ) : (
        <>
          <Figures
            items={[
              { label: 'Last 7 days', value: total7.toLocaleString() },
              { label: 'Last 30 days', value: total30.toLocaleString() },
              ...byDevice.map((d) => ({
                label: `${d.device[0].toUpperCase()}${d.device.slice(1)}, 30 days`,
                value: d.clicks.toLocaleString(),
                sub: total30 ? `${Math.round((d.clicks / total30) * 100)}%` : undefined,
              })),
              ...byPlace.map((p) => ({ label: `${SURFACE[p.surface] ?? p.surface}, 30 days`, value: p.clicks.toLocaleString() })),
            ]}
          />

          <Section title="Per day" note="30 UTC days">
            <div className={`${s.panel} ${s.panelPad}`}>
              <DailyBars days={days} series={[daily]} labels={['clicks']} />
            </div>
          </Section>

          <div className={s.grid2} style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
            <Section title="Most-clicked jobs" note="30 days">
              <div className={`${s.panel} ${s.tableWrap}`}>
                {rows.length === 0 ? (
                  <p className={s.empty}>No clicks recorded yet.</p>
                ) : (
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th className={s.num}>Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.jobId}>
                          <td>
                            {r.href ? (
                              <a className={`${s.cellTitle} ${s.link}`} href={r.href} target="_blank" rel="noopener">
                                {r.title}
                              </a>
                            ) : (
                              <span className={s.cellTitle}>{r.title}</span>
                            )}
                            <div className={s.cellSub}>
                              {r.company ?? ''}
                              {r.expired ? ' · expired' : ''}
                            </div>
                          </td>
                          <td className={s.num}>{r.clicks.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Section>
            <Section title="Most-clicked companies" note="30 days, top 300 jobs">
              <div className={s.panel}>
                {companies.length === 0 ? (
                  <p className={s.empty}>None yet.</p>
                ) : (
                  <table className={s.table}>
                    <tbody>
                      {companies.map((c) => (
                        <tr key={c.company}>
                          <td>{c.company}</td>
                          <td className={s.num}>{c.clicks.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Section>
          </div>
        </>
      )}
    </>
  )
}
