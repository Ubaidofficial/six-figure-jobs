// Admin: where the auto-apply worker gets stuck on real employer forms, per board, from its dry runs and live runs
// (AutoApplyRun). Run dry runs on your own applications first (docs/auto-apply-launch-checklist.md) and read this before
// switching AUTO_APPLY_LIVE on. Shows no names, answers or résumé text: the table holds none.
import { prisma } from '../../../../lib/prisma'
import { autoApplyEnabled, autoApplyLive } from '../../../../lib/autoapply/config'
import { reasonText } from '../../../../lib/autoapply/reasons'
import { LEFT_EMPTY, summarizeRuns } from '../../../../lib/autoapply/runReport'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000
const cell = { padding: '6px 8px', verticalAlign: 'top' as const, borderBottom: '1px solid #1f1f1f' }
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–')

export default async function AutoApplyAdminPage({ searchParams }: { searchParams?: Promise<{ days?: string }> }) {
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
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Auto-apply runs</h1>
      <p style={{ color: '#888', marginBottom: 8 }}>
        Every time the worker opened an employer form in the last {days} days: did it fill every required question, and if
        not, why it stopped. <a href="?days=7" style={{ color: '#84cc16' }}>7 days</a> ·{' '}
        <a href="?days=30" style={{ color: '#84cc16' }}>30 days</a> · <a href="?days=365" style={{ color: '#84cc16' }}>1 year</a>
      </p>
      <p style={{ color: '#888', marginBottom: 24 }}>
        Auto-apply is {autoApplyEnabled() ? 'on' : 'off'}; submitting is {autoApplyLive() ? 'LIVE' : 'off (dry runs only)'}.
      </p>

      {error ? (
        <p style={{ color: '#f87171' }}>{error}</p>
      ) : report && report.total === 0 ? (
        <p style={{ color: '#888' }}>
          No runs yet. Approve an application of your own and run <code>npx tsx scripts/autoapply-worker.ts --once</code> (a
          dry run unless AUTO_APPLY_LIVE=true).
        </p>
      ) : report ? (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            {(
              [
                ['Runs', report.total.toLocaleString()],
                ['Dry runs', (byMode.dry_run ?? 0).toLocaleString()],
                ['Live runs', (byMode.live ?? 0).toLocaleString()],
                ['Got through the whole form', pct(report.clean, report.total)],
              ] as Array<[string, string]>
            ).map(([label, value]) => (
              <div key={label} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: '14px 18px', minWidth: 150 }}>
                <div style={{ color: '#888', fontSize: 12 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '8px 0' }}>By employer board</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14, marginBottom: 28 }}>
            <thead>
              <tr style={{ color: '#888', textAlign: 'left' }}>
                <th style={cell}>Board</th>
                <th style={cell}>Runs</th>
                <th style={cell}>Whole form</th>
                <th style={cell}>Submitted</th>
                <th style={cell}>Stopped because</th>
              </tr>
            </thead>
            <tbody>
              {report.boards.map((b) => (
                <tr key={b.board}>
                  <td style={cell}>{b.board}</td>
                  <td style={cell}>{b.runs}</td>
                  <td style={cell}>{pct(b.clean, b.runs)}</td>
                  <td style={cell}>{b.submitted}</td>
                  <td style={cell}>
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

          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '8px 0' }}>Questions most often left empty</h2>
          <p style={{ color: '#888', marginBottom: 8 }}>
            Required questions still empty when the worker stopped, by the employer&apos;s label. Questions the user must
            answer themselves (work authorization, sponsorship…) belong here only if the user left them blank.
          </p>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
            <thead>
              <tr style={{ color: '#888', textAlign: 'left' }}>
                <th style={cell}>Question</th>
                <th style={cell}>Times</th>
                <th style={cell}>Boards</th>
              </tr>
            </thead>
            <tbody>
              {report.fields.slice(0, 30).map((f) => (
                <tr key={`${f.key}:${f.label}`}>
                  <td style={cell}>{f.label || <code>{f.key}</code>}</td>
                  <td style={cell}>{f.count}</td>
                  <td style={cell}>{f.boards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  )
}
