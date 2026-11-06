// The hosted auto-apply worker: takes applications the user approved and drives the employer's form in a real browser.
//
//   AUTO_APPLY_ENABLED=true ACCOUNTS_ENABLED=true ... npx tsx scripts/autoapply-worker.ts --once
//
// Default is a DRY RUN: it fills each approved form and reports what it filled and what it could not, but sends nothing,
// claims nothing and charges nothing. It only really submits when AUTO_APPLY_LIVE=true. Run it where puppeteer and a
// Chromium are installed (puppeteer is a dev dependency); set AUTOAPPLY_CHROME_PATH to use a Chromium you already have.
// Log lines carry ids and outcomes only, never names, answers or résumé text.

import puppeteer from 'puppeteer'

import { createBrowserDriver } from '@/lib/autoapply/browserDriver'
import { autoApplyEnabled, autoApplyLive } from '@/lib/autoapply/config'
import { recoverStuckApplications, runApplication } from '@/lib/autoapply/service'
import { prisma } from '@/lib/prisma'

const once = process.argv.includes('--once')
const POLL_MS = 30_000

async function main() {
  if (!autoApplyEnabled()) {
    console.log('[autoapply] switched off (needs ACCOUNTS_ENABLED=true, AUTH_SECRET and AUTO_APPLY_ENABLED=true). Nothing to do.')
    return
  }
  const live = autoApplyLive()
  console.log(`[autoapply] worker started in ${live ? 'LIVE mode: approved applications will be submitted' : 'DRY-RUN mode: forms are filled but nothing is sent'}`)

  const driver = createBrowserDriver({
    launch: () => puppeteer.launch({ executablePath: process.env.AUTOAPPLY_CHROME_PATH || undefined, headless: true, args: ['--no-sandbox'] }),
  })
  const seen = new Set<string>() // a dry run leaves the application approved, so remember what this process already tried

  for (;;) {
    const recovered = live ? await recoverStuckApplications() : 0
    if (recovered) console.log(`[autoapply] ${recovered} stuck application(s) handed back to their owners (unconfirmed)`)

    const queue = await prisma.autoApplication.findMany({ where: { status: 'approved' }, orderBy: { approvedAt: 'asc' }, take: 20, select: { id: true } })
    for (const { id } of queue) {
      if (!live && seen.has(id)) continue
      seen.add(id)
      const res = await runApplication(id, driver, { live })
      const detail =
        res.done === 'dry_run' ? `${res.outcome.kind}${res.outcome.kind === 'dry_run' ? ` filled=${res.outcome.filled.length} unfilled=${res.outcome.unfilled.length}` : ''}`
        : res.done === 'finished' ? `${res.status}${res.reason ? ` (${res.reason})` : ''}` : `skipped (${res.why})`
      console.log(`[autoapply] ${id}: ${detail}`)
    }
    if (once) return
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

main()
  .catch((e) => {
    console.error('[autoapply] worker error:', e instanceof Error ? e.name : 'unknown')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
