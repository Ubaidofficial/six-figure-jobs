// lib/autoapply/runReport.ts
// Summary of auto-apply attempts (AutoApplyRun rows) for the owner: per employer board, how often the worker got through
// the whole form and why it stopped otherwise, and which form questions it most often could not fill. Pure.

export type RunRow = {
  board: string
  mode: string
  outcome: string
  reason: string | null
  unfilled: unknown
}

export type BoardSummary = {
  board: string
  runs: number
  /** Dry runs that filled every required question, plus live runs the employer confirmed. */
  clean: number
  submitted: number
  /** Stop reason (or 'questions left empty' for a dry run that left some) -> count. */
  stops: Record<string, number>
}

export type FieldSummary = { key: string; label: string; boards: number; count: number }

export const LEFT_EMPTY = 'questions left empty'

const unfilledOf = (v: unknown): Array<{ key: string; label: string }> =>
  Array.isArray(v)
    ? v.filter((x): x is { key: string; label: string } => !!x && typeof x === 'object' && typeof (x as { key?: unknown }).key === 'string').map((x) => ({ key: x.key, label: typeof x.label === 'string' ? x.label : '' }))
    : []

export function summarizeRuns(rows: RunRow[]): { boards: BoardSummary[]; fields: FieldSummary[]; total: number; clean: number } {
  const boards = new Map<string, BoardSummary>()
  // Greenhouse question ids are per job, so the same question is counted by its label across boards.
  const fields = new Map<string, { key: string; label: string; boards: Set<string>; count: number }>()

  for (const r of rows) {
    const b = boards.get(r.board) ?? { board: r.board, runs: 0, clean: 0, submitted: 0, stops: {} }
    boards.set(r.board, b)
    b.runs++
    const empty = unfilledOf(r.unfilled)
    if (r.outcome === 'submitted') {
      b.submitted++
      b.clean++
    } else if (r.outcome === 'dry_run' && empty.length === 0) {
      b.clean++
    } else {
      const why = r.reason ?? (r.outcome === 'dry_run' ? LEFT_EMPTY : r.outcome)
      b.stops[why] = (b.stops[why] ?? 0) + 1
    }
    for (const f of empty) {
      const id = (f.label || f.key).toLowerCase()
      const s = fields.get(id) ?? { key: f.key, label: f.label, boards: new Set<string>(), count: 0 }
      fields.set(id, s)
      s.count++
      s.boards.add(r.board)
    }
  }

  const boardList = [...boards.values()].sort((a, b) => b.runs - a.runs || a.board.localeCompare(b.board))
  const fieldList = [...fields.values()]
    .map((f) => ({ key: f.key, label: f.label, boards: f.boards.size, count: f.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return { boards: boardList, fields: fieldList, total: rows.length, clean: boardList.reduce((n, b) => n + b.clean, 0) }
}
