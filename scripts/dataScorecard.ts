// scripts/dataScorecard.ts
//
// The data-quality scorecard: fill rates and counts, compared with the last stored scorecard; see lib/history/scorecard.ts.
// Read-only unless --apply is passed, which stores this week's scorecard in DataScorecard so the next one has something to
// compare with. When GITHUB_STEP_SUMMARY is set (a workflow run) the text is added to the run's summary.
//
//   npx tsx scripts/dataScorecard.ts            # prints the scorecard, stores nothing
//   npx tsx scripts/dataScorecard.ts --apply
import { appendFileSync } from 'node:fs'
import { format as __format } from 'node:util'

import { collectScorecard, renderScorecard, type ScorecardMetrics } from '../lib/history/scorecard'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const apply = process.argv.includes('--apply')

async function main() {
  const [last] = await prisma.dataScorecard.findMany({ orderBy: { capturedAt: 'desc' }, take: 1 })
  const metrics = await collectScorecard(prisma)
  const text = renderScorecard(metrics, (last?.metrics as unknown as ScorecardMetrics | undefined) ?? null, new Date().toISOString().slice(0, 10))
  __slog(text)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text)
  if (apply) {
    await prisma.dataScorecard.create({ data: { metrics: metrics as unknown as object } })
    __slog('Stored this scorecard.')
  } else {
    __slog('Not stored (dry run). Pass --apply to store it.')
  }
}

main()
  .catch((e) => {
    __slog('FAILED:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
