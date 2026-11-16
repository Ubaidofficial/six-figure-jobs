// scripts/marketSnapshot.ts
//
// Today's pay by cell (role, country, role x country, level, arrangement, overall) into MarketSnapshot, under the published pay
// method; see lib/history/marketSnapshot.ts. A dry run (counts only) unless --apply is passed. Running it twice on one date
// replaces that date's rows. Run weekly by .github/workflows/data-history.yml.
//
//   npx tsx scripts/marketSnapshot.ts            # counts, writes nothing
//   npx tsx scripts/marketSnapshot.ts --apply
import { format as __format } from 'node:util'

import { snapshotMarket } from '../lib/history/marketSnapshot'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const apply = process.argv.includes('--apply')

async function main() {
  const r = await snapshotMarket(prisma, { apply })
  __slog(`${apply ? 'WROTE' : 'DRY RUN: would write'} market snapshot cells`)
  for (const [dim, count] of Object.entries(r.cells)) __slog(`  ${dim.padEnd(13)} ${count}`)
  __slog('Overall cells (jobs, median advertised annual figure):')
  for (const o of r.overall) __slog(`  ${o.currency}  ${o.jobs} jobs, median ${o.median}`)
  if (!apply) __slog('Dry run: nothing was written. Pass --apply to record.')
}

main()
  .catch((e) => {
    __slog('FAILED:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
