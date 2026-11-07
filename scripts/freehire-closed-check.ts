// scripts/freehire-closed-check.ts
// Expires active freehire jobs that freehire reports as closed (lib/scrapers/freehireClosedCheck.ts).
//   npx tsx scripts/freehire-closed-check.ts --dry-run   report only (slugs for older jobs are still stored)
//   npx tsx scripts/freehire-closed-check.ts             expire the closed ones
// Exit code 1 on errors or when the safety limit aborts the run; "skipped" (too many failed lookups) is a warning.
import { prisma } from '../lib/prisma'
import { DEFAULT_MAX_LOOKUPS, checkClosedFreehireJobs } from '../lib/scrapers/freehireClosedCheck'

const dryRun = process.argv.includes('--dry-run')
// One API request per lookup; see the budget note in lib/scrapers/freehireClosedCheck.ts.
const maxLookups = Number(process.env.FREEHIRE_CLOSED_CHECK_MAX_LOOKUPS) || DEFAULT_MAX_LOOKUPS

checkClosedFreehireJobs({ dryRun, maxLookups, deadlineMs: 15 * 60 * 1000, onProgress: (m) => console.log(m) })
  .then((r) => {
    console.log(`freehire closed-job check ${dryRun ? '(DRY RUN — no job is expired)' : ''}`)
    console.log(`active: ${r.active}  slugs found for older jobs: ${r.resolved}  without a slug: ${r.unresolved}  left for the next run (lookup cap ${maxLookups}): ${r.deferred}`)
    console.log(`checked: ${r.checked}  open: ${r.open}  closed (confirmed): ${r.closed.length}  reported closed but still listed (kept): ${r.conflicts.length}  not found (404, ignored): ${r.gone}  lookup errors: ${r.errors}`)
    console.log(`kept alive (confirmed open, updatedAt refreshed): ${r.refreshed}  full descriptions replacing truncated ones: ${r.descriptionsUpgraded}`)
    console.log(`expired: ${r.expired}`)
    for (const j of r.conflicts.slice(0, 10)) console.log(`   kept (still listed): ${j.title}  [${j.externalId}]  https://freehire.me/api/v1/jobs/${j.sourceRef}`)
    for (const j of r.closed.slice(0, 15)) console.log(`   closed: ${j.title}  [${j.externalId}]  https://freehire.me/api/v1/jobs/${j.sourceRef}`)
    if (r.status === 'skipped') console.log(`::warning::closed-job check skipped: ${r.reason}`)
    if (r.status === 'aborted') {
      console.error(`::error::closed-job check aborted: ${r.reason}`)
      process.exitCode = 1
    }
    console.log(`status: ${r.status}${r.reason ? ` — ${r.reason}` : ''}`)
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
