// Admin: the daily quality snapshot and its findings (lib/quality, docs/QUALITY_AGENTS_PLAN.md). What the quality agents
// work on, which pull requests they opened, and whether the numbers move.
import type { CheckResult } from '../../../../lib/quality/checks'
import type { SnapshotMetrics } from '../../../../lib/quality/snapshot'
import { prisma } from '../../../../lib/prisma'
import { Figures, PageHead, Section, Status, ago, s, type Tone } from '../ui'
import { requireAdmin } from '../requireAdmin'
import FindingActions from './FindingActions'

export const dynamic = 'force-dynamic'

const SEVERITY_TONE: Record<string, Tone> = { high: 'bad', medium: 'warn', low: 'muted' }
const STATUS_LABEL: Record<string, string> = { open: 'Open', pr: 'PR open', fixed: 'Fixed', wontfix: "Won't fix" }
const STATUS_TONE: Record<string, Tone> = { open: 'warn', pr: 'ok', fixed: 'ok', wontfix: 'muted' }
const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export default async function QualityPage() {
  await requireAdmin()
  let error: string | null = null
  let snaps: Array<{ capturedAt: Date; metrics: SnapshotMetrics; checks: CheckResult[] }> = []
  let findings: Awaited<ReturnType<typeof prisma.qualityFinding.findMany>> = []
  try {
    const [rows, f] = await Promise.all([
      prisma.qualitySnapshot.findMany({ orderBy: { capturedAt: 'desc' }, take: 30 }),
      prisma.qualityFinding.findMany({ orderBy: { lastSeenAt: 'desc' } }),
    ])
    snaps = rows.reverse().map((r) => ({ capturedAt: r.capturedAt, metrics: r.metrics as unknown as SnapshotMetrics, checks: r.checks as unknown as CheckResult[] }))
    findings = f
  } catch {
    error = 'The quality tables are not in the database yet. Apply the add_quality_snapshot_findings migration ("database migrate" workflow), then run "quality snapshot".'
  }

  const latest = snaps.at(-1)
  const series = (pick: (m: SnapshotMetrics) => number) => snaps.map((x) => pick(x.metrics))
  const trendOf = (key: string) => snaps.map((x) => x.checks.find((c) => c.key === key)?.count ?? 0)
  const active = findings
    .filter((f) => f.status === 'open' || f.status === 'pr')
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3) || b.count - a.count)
  const closed = findings.filter((f) => f.status === 'fixed' || f.status === 'wontfix')

  return (
    <>
      <PageHead
        title="Quality"
        lede="The daily quality snapshot: each check counts the listed jobs that break one rule. Open findings are what the quality agents work on; each of their pull requests names its finding, and you merge or close it. A finding closes itself when its count reaches zero."
      />
      {error ? <p className={s.notice}>{error}</p> : null}
      {!error && !latest ? <p className={s.notice}>No snapshot yet. It runs every day at 05:27 UTC (the "quality snapshot" workflow), or run it by hand with "apply" ticked.</p> : null}
      {latest ? (
        <>
          <Figures
            items={[
              { label: 'Listed jobs', value: latest.metrics.listedJobs.toLocaleString(), sub: `${latest.metrics.pagesUp.toLocaleString()} job pages up`, spark: series((m) => m.listedJobs) },
              { label: 'Role known', value: `${latest.metrics.fill.role}%`, sub: 'of listed jobs', spark: series((m) => m.fill.role) },
              { label: 'Country known', value: `${latest.metrics.fill.country}%`, sub: 'of listed jobs', spark: series((m) => m.fill.country) },
              { label: 'Work mode known', value: `${latest.metrics.fill.workMode}%`, sub: 'of listed jobs', spark: series((m) => m.fill.workMode) },
              { label: 'Open findings', value: active.length.toLocaleString(), sub: `${active.filter((f) => f.status === 'pr').length} with a pull request` },
            ]}
          />
          <p className={s.cellSub} style={{ margin: '8px 2px 0' }}>
            Last snapshot {ago(latest.capturedAt)}; trends over the last {snaps.length} snapshot{snaps.length === 1 ? '' : 's'}.
          </p>
        </>
      ) : null}

      {findings.length ? (
        <Section title="Open findings" note="most severe first">
          <div className={s.panel}>
            {active.length === 0 ? (
              <p className={s.empty}>Nothing open.</p>
            ) : (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Finding</th>
                      <th>Jobs</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((f) => {
                      const trend = trendOf(f.key)
                      const change = trend.length > 1 ? trend[trend.length - 1] - trend[trend.length - 2] : 0
                      const sample = (f.sample as Array<{ id: string; text: string }>) ?? []
                      return (
                        <tr key={f.id}>
                          <td style={{ maxWidth: 560 }}>
                            <div className={s.cellTitle}>{f.title}</div>
                            <div className={s.cellSub}>
                              <Status tone={SEVERITY_TONE[f.severity] ?? 'muted'}>{f.severity}</Status> {f.area} · <code>{f.key}</code> · since {f.firstSeenAt.toISOString().slice(0, 10)}
                            </div>
                            {f.note ? <div className={s.cellSub}>{f.note}</div> : null}
                            {sample.length ? (
                              <details className={s.cellSub}>
                                <summary>Examples</summary>
                                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                                  {sample.map((x) => (
                                    <li key={x.id} style={{ wordBreak: 'break-word' }}>
                                      {x.text}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                          </td>
                          <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
                            {f.count.toLocaleString()}
                            {change ? <div className={s.cellSub}>{change > 0 ? `+${change}` : change} since the last snapshot</div> : null}
                          </td>
                          <td>
                            <Status tone={STATUS_TONE[f.status] ?? 'muted'}>{STATUS_LABEL[f.status] ?? f.status}</Status>
                            {f.prUrl ? (
                              <div className={s.cellSub}>
                                <a className={s.link} href={f.prUrl} target="_blank" rel="noopener noreferrer">
                                  Pull request ↗
                                </a>
                              </div>
                            ) : null}
                          </td>
                          <td>
                            <FindingActions findingKey={f.key} status={f.status} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Section>
      ) : null}

      {closed.length ? (
        <Section title="Fixed and won't fix">
          <div className={s.panel}>
            <ul className={s.checks}>
              {closed.map((f) => (
                <li key={f.id} className={s.check}>
                  <span className={s.checkLabel}>{f.title}</span>
                  <div>
                    <Status tone={STATUS_TONE[f.status] ?? 'muted'}>
                      {STATUS_LABEL[f.status]}
                      {f.status === 'fixed' && f.fixedAt ? ` ${f.fixedAt.toISOString().slice(0, 10)}` : ''}
                    </Status>
                    {f.note ? <div className={s.checkNote}>{f.note}</div> : null}
                    <FindingActions findingKey={f.key} status={f.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}
    </>
  )
}
