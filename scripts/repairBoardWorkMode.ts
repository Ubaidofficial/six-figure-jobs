// scripts/repairBoardWorkMode.ts
//
// Correct the work mode of jobs from a job BOARD (source "board:...", not an employer's ATS) that were stored as on-site while
// the posting's own sentences say remote or hybrid. Why they are wrong: until 2026-11-17 the freehire mapper dropped freehire's
// own hybrid / onsite and sent only "remote", so a hybrid job with a city in its location text was stored on-site (audit of
// the last 3 days: 142 stored on-site whose text says hybrid, 17 whose text says remote).
//
// Safe by default, like backfillRemoteEvidence.ts (owner's ruling 2026-11-14: description text may set remoteMode only through
// lib/jobs/remoteEvidence.ts, which quotes the sentence):
//  - a DRY RUN unless --apply is passed; the dry run only SELECTs;
//  - only live jobs from a board source whose remoteMode is "onsite" and whose remote flag is not set are looked at; an ATS
//    value (source "ats:...") is never touched, and a stored "remote" or "hybrid" is never changed;
//  - only remote and hybrid are written (never "onsite" over something else), through a write conditional on the job still
//    being "onsite", and only `remoteMode`: not remoteRegion, not the country;
//  - `updatedAt` is kept, so sitemap lastmod does not move for a data repair; the sentence is saved as evidence.
// `remoteMode` drives JSON-LD (jobLocationType TELECOMMUTE), so this is an SEO change for the jobs it touches.
//
//   npx tsx scripts/repairBoardWorkMode.ts [--days=30] [--limit=5000]          dry run
//   npx tsx scripts/repairBoardWorkMode.ts --apply --days=30 --report=repair.json
import { appendFileSync, writeFileSync } from 'node:fs'

import { findRemoteEvidence, type RemoteMode } from '../lib/jobs/remoteEvidence'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

export type Candidate = { source: string; remote: boolean | null; remoteMode: string | null; descriptionHtml: string | null }

/** The mode to write and the sentence it was read from, or null when the job is not one this script may change (pure). */
export function planRepair(job: Candidate): { mode: 'remote' | 'hybrid'; quote: string } | null {
  if (!job.source.startsWith('board:')) return null
  if (job.remoteMode !== 'onsite' || job.remote === true) return null
  const found = findRemoteEvidence(job.descriptionHtml)
  if (!found || (found.mode !== 'remote' && found.mode !== 'hybrid')) return null
  return { mode: found.mode, quote: found.quote }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const apply = process.argv.includes('--apply')
  const days = Math.min(Math.max(Number(arg('days')) || 30, 1), 90)
  const limit = Math.min(Number(arg('limit')) || 5000, 20000)
  const { prisma } = await import('../lib/prisma')
  const { remoteEvidenceRecord, saveEvidence } = await import('../lib/history/evidence')
  const since = new Date(Date.now() - days * 86_400_000)
  const out: string[] = [`## ${apply ? 'APPLIED' : 'DRY RUN'}: board jobs stored on-site whose own text says remote or hybrid (posted in the last ${days} days)`, '']
  const counts = { looked: 0, remote: 0, hybrid: 0, written: 0, evidenceSaved: 0 }
  const bySource = new Map<string, number>()
  const samples: string[] = []
  const report: Array<{ id: string; title: string; source: string; to: RemoteMode; quote: string; written: boolean }> = []
  try {
    const jobs = await prisma.job.findMany({
      where: { isExpired: false, postedAt: { gte: since }, source: { startsWith: 'board:' }, remoteMode: 'onsite', OR: [{ remote: null }, { remote: false }], descriptionHtml: { not: null } },
      select: { id: true, title: true, source: true, locationRaw: true, remote: true, remoteMode: true, descriptionHtml: true, updatedAt: true },
      orderBy: { postedAt: 'desc' },
      take: limit,
    })
    for (const job of jobs) {
      counts.looked++
      const plan = planRepair(job)
      if (!plan) continue
      counts[plan.mode]++
      bySource.set(job.source, (bySource.get(job.source) ?? 0) + 1)
      let written = false
      if (apply) {
        const { count } = await prisma.job.updateMany({ where: { id: job.id, remoteMode: 'onsite' }, data: { remoteMode: plan.mode, updatedAt: job.updatedAt } })
        written = count === 1
        counts.written += count
        if (written) counts.evidenceSaved += await saveEvidence(prisma, [remoteEvidenceRecord(job.id, { mode: plan.mode, quote: plan.quote })])
      }
      report.push({ id: job.id, title: job.title, source: job.source, to: plan.mode, quote: plan.quote, written })
      if (samples.length < 40) samples.push(`- on-site -> ${plan.mode} | ${job.source} | "${(job.locationRaw ?? '').slice(0, 40)}" | ${job.title.slice(0, 45)} | "${plan.quote.replace(/\s+/g, ' ').slice(0, 220)}"`)
    }
  } finally {
    await prisma.$disconnect()
  }
  out.push(`${counts.looked} live board jobs stored on-site were read. To remote: ${counts.remote}. To hybrid: ${counts.hybrid}.${apply ? ` Written: ${counts.written}. Evidence saved: ${counts.evidenceSaved}.` : ' Nothing was written.'}`, '', '| source | jobs to change |', '| --- | --- |')
  for (const [s, n] of [...bySource].sort((a, b) => b[1] - a[1])) out.push(`| ${s} | ${n} |`)
  out.push('', '### Examples (review for wrong readings)', '', ...(samples.length ? samples : ['(none)']))
  const text = out.join('\n')
  console.log(text)
  if (arg('report')) writeFileSync(arg('report') as string, JSON.stringify({ apply, days, counts, report }, null, 1))
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
