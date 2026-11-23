// scripts/freehire-changes.ts
// Expires active freehire jobs that freehire's change feed reports closed (lib/scrapers/freehireChanges.ts).
//   npx tsx scripts/freehire-changes.ts --dry-run   report only (nothing expired, cursor not moved)
//   npx tsx scripts/freehire-changes.ts             expire the closed ones and move the cursor
// Exit code 1 on errors or when the safety limit aborts the run; "skipped" is a warning.
import { prisma } from '../lib/prisma'
import { syncFreehireChanges } from '../lib/scrapers/freehireChanges'

const dryRun = process.argv.includes('--dry-run')

syncFreehireChanges({ dryRun, readDeadlineMs: 20 * 60 * 1000, onProgress: (m) => console.log(m) })
  .then((r) => {
    console.log(`freehire change feed ${dryRun ? '(DRY RUN: nothing expired, cursor not moved)' : ''}`)
    console.log(`pages: ${r.pages}  changes: ${r.changes}  caught up: ${r.caughtUp}  cursor saved: ${r.cursorSaved}`)
    console.log(`closed in the feed: ${r.closedInFeed}  ours: ${r.ours}  confirmed closed: ${r.closed.length}  still listed (kept): ${r.conflicts.length}  search errors: ${r.errors}`)
    console.log(`expired: ${r.expired}`)
    for (const j of r.conflicts.slice(0, 10)) console.log(`   kept (still listed): ${j.title}  [${j.externalId}]  https://freehire.me/api/v1/jobs/${j.sourceRef}`)
    for (const j of r.closed.slice(0, 15)) console.log(`   closed: ${j.title}  [${j.externalId}]  https://freehire.me/api/v1/jobs/${j.sourceRef}`)
    if (r.status === 'skipped') console.log(`::warning::freehire change feed skipped: ${r.reason}`)
    if (r.status === 'aborted') {
      console.error(`::error::freehire change feed aborted: ${r.reason}`)
      process.exitCode = 1
    }
    console.log(`status: ${r.status}${r.reason ? ` — ${r.reason}` : ''}`)
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
