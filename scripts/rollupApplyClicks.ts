// scripts/rollupApplyClicks.ts
//
// Apply clicks per week by company, role, country and source into ApplyClickWeekly; see lib/history/clickRollup.ts. Only
// completed weeks. A dry run (counts only) unless --apply is passed. --weeks=N (default 4) reaches further back: the raw
// ApplyClick rows are still there, so older weeks can be filled in. Run daily by .github/workflows/data-history.yml.
//
//   npx tsx scripts/rollupApplyClicks.ts                 # last 4 completed weeks, writes nothing
//   npx tsx scripts/rollupApplyClicks.ts --apply --weeks=26
import { format as __format } from 'node:util'

import { rollupApplyClicks } from '../lib/history/clickRollup'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const apply = process.argv.includes('--apply')
const weeks = Number(process.argv.find((a) => a.startsWith('--weeks='))?.slice(8)) || 4

async function main() {
  const r = await rollupApplyClicks(prisma, { apply, weeks })
  __slog(`${apply ? 'WROTE' : 'DRY RUN: would write'} apply-click rollups for ${weeks} completed week(s)`)
  for (const w of r) __slog(`  week of ${w.weekStart}: ${w.clicks} clicks, ${w.rows} rollup rows`)
  if (!apply) __slog('Dry run: nothing was written. Pass --apply to record.')
}

main()
  .catch((e) => {
    __slog('FAILED:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
