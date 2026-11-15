// scripts/send-job-alerts.ts
// Mails every email job alert that is due (lib/alerts/service.ts runDigests). Run once a day by
// .github/workflows/job-alerts.yml; a digest goes out only when its alert has new matching jobs.
//
//   npx tsx scripts/send-job-alerts.ts              send
//   npx tsx scripts/send-job-alerts.ts --instant    only the Pro "instant" alerts (normally run by /api/cron/alerts-instant)
//   npx tsx scripts/send-job-alerts.ts --dry-run    write each email to ./alert-previews (or ALERTS_DRY_RUN_DIR) as
//                                                   HTML and text; nothing is sent and nothing is recorded
import 'dotenv/config'

import { alertsEnabled } from '../lib/alerts/config'
import { runDigests, sendMail } from '../lib/alerts/service'
import { prisma } from '../lib/prisma'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) process.env.ALERTS_DRY_RUN_DIR ||= 'alert-previews'
  if (!alertsEnabled() && !dryRun) {
    console.log('[alerts] off (ALERTS_ENABLED, RESEND_API_KEY or EMAIL_SERVER, EMAIL_FROM and ALERTS_POSTAL_ADDRESS must all be set); nothing sent')
    return
  }
  const frequencies = process.argv.includes('--instant') ? (['instant'] as const) : undefined
  const stats = await runDigests({ dryRun, frequencies: frequencies ? [...frequencies] : undefined, send: sendMail, log: (line) => console.error(line) })
  console.log(
    `[alerts]${dryRun ? ' DRY RUN (previews in ' + process.env.ALERTS_DRY_RUN_DIR + ')' : ''} active=${stats.active} ` +
      `due=${stats.due} sent=${stats.sent} nothing_new=${stats.nothingNew} failed=${stats.failed} left_for_next_run=${stats.leftForNextRun} demoted=${stats.demoted}`,
  )
  // A failed alert fails the run, so GitHub emails the owner.
  if (stats.failed > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error('[alerts] run failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
