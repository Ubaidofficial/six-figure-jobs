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
// A second direction, --from=remote (owner's request 2026-11-17: "repair the 220 stored-remote jobs whose text says hybrid"):
// board jobs stored REMOTE whose own sentence says the role is hybrid. This is the costly direction (it takes a job off /remote
// and off TELECOMMUTE), so it is much stricter: see planRemoteToHybrid. It also clears the `remote` flag, because isRemoteJob()
// (lib/seo/jobJsonLd.ts) treats `remote === true` as remote whatever remoteMode says; those are the only two fields it writes.
//
//   npx tsx scripts/repairBoardWorkMode.ts [--days=30] [--limit=5000]          dry run
//   npx tsx scripts/repairBoardWorkMode.ts --apply --days=30 --report=repair.json
//   npx tsx scripts/repairBoardWorkMode.ts --from=remote [--apply] --days=30
import { appendFileSync, writeFileSync } from 'node:fs'

import { findRemoteEvidence, type RemoteMode } from '../lib/jobs/remoteEvidence'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

export type Candidate = { source: string; remote: boolean | null; remoteMode: string | null; descriptionHtml: string | null }

// A sentence that offers remote NEXT TO another way of working ("Hybrid in London or Remote within the UK", "Chicago or remote",
// "remote-friendly", "onsite is preferred") says remote is possible, not that the role is remote. Written as remote it would tell
// Google the job is telecommute (JobPosting jobLocationType). Review of the first 64 readings (2026-11-17) found 8 like that; they
// stay as they are.
const OFFERS_ANOTHER_MODE = /\b(?:hybrid|on-?site|in[- ]office|in[- ]person)\b|\bor remote\b|\bremote\s*\/|\bremote[- ]friendly\b|\bis preferred\b|\bbut if\b/i

/** The mode to write and the sentence it was read from, or null when the job is not one this script may change (pure). */
export function planRepair(job: Candidate): { mode: 'remote' | 'hybrid'; quote: string } | null {
  if (!job.source.startsWith('board:')) return null
  if (job.remoteMode !== 'onsite' || job.remote === true) return null
  const found = findRemoteEvidence(job.descriptionHtml)
  if (!found || (found.mode !== 'remote' && found.mode !== 'hybrid')) return null
  if (found.mode === 'remote' && OFFERS_ANOTHER_MODE.test(found.quote)) return null
  return { mode: found.mode, quote: found.quote }
}

// Remote -> hybrid: only a sentence that is about THIS role and offers no remote. "Fully remote, hybrid and on-site options in
// Munich", "remote work opportunities within the US", "Maven embraces a flexible hybrid work model" (company policy, and the
// location says Remote) all stay as stored. A location text that itself says remote also keeps the job remote.
const ROLE_IS_HYBRID = new RegExp(
  [
    '\\b(?:this|the) (?:\\w+ ){0,3}?(?:role|position|job|opportunity) is (?:a )?hybrid\\b',
    '\\bthis is (?:a )?hybrid (?:role|position|job|opportunity)\\b',
    '\\b(?:location|work ?(?:place|location|model|arrangement|type))\\s*[:–-]\\s*hybrid\\b',
    '\\b\\d(?:\\s*[-–]\\s*\\d)?\\s*days?\\s*(?:a|per|each|/)\\s*week\\b[^.;]{0,40}\\b(?:office|on-?site|in[- ]person)\\b',
  ].join('|'),
  'i',
)
const SAYS_REMOTE = /\bremote(?:ly)?\b|\bwork(?:ing)? from home\b|\bwfh\b|\banywhere\b|\bworldwide\b|\bdistributed\b/i

export type RemoteCandidate = Candidate & { locationRaw: string | null }

