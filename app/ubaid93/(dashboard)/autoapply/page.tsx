// Admin: where the auto-apply worker gets stuck on real employer forms, per board, from its dry runs and live runs
// (AutoApplyRun). Run dry runs on your own applications first (docs/auto-apply-launch-checklist.md) and read this before
// switching AUTO_APPLY_LIVE on. Shows no names, answers or résumé text: the table holds none.
import { prisma } from '../../../../lib/prisma'
import { autoApplyEnabled, autoApplyLive } from '../../../../lib/autoapply/config'
import { reasonText } from '../../../../lib/autoapply/reasons'
import { LEFT_EMPTY, summarizeRuns } from '../../../../lib/autoapply/runReport'
import { Figures, PageHead, Section, Tabs, s } from '../ui'
import { requireAdmin } from '../requireAdmin'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–')

export default async function AutoApplyAdminPage({ searchParams }: { searchParams?: Promise<{ days?: string }> }) {
  await requireAdmin()
  const days = Math.min(Math.max(Number((await searchParams)?.days) || 30, 1), 365)
  let error: string | null = null
  let report: ReturnType<typeof summarizeRuns> | null = null
  let byMode: Record<string, number> = {}

  try {
    const rows = await prisma.autoApplyRun.findMany({
      where: { createdAt: { gte: new Date(Date.now() - days * DAY) } },
      select: { board: true, mode: true, outcome: true, reason: true, unfilled: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })
    report = summarizeRuns(rows)
    byMode = rows.reduce<Record<string, number>>((m, r) => ((m[r.mode] = (m[r.mode] ?? 0) + 1), m), {})
  } catch {
    error = 'The AutoApplyRun table is not there yet. Apply the add_auto_apply_runs migration (after add_auto_apply), then reload.'
  }

  return (
    <>
      <PageHead
        title="Auto-apply"
        lede={`Every time the worker opened an employer form in the last ${days} days: did it fill every required question, and if not, why it stopped. Auto-apply is ${autoApplyEnabled() ? 'on' : 'off'}; submitting is ${autoApplyLive() ? 'live' : 'off (dry runs only)'}.`}
      />
      <div className={s.toolbar}>
        <Tabs
          current={String(days)}
          items={[7, 30, 365].map((d) => ({ label: d === 365 ? '1 year' : `${d} days`, value: String(d), href: `?days=${d}` }))}
        />
      </div>

      {error ? (
        <p className={s.notice}>{error}</p>
      ) : report && report.total === 0 ? (
        <p className={s.notice}>
          No runs yet. Approve an application of your own and run <code>npx tsx scripts/autoapply-worker.ts --once</code> (a
          dry run unless AUTO_APPLY_LIVE=true).
        </p>
      ) : report ? (
        <>
          <Figures
            items={[
              { label: 'Runs', value: report.total.toLocaleString() },
              { label: 'Dry runs', value: (byMode.dry_run ?? 0).toLocaleString() },
              { label: 'Live runs', value: (byMode.live ?? 0).toLocaleString() },
              { label: 'Got through the whole form', value: pct(report.clean, report.total) },
            ]}
          />

          <Section title="By employer board">
            <div className={`${s.panel} ${s.tableWrap}`}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Board</th>
                    <th className={s.num}>Runs</th>
                    <th className={s.num}>Whole form</th>
                    <th className={s.num}>Submitted</th>
                    <th>Stopped because</th>
                  </tr>
                </thead>
                <tbody>
                  {report.boards.map((b) => (
                    <tr key={b.board}>
                      <td className={s.mono}>{b.board}</td>
                      <td className={s.num}>{b.runs}</td>
                      <td className={s.num}>{pct(b.clean, b.runs)}</td>
                      <td className={s.num}>{b.submitted}</td>
                      <td>
                        {Object.entries(b.stops)
                          .sort((x, y) => y[1] - x[1])
                          .map(([why, n]) => (
                            <div key={why} title={why === LEFT_EMPTY ? undefined : reasonText(why).what}>
                              {why} × {n}
                            </div>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Questions most often left empty"
            note="Required questions still empty when the worker stopped, by the employer's label"
          >
            <div className={`${s.panel} ${s.tableWrap}`}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Question</th>
                    <th className={s.num}>Times</th>
                    <th className={s.num}>Boards</th>
                  </tr>
                </thead>
                <tbody>
                  {report.fields.slice(0, 30).map((f) => (
                    <tr key={`${f.key}:${f.label}`}>
                      <td>{f.label || <code>{f.key}</code>}</td>
                      <td className={s.num}>{f.count}</td>
                      <td className={s.num}>{f.boards}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      ) : null}
    </>
  )
}
