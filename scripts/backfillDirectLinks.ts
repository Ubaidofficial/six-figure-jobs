// scripts/backfillDirectLinks.ts
//
// For listed freehire jobs whose apply link goes to a job board, look for the employer's own link (findDirectLink,
// lib/scrapers/freehireDirectLink.ts) and, with --apply, put it on the job's apply button. A job with no employer link
// keeps its board link (owner's decision, 2026-11-26). DRY RUN unless --apply: reads only (SELECTs in a READ ONLY
// transaction) and prints what it would change. --apply writes `applyUrl` and `updatedAt` on the jobs it found a link
// for, nothing else. Jobgether, karriere.at and PowerToFly jobs first, then newest first; `--limit` caps how many are
// looked at (the workflow job has 30 minutes: about 1,500 jobs at freehire's pace), `--offset` skips those already seen.
//
//   npx tsx scripts/backfillDirectLinks.ts [--limit=1500] [--offset=0] [--apply]
import { appendFileSync } from 'node:fs'

import { applySiteOf, isJobBoardApplyUrl } from '../lib/jobs/applyUrl'
import { buildWhere } from '../lib/jobs/queryJobs'
import { directLinkDeps } from '../lib/scrapers/freehire'
import { findDirectLink, PAGE_BOARDS } from '../lib/scrapers/freehireDirectLink'

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const apply = process.argv.includes('--apply')
  const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8)) || 1500
  const offset = Number(process.argv.find((a) => a.startsWith('--offset='))?.slice(9)) || 0
  const { prisma } = await import('../lib/prisma')
  const deps = directLinkDeps()
  const out = [`## Employer links for jobs that link to a job board (${apply ? 'APPLIED' : 'dry run'})`, '']
  try {
    const listed = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        return tx.job.findMany({
          where: { AND: [buildWhere({}), { source: 'board:freehire' }, { sourceRef: { not: null } }] },
          select: { id: true, applyUrl: true, sourceRef: true },
          orderBy: { createdAt: 'desc' },
        })
      },
      { timeout: 120_000 },
    )
    // Boards whose pages are read first (most links are found there: 32 of 46 Jobgether jobs on 2026-11-26), then the
    // rest, newest first. A job with no employer link keeps its board link, so a rerun would see it again: --offset
    // moves the next run past the jobs already looked at.
    const todo = listed
      .filter((j) => isJobBoardApplyUrl(j.applyUrl))
      .sort((a, b) => Number(PAGE_BOARDS.includes(applySiteOf(b.applyUrl) ?? '')) - Number(PAGE_BOARDS.includes(applySiteOf(a.applyUrl) ?? '')))
    const batch = todo.slice(offset, offset + limit)
    const bySite = new Map<string, { looked: number; found: number }>()
    const byWay = new Map<string, number>()
    const examples: string[] = []
    let found = 0
    for (const job of batch) {
      const site = applySiteOf(job.applyUrl) ?? '?'
      const tally = bySite.get(site) ?? { looked: 0, found: 0 }
      tally.looked++
      bySite.set(site, tally)
      const sourceUrl = (await deps.dataJob(job.sourceRef!))?.source_url
      const direct = await findDirectLink(job.sourceRef!, job.applyUrl!, sourceUrl, deps)
      if (!direct) continue
      found++
      tally.found++
      byWay.set(direct.via, (byWay.get(direct.via) ?? 0) + 1)
      if (examples.length < 20) examples.push(`- ${job.applyUrl} → ${direct.url} (${direct.via})`)
      if (apply) await prisma.job.update({ where: { id: job.id }, data: { applyUrl: direct.url, updatedAt: new Date() } })
    }
    out.push(
      `Listed freehire jobs with a job-board link: ${todo.length}; looked at ${batch.length} (from ${offset}; next run: --offset=${offset + batch.length - (apply ? found : 0)}, since the jobs given an employer link leave this list).`,
      `**Employer link found: ${found}** (${Math.round((found / Math.max(batch.length, 1)) * 100)}%)${apply ? ', written' : ', nothing written'}. Found through: ${[...byWay.entries()].map(([w, n]) => `${w} ${n}`).join(', ') || '-'}.`,
      '',
      '| board site | looked at | found |',
      '|---|---|---|',
      ...[...bySite.entries()].sort((a, b) => b[1].looked - a[1].looked).map(([s, t]) => `| ${s} | ${t.looked} | ${t.found} |`),
      '',
      '### Examples',
      '',
      ...examples,
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
