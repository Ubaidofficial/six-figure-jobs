// scripts/sync-direct-employers.ts
//
// Reads every employer in lib/constants/directEmployers.ts from its own applicant tracking system and ingests the
// jobs through the normal ATS path (upsertJobsForCompanyFromAts: salary gate, role and country, dedupe, indexing
// queue). Jobs still listed get their updatedAt refreshed, so run-expiry closes only the ones that came down.
//
//   npx tsx scripts/sync-direct-employers.ts                 all employers
//   npx tsx scripts/sync-direct-employers.ts --only=openai,anthropic
//   npx tsx scripts/sync-direct-employers.ts --dry-run       scrape and count, write nothing
import { prisma } from '../lib/prisma'
import { DIRECT_EMPLOYERS, type DirectEmployer } from '../lib/constants/directEmployers'
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'
import { upsertJobsForCompanyFromAts } from '../lib/jobs/ingestFromAts'
import { companyUpdatesFor } from '../lib/companies/directEmployerCompany'
import { orderBySyncAge } from '../lib/companies/directEmployerSchedule'

const DRY = process.argv.includes('--dry-run')
const only = (process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? '').split(',').filter(Boolean)
const CONCURRENCY = 3
const WORKDAY_PAUSE_MS = 15_000
// The workflow step is killed at 90 minutes (it was, on 2026-11-11, part-way through the Workday boards). No employer is
// started after this budget; the one in progress finishes. Employers not reached go first on the next run.
const BUDGET_MS = Number(process.env.DIRECT_EMPLOYERS_BUDGET_MIN || 70) * 60_000

/** The employer's company row: its existing page by slug (or exact name), else a new one. */
async function companyFor(e: DirectEmployer) {
  const existing =
    (await prisma.company.findUnique({ where: { slug: e.slug } })) ??
    (await prisma.company.findFirst({ where: { name: { equals: e.name, mode: 'insensitive' } } }))
  if (existing) {
    const data = companyUpdatesFor(e, existing)
    return Object.keys(data).length ? prisma.company.update({ where: { id: existing.id }, data }) : existing
  }
  return prisma.company.create({
    data: { name: e.name, slug: e.slug, atsProvider: e.provider, atsUrl: e.boardUrl, website: e.website ? `https://${e.website}` : null },
  })
}

/** Each employer's last successful sync, found the way companyFor finds its company (slug, else exact name). */
async function lastSyncedBySlug(employers: DirectEmployer[]): Promise<Map<string, Date | null>> {
  const rows = await prisma.company.findMany({
    where: {
      OR: [{ slug: { in: employers.map((e) => e.slug) } }, { name: { in: employers.map((e) => e.name), mode: 'insensitive' } }],
    },
    select: { slug: true, name: true, lastScrapedAt: true },
  })
  const bySlug = new Map(rows.map((r) => [r.slug, r.lastScrapedAt]))
  const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r.lastScrapedAt]))
  return new Map(employers.map((e) => [e.slug, bySlug.get(e.slug) ?? byName.get(e.name.toLowerCase()) ?? null]))
}

async function syncOne(e: DirectEmployer) {
  const scraped = await scrapeCompanyAtsJobs(e.provider, e.boardUrl)
  const jobs = (scraped as { jobs?: unknown[] }).jobs ?? []
  if (!scraped.success) return { slug: e.slug, scraped: 0, created: 0, updated: 0, skipped: 0, error: scraped.error ?? 'scrape failed' }
  if (DRY) return { slug: e.slug, scraped: jobs.length, created: 0, updated: 0, skipped: 0 }
  const company = await companyFor(e)
  const r = await upsertJobsForCompanyFromAts(company, jobs)
  // When this employer was last read from its own system: the next run reads the least recently synced first.
  await prisma.company.update({ where: { id: company.id }, data: { lastScrapedAt: new Date() } })
  return { slug: e.slug, scraped: jobs.length, created: r.created, updated: r.updated, skipped: r.skipped }
}

async function main() {
  const chosen = only.length ? DIRECT_EMPLOYERS.filter((e) => only.includes(e.slug)) : [...DIRECT_EMPLOYERS]
  const list = orderBySyncAge(chosen, await lastSyncedBySlug(chosen))
  const deadline = Date.now() + BUDGET_MS
  console.log(`[direct-employers] ${list.length} employers, least recently synced first, budget ${BUDGET_MS / 60_000} min${DRY ? ' (dry run)' : ''}`)
  const results: Awaited<ReturnType<typeof syncOne>>[] = []
  const notReached: string[] = []
  const runLane = async (queue: DirectEmployer[], pauseMs: number) => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      if (Date.now() > deadline) {
        notReached.push(e.slug, ...queue.splice(0).map((q) => q.slug))
        return
      }
      const started = Date.now()
      const r = await syncOne(e).catch((err) => ({ slug: e!.slug, scraped: 0, created: 0, updated: 0, skipped: 0, error: String(err).slice(0, 160) }))
      results.push(r)
      const secs = Math.round((Date.now() - started) / 1000)
      console.log(`  ${r.slug}: scraped ${r.scraped}, created ${r.created}, updated ${r.updated}, skipped ${r.skipped}${'error' in r && r.error ? `, ERROR ${r.error}` : ''} (${secs}s)`)
      if (pauseMs && queue.length) await new Promise((resolve) => setTimeout(resolve, pauseMs))
    }
  }
  // Workday boards in a lane of their own, one at a time with a pause between them: Workday rate-limits per caller
  // across its tenants, and with three of them at once every one of the 19 answered 429 on 2026-11-10. The other
  // providers keep CONCURRENCY workers alongside, so the step takes about as long as the Workday lane.
  const workdayQueue = list.filter((e) => e.provider === 'workday')
  const otherQueue = list.filter((e) => e.provider !== 'workday')
  await Promise.all([
    ...Array.from({ length: CONCURRENCY }, () => runLane(otherQueue, 0)),
    runLane(workdayQueue, WORKDAY_PAUSE_MS),
  ])
  const sum = (k: 'scraped' | 'created' | 'updated' | 'skipped') => results.reduce((n, r) => n + r[k], 0)
  const failed = results.filter((r) => 'error' in r && r.error).map((r) => r.slug)
  console.log(`[direct-employers] scraped ${sum('scraped')}, created ${sum('created')}, updated ${sum('updated')}, skipped ${sum('skipped')} (no qualifying salary or excluded); failed: ${failed.length ? failed.join(', ') : 'none'}`)
  if (notReached.length) console.log(`[direct-employers] time budget reached; ${notReached.length} not reached today (first next run): ${notReached.join(', ')}`)
  await prisma.$disconnect()
  // A few boards failing (renamed, briefly down) must not fail the run; every one failing means something is wrong.
  if (list.length > 0 && failed.length === list.length) process.exit(1)
}

main().catch(async (e) => {
  console.error('[direct-employers] failed:', e)
  await prisma.$disconnect()
  process.exit(1)
})
