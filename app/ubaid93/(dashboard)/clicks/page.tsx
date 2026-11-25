import { isJobDetailAvailable } from '../../../../lib/jobs/detailAvailability'
import { buildJobSlugHref } from '../../../../lib/jobs/jobSlug'
import { prisma } from '../../../../lib/prisma'
import { loadDaily } from '../overview'
import { TrendChart } from '../charts'
import { Figures, PageHead, Section, lastDays, s } from '../ui'
import { BarList, SplitBar, movingAverage } from '../visuals'
import { requireAdmin } from '../requireAdmin'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

type Row = { jobId: string; clicks: number; title: string; company: string | null; expired: boolean; href: string | null }

export default async function ApplyClicksPage() {
  await requireAdmin()
  const now = Date.now()
  const since7 = new Date(now - 7 * DAY)
  const since30 = new Date(now - 30 * DAY)
  const days = lastDays(30)

  let error: string | null = null
  let total7 = 0
  let total30 = 0
  let rows: Row[] = []
  // Clicks on jobs no longer stored: one line under the list instead of a row each (they cannot be opened or acted on).
  let removed = { jobs: 0, clicks: 0 }
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
      select: { id: true, shortId: true, title: true, company: true, isExpired: true, postedAt: true, createdAt: true },
    })
    const byId = new Map(jobs.map((j) => [j.id, j]))
    const all = grouped.map((g) => {
      const j = byId.get(g.jobId)
      return {
        jobId: g.jobId,
        clicks: g._count._all,
        title: j?.title ?? '(job removed)',
        company: j?.company ?? null,
        // Expired, or posted too long ago: either way the job page answers "gone".
        expired: j ? !isJobDetailAvailable(j) : true,
        href: j ? buildJobSlugHref(j) : null,
      }
    })
    rows = all.filter((r) => r.href).slice(0, 10)
    const gone = all.filter((r) => !r.href)
    removed = { jobs: gone.length, clicks: gone.reduce((n, r) => n + r.clicks, 0) }
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
              { label: 'Last 7 days', value: total7.toLocaleString(), spark: daily.slice(-14) },
              { label: 'Last 30 days', value: total30.toLocaleString(), sub: `${(total30 / 30).toFixed(1)} a day on average` },
            ]}
          />

          <Section title="Per day" note="complete UTC days, with the 7-day average">
            <div className={`${s.panel} ${s.panelPad}`}>
              <TrendChart
                label="Apply clicks per day and their 7-day average"
                days={days.slice(0, -1)}
                height={200}
                series={[
                  { label: 'clicks', values: daily.slice(0, -1), kind: 'column', color: '#b7d3f6' },
                  { label: '7-day average', values: movingAverage(daily.slice(0, -1)), color: '#2a78d6' },
                ]}
              />
            </div>
          </Section>

          <div className={s.grid2}>
            <Section title="Device" note="30 days">
              <div className={`${s.panel} ${s.panelPad}`}>
                <SplitBar
                  parts={['desktop', 'mobile'].map((device) => ({
                    label: device === 'desktop' ? 'Desktop' : 'Mobile',
                    value: byDevice.find((d) => d.device === device)?.clicks ?? 0,
                    color: device === 'desktop' ? '#2a78d6' : '#eb6834',
                  }))}
                />
              </div>
            </Section>
            <Section title="Button" note="30 days">
              <div className={`${s.panel} ${s.panelPad}`}>
                <SplitBar
                  parts={['apply-card', 'mobile-bar'].map((surface) => ({
                    label: SURFACE[surface],
                    value: byPlace.find((p) => p.surface === surface)?.clicks ?? 0,
                    color: surface === 'apply-card' ? '#2a78d6' : '#eb6834',
                  }))}
                />
              </div>
            </Section>
          </div>

          <div className={`${s.grid2} ${s.grid21}`}>
            <Section title="Most-clicked jobs" note="30 days, top 10">
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
                            <div className={s.cellSub}>{[r.company, r.href && r.expired ? 'page gone' : null].filter(Boolean).join(' · ')}</div>
                          </td>
                          <td className={s.num}>{r.clicks.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {removed.jobs > 0 ? (
                  <p className={s.cellSub} style={{ padding: '10px 14px', margin: 0, borderTop: '1px solid var(--color-border)' }}>
                    Also {removed.clicks.toLocaleString()} click{removed.clicks === 1 ? '' : 's'} on {removed.jobs.toLocaleString()} job
                    {removed.jobs === 1 ? '' : 's'} no longer in the database.
                  </p>
                ) : null}
              </div>
            </Section>
            <Section title="Most-clicked companies" note="30 days, top 300 jobs">
              <div className={s.panel}>
                <BarList items={companies.map((c) => ({ label: c.company, value: c.clicks }))} total={total30} />
              </div>
            </Section>
          </div>
        </>
      )}
    </>
  )
}