/** Hybrid for a board job stored remote, with the sentence, or null when it may not be changed (pure). */
export function planRemoteToHybrid(job: RemoteCandidate): { mode: 'hybrid'; quote: string } | null {
  if (!job.source.startsWith('board:')) return null
  const storedRemote = job.remoteMode === 'remote' || (job.remoteMode == null && job.remote === true)
  if (!storedRemote) return null
  if (job.locationRaw && SAYS_REMOTE.test(job.locationRaw)) return null
  const found = findRemoteEvidence(job.descriptionHtml)
  if (!found || found.mode !== 'hybrid') return null
  if (!ROLE_IS_HYBRID.test(found.quote) || SAYS_REMOTE.test(found.quote)) return null
  return { mode: 'hybrid', quote: found.quote }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const apply = process.argv.includes('--apply')
  const fromRemote = arg('from') === 'remote'
  const days = Math.min(Math.max(Number(arg('days')) || 30, 1), 90)
  const limit = Math.min(Number(arg('limit')) || 5000, 20000)
  const { prisma } = await import('../lib/prisma')
  const { remoteEvidenceRecord, saveEvidence } = await import('../lib/history/evidence')
  const since = new Date(Date.now() - days * 86_400_000)
  const out: string[] = [`## ${apply ? 'APPLIED' : 'DRY RUN'}: board jobs stored ${fromRemote ? 'remote whose own text says hybrid' : 'on-site whose own text says remote or hybrid'} (posted in the last ${days} days)`, '']
  const counts = { looked: 0, remote: 0, hybrid: 0, written: 0, evidenceSaved: 0 }
  const bySource = new Map<string, number>()
  const samples: string[] = []
  const remoteSamples: string[] = []
  const report: Array<{ id: string; title: string; source: string; to: RemoteMode; quote: string; written: boolean }> = []
  try {
    const jobs = await prisma.job.findMany({
      where: fromRemote
        ? { isExpired: false, postedAt: { gte: since }, source: { startsWith: 'board:' }, OR: [{ remoteMode: 'remote' }, { remoteMode: null, remote: true }], descriptionHtml: { not: null } }
        : { isExpired: false, postedAt: { gte: since }, source: { startsWith: 'board:' }, remoteMode: 'onsite', OR: [{ remote: null }, { remote: false }], descriptionHtml: { not: null } },
      select: { id: true, title: true, source: true, locationRaw: true, remote: true, remoteMode: true, descriptionHtml: true, updatedAt: true },
      orderBy: { postedAt: 'desc' },
      take: limit,
    })
    for (const job of jobs) {
      counts.looked++
      const plan = fromRemote ? planRemoteToHybrid(job) : planRepair(job)
      if (!plan) continue
      counts[plan.mode]++
      bySource.set(job.source, (bySource.get(job.source) ?? 0) + 1)
      let written = false
      if (apply) {
        const { count } = fromRemote
          ? await prisma.job.updateMany({ where: { id: job.id, remoteMode: job.remoteMode, remote: job.remote }, data: { remoteMode: 'hybrid', remote: false, updatedAt: job.updatedAt } })
          : await prisma.job.updateMany({ where: { id: job.id, remoteMode: 'onsite' }, data: { remoteMode: plan.mode, updatedAt: job.updatedAt } })
        written = count === 1
        counts.written += count
        if (written) counts.evidenceSaved += await saveEvidence(prisma, [remoteEvidenceRecord(job.id, { mode: plan.mode, quote: plan.quote })])
      }
      report.push({ id: job.id, title: job.title, source: job.source, to: plan.mode, quote: plan.quote, written })
      // Every remote reading is listed (a wrong "remote" is the costly mistake); hybrid readings are sampled.
      if (fromRemote) remoteSamples.push(`- remote -> hybrid | ${job.source} | "${(job.locationRaw ?? '').slice(0, 40)}" | ${job.title.slice(0, 45)} | "${plan.quote.replace(/\s+/g, ' ').slice(0, 260)}"`)
      else if (plan.mode === 'remote') remoteSamples.push(`- on-site -> remote | ${job.source} | "${(job.locationRaw ?? '').slice(0, 40)}" | ${job.title.slice(0, 45)} | "${plan.quote.replace(/\s+/g, ' ').slice(0, 260)}"`)
      else if (samples.length < 25) samples.push(`- on-site -> ${plan.mode} | ${job.source} | "${(job.locationRaw ?? '').slice(0, 40)}" | ${job.title.slice(0, 45)} | "${plan.quote.replace(/\s+/g, ' ').slice(0, 220)}"`)
    }
  } finally {
    await prisma.$disconnect()
  }
  out.push(`${counts.looked} live board jobs stored on-site were read. To remote: ${counts.remote}. To hybrid: ${counts.hybrid}.${apply ? ` Written: ${counts.written}. Evidence saved: ${counts.evidenceSaved}.` : ' Nothing was written.'}`, '', '| source | jobs to change |', '| --- | --- |')
  for (const [s, n] of [...bySource].sort((a, b) => b[1] - a[1])) out.push(`| ${s} | ${n} |`)
  out.push('', fromRemote ? '### Every reading to HYBRID (review each)' : '### Every reading to REMOTE (review each)', '', ...(remoteSamples.length ? remoteSamples.slice(0, 250) : ['(none)']))
  out.push('', '### Examples of readings to hybrid (review for wrong readings)', '', ...(samples.length ? samples : ['(none)']))
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
