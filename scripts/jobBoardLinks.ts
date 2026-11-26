// scripts/jobBoardLinks.ts
//
// DRY RUN (read-only). What "treat job boards as aggregators" (owner's choice, 2026-11-26) would do to the listed jobs:
// freehire jobs whose apply link goes to a job board (isJobBoardApplyUrl, lib/jobs/applyUrl.ts) would no longer be
// listed; other sources' jobs would keep their listing but lose a job-board apply link. Counts by site, country, role,
// work mode and company, and the freehire sites the list does not catch, to review the list before anything changes.
// Every statement is a SELECT in a READ ONLY transaction.
//
//   npx tsx scripts/jobBoardLinks.ts
import { appendFileSync } from 'node:fs'

import { applySiteOf, isJobBoardApplyUrl } from '../lib/jobs/applyUrl'
import { buildWhere } from '../lib/jobs/queryJobs'

const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)
const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
const pct = (n: number, d: number) => `${Math.round((n / Math.max(d, 1)) * 1000) / 10}%`

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const out: string[] = ['## Job-board apply links: what option 2 would change (dry run, read-only)', '']
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        const rows = await tx.job.findMany({
          where: buildWhere({}),
          select: { source: true, applyUrl: true, countryCode: true, roleSlug: true, companyId: true, remoteMode: true },
        })
        const freehire = rows.filter((r) => r.source === 'board:freehire')
        const dropped = freehire.filter((r) => isJobBoardApplyUrl(r.applyUrl))
        const otherBoardLinks = rows.filter((r) => r.source !== 'board:freehire' && isJobBoardApplyUrl(r.applyUrl))
        const noLink = freehire.filter((r) => !r.applyUrl)

        out.push(
          `Listed jobs: ${rows.length}; freehire: ${freehire.length}.`,
          `**Would no longer be listed (freehire, job-board link): ${dropped.length}** (${pct(dropped.length, freehire.length)} of freehire, ${pct(dropped.length, rows.length)} of all listed). Listed jobs after: ${rows.length - dropped.length}.`,
          `Other sources' jobs that would keep their listing but lose a job-board apply link: ${otherBoardLinks.length}.`,
          `freehire jobs listed today with no apply link at all (not changed by this): ${noLink.length}.`,
          '',
        )

        const bySite = new Map<string, number>()
        const byCountry = new Map<string, number>()
        const byRole = new Map<string, number>()
        const byMode = new Map<string, number>()
        for (const r of dropped) {
          count(bySite, applySiteOf(r.applyUrl) ?? '?')
          count(byCountry, r.countryCode ?? '(none)')
          count(byRole, r.roleSlug ?? '(none)')
          count(byMode, r.remoteMode ?? '(not stated)')
        }
        const listedByCountry = new Map<string, number>()
        for (const r of rows) count(listedByCountry, r.countryCode ?? '(none)')
        out.push('### Dropped, by site', '', ...top(bySite, 40).map(([s, n]) => `- ${s}: ${n}`), '')
        out.push(
          '### Dropped, by country (share of that country\'s listed jobs)',
          '',
          ...top(byCountry, 15).map(([c, n]) => `- ${c}: ${n} of ${listedByCountry.get(c) ?? 0} (${pct(n, listedByCountry.get(c) ?? 0)})`),
          '',
        )
        out.push('### Dropped, by role', '', ...top(byRole, 15).map(([s, n]) => `- ${s}: ${n}`), '')
        out.push('### Dropped, by work mode', '', ...top(byMode, 5).map(([s, n]) => `- ${s}: ${n}`), '')

        // Companies that would have no listed job left.
        const liveByCompany = new Map<string, number>()
        const droppedByCompany = new Map<string, number>()
        for (const r of rows) if (r.companyId) count(liveByCompany, r.companyId)
        for (const r of dropped) if (r.companyId) count(droppedByCompany, r.companyId)
        const emptied = [...droppedByCompany.entries()].filter(([id, n]) => n === liveByCompany.get(id)).map(([id]) => id)
        const names = emptied.length
          ? await tx.company.findMany({ where: { id: { in: emptied } }, select: { name: true, slug: true }, take: 2000 })
          : []
        out.push(
          `### Companies left with no listed job: ${emptied.length} (of ${liveByCompany.size} with listed jobs)`,
          '',
          `Examples: ${names.slice(0, 20).map((c) => c.name).join(', ') || '-'}`,
          '',
        )

        // freehire sites the list does not catch, to review the list itself.
        const kept = new Map<string, number>()
        for (const r of freehire) if (r.applyUrl && !isJobBoardApplyUrl(r.applyUrl)) count(kept, applySiteOf(r.applyUrl) ?? '?')
        out.push('### freehire sites the list leaves alone (top 60; check for boards it misses)', '', ...top(kept, 60).map(([s, n]) => `- ${s}: ${n}`), '')

        const otherBySite = new Map<string, number>()
        for (const r of otherBoardLinks) count(otherBySite, `${r.source} → ${applySiteOf(r.applyUrl)}`)
        out.push('### Other sources with a job-board link', '', ...top(otherBySite, 15).map(([s, n]) => `- ${s}: ${n}`), '')
      },
      { timeout: 120_000 },
    )
  } finally {
    await prisma.$disconnect()
  }
  const text = out.join('\n') + '\n'
  console.log(text)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
