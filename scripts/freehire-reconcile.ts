// scripts/freehire-reconcile.ts
// Expires active freehire jobs that freehire no longer lists as open (see lib/scrapers/freehireReconcile.ts).
//   npx tsx scripts/freehire-reconcile.ts --dry-run   report what would be expired, change nothing
//   npx tsx scripts/freehire-reconcile.ts             expire them
// Exit code 1 only on errors or when the safety limit aborts the run; "skipped" (incomplete data) is a warning.
import { prisma } from '../lib/prisma'
import { reconcileClosedFreehireJobs } from '../lib/scrapers/freehireReconcile'

const dryRun = process.argv.includes('--dry-run')

reconcileClosedFreehireJobs({ dryRun })
  .then((r) => {
    console.log(`freehire closed-job reconcile ${dryRun ? '(DRY RUN — nothing written)' : ''}`)
    console.log(`open in window: ${r.openInWindow}  judged (active, posted in last 7d): ${r.judged}  closed: ${r.closed.length}  expired: ${r.expired}`)
    for (const j of r.closed.slice(0, 15)) console.log(`   closed: ${j.title}  [${j.externalId}]`)
    if (r.status === 'skipped') console.log(`::warning::closed-job reconcile skipped: ${r.reason}`)
    if (r.status === 'aborted') {
      console.error(`::error::closed-job reconcile aborted: ${r.reason}`)
      process.exitCode = 1
    }
    console.log(`status: ${r.status}${r.reason ? ` — ${r.reason}` : ''}`)
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
