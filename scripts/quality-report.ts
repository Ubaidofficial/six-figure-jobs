// scripts/quality-report.ts
//
// READ-ONLY. The "learning" half of every sync run: what the description readers just did, with the sentence each reading
// came from, so wrong readings are caught the day they appear instead of by a visitor.
//   1. Pay read from posting text (lib/jobs/payEvidence.ts): freehire jobs stored in the window that carry a raw salary
//      sentence, with the range we stored.
//   2. Who remote jobs are open to (lib/jobs/remoteScope.ts): jobs stored in the window whose description limits or opens
//      them, next to what we stored; conflicts first.
//   3. Counts per source of jobs stored in the window.
// It changes nothing: every statement is a SELECT in a READ ONLY transaction. A person (or the daily review) reads it, and
// each wrong reading becomes a failing test and a rule fix (CLAUDE.md: pay from description text).
//
//   npx tsx scripts/quality-report.ts [--hours=8]
import { appendFileSync } from 'node:fs'

import { compareScope, storedScope } from './audit-remote-scope'
import { readRemoteScope } from '../lib/jobs/remoteScope'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const hours = Math.min(72, Math.max(1, Number(arg('hours')) || 8))
  const since = new Date(Date.now() - hours * 3600_000)
  const out: string[] = [`## Quality report: jobs stored in the last ${hours} hours (read-only)`, '']
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')

        const bySource = await tx.job.groupBy({ by: ['source'], where: { createdAt: { gte: since } }, _count: { _all: true } })
        out.push('### Jobs stored per source', '', '| source | jobs |', '| --- | --- |')
        for (const r of bySource.sort((a, b) => b._count._all - a._count._all)) out.push(`| ${r.source} | ${r._count._all} |`)

        const pay = await tx.job.findMany({
          where: { createdAt: { gte: since }, source: 'board:freehire', salaryRaw: { not: null } },
          select: { title: true, company: true, currency: true, minAnnual: true, maxAnnual: true, salaryRaw: true },
          orderBy: { createdAt: 'desc' },
          take: 60,
        })
        out.push('', `### Pay read from the posting text (${pay.length} jobs; review each sentence)`, '')
        out.push(
          ...(pay.length
            ? pay.map(
                (j) =>
                  `- ${j.currency ?? '?'} ${j.minAnnual ?? '?'}-${j.maxAnnual ?? '?'} | ${j.title.slice(0, 45)} — ${(j.company ?? '').slice(0, 22)} | "${(j.salaryRaw ?? '').replace(/\s+/g, ' ').slice(0, 200)}"`,
              )
            : ['(none in this window)']),
        )

        const remote = await tx.job.findMany({
          where: { createdAt: { gte: since }, isExpired: false, OR: [{ remote: true }, { remoteMode: 'remote' }], descriptionHtml: { not: null } },
          select: { source: true, title: true, countryCode: true, locationRaw: true, descriptionHtml: true },
          orderBy: { createdAt: 'desc' },
          take: 1500,
        })
        const rows = remote
          .map((j) => ({ j, read: readRemoteScope(j.descriptionHtml) }))
          .filter((r) => r.read)
          .map((r) => ({ ...r, bucket: compareScope(storedScope(r.j), r.read) }))
        const count = (head: string) => rows.filter((r) => r.bucket.startsWith(head)).length
        out.push(
          '',
          `### Who remote jobs are open to, from the description (${remote.length} remote jobs stored; the description says something clear for ${rows.length}: ${count('agree')} agree with what we store, ${count('NEW')} new, ${count('CONFLICT')} conflict)`,
          '',
        )
        const show = [...rows.filter((r) => r.bucket.startsWith('CONFLICT')), ...rows.filter((r) => r.bucket.startsWith('NEW'))].slice(0, 40)
        out.push(
          ...(show.length
            ? show.map((r) => `- ${r.bucket} | ${r.j.source} | "${(r.j.locationRaw ?? '').slice(0, 40)}" | ${r.j.title.slice(0, 45)} | "${r.read!.quote.replace(/\s+/g, ' ').slice(0, 200)}"`)
            : ['(no conflicts or new readings in this window)']),
        )
      },
      { timeout: 120_000, maxWait: 30_000 },
    )
  } finally {
    await prisma.$disconnect()
  }
  const report = out.join('\n')
  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
