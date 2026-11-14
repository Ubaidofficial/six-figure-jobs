// scripts/backfillRemoteEvidence.ts
//
// Fill an EMPTY `remoteMode` from what a posting's own sentences say (lib/jobs/remoteEvidence.ts). Owner's ruling,
// 2026-11-14: description text may set this field only through the evidence extractor (see CLAUDE.md, SEO rules).
//
// Safe by default:
//  - a dry run unless --apply is passed;
//  - only jobs whose remoteMode is null (and remote is not true) are looked at, and the write is conditional on the
//    field still being null, so an ATS value is never overridden;
//  - only `remote` is written unless --modes names hybrid / onsite too: `remoteMode` drives JSON-LD
//    (jobLocationType TELECOMMUTE, jobLocation), so widening it is a deliberate step;
//  - `updatedAt` is kept as it was, so sitemap lastmod does not move for a data repair.
//
// Usage:
//   npx tsx scripts/backfillRemoteEvidence.ts                              # dry run, remote only
//   npx tsx scripts/backfillRemoteEvidence.ts --modes=remote,hybrid,onsite --limit=5000
//   npx tsx scripts/backfillRemoteEvidence.ts --apply --report=remote-evidence.json
import { writeFileSync } from 'node:fs'
import { format as __format } from 'node:util'

import { findRemoteEvidence, type RemoteMode } from '../lib/jobs/remoteEvidence'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const apply = process.argv.includes('--apply')
const modes = new Set((arg('modes') ?? 'remote').split(',').map((m) => m.trim()) as RemoteMode[])
const limit = Number(arg('limit') ?? 0) || Infinity
const reportPath = arg('report')
const BATCH = 500

async function main() {
  const counts = { looked: 0, remote: 0, hybrid: 0, onsite: 0, applied: 0 }
  const report: Array<{ id: string; title: string; source: string; mode: RemoteMode; quote: string; written: boolean }> = []
  let cursor: string | undefined

  while (counts.looked < limit) {
    const jobs = await prisma.job.findMany({
      where: {
        isExpired: false,
        remoteMode: null,
        OR: [{ remote: null }, { remote: false }],
        descriptionHtml: { not: null },
      },
      select: { id: true, title: true, source: true, descriptionHtml: true, updatedAt: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (!jobs.length) break
    cursor = jobs[jobs.length - 1].id

    for (const job of jobs) {
      if (counts.looked++ >= limit) break
      const found = findRemoteEvidence(job.descriptionHtml)
      if (!found) continue
      counts[found.mode]++
      const wanted = modes.has(found.mode)
      let written = false
      if (apply && wanted) {
        const { count } = await prisma.job.updateMany({
          where: { id: job.id, remoteMode: null },
          data: { remoteMode: found.mode, updatedAt: job.updatedAt },
        })
        written = count === 1
        counts.applied += count
      }
      report.push({ id: job.id, title: job.title, source: job.source, mode: found.mode, quote: found.quote, written })
    }
  }

  __slog(`${apply ? 'APPLIED' : 'DRY RUN'} (modes: ${[...modes].join(', ')})`)
  __slog(JSON.stringify(counts))
  for (const r of report.slice(0, 15)) __slog(`  [${r.mode}] ${r.source} | ${r.title.slice(0, 60)} | "${r.quote.slice(0, 120)}"`)
  if (reportPath) {
    writeFileSync(reportPath, JSON.stringify({ apply, modes: [...modes], counts, report }, null, 1))
    __slog(`report: ${reportPath}`)
  }
}

main()
  .catch((err) => {
    process.stderr.write(String(err?.stack ?? err) + '\n')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
