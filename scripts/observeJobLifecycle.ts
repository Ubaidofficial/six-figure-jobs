// scripts/observeJobLifecycle.ts
//
// Records each job's lifecycle (first stored, last seen live, expiry seen, reopens, pay changes) in JobLifecycle; see
// lib/history/lifecycle.ts for what it can and cannot say. Only adds and updates rows of that one table; never touches Job.
// A dry run (counts only) unless --apply is passed. Run daily by .github/workflows/data-history.yml.
//
//   npx tsx scripts/observeJobLifecycle.ts            # counts, writes nothing
//   npx tsx scripts/observeJobLifecycle.ts --apply
import { format as __format } from 'node:util'

import { observeJobLifecycle } from '../lib/history/lifecycle'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const apply = process.argv.includes('--apply')

async function main() {
  const c = await observeJobLifecycle(prisma, { apply })
  __slog(`${apply ? 'APPLIED' : 'DRY RUN'} job lifecycle`)
  __slog(`  to start tracking (live, not yet tracked): ${c.toTrack}`)
  __slog(`  tracked and live now (refreshed):          ${c.stillLive}`)
  __slog(`  pay changed since last observed:           ${c.payChanged}`)
  __slog(`  reopened (seen expired, live again):       ${c.reopened}`)
  __slog(`  seen expired for the first time:           ${c.newlyExpired}`)
  __slog(`  tracked but Job row gone:                  ${c.goneFromJobTable}`)
  __slog(`  tracked in total before this run:          ${c.trackedTotal}`)
  if (!apply) __slog('Dry run: nothing was written. Pass --apply to record.')
}

main()
  .catch((e) => {
    __slog('FAILED:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
