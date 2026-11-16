// scripts/auditRecentRemote.ts
//
// READ-ONLY. Is the remote, hybrid and place data of the jobs POSTED IN THE LAST 3 DAYS right? Only live jobs whose employer
// posting date (postedAt) is within the last 3 days are read (owner's request, 2026-11-17: "just check the jobs which are
// posted in last 3 days only"); jobs with no posting date are counted and left out. For each, the stored work mode
// (remote flag, remoteMode), place (locationRaw, city, countryCode, remoteRegion) are compared with each other and with the
// posting's own sentences (lib/jobs/remoteEvidence.ts quotes them). Every statement is a SELECT in a READ ONLY transaction.
// Output: counts and examples (public job data) for a person to review before anything is changed.
//
//   npx tsx scripts/auditRecentRemote.ts [--days=3]
import { appendFileSync } from 'node:fs'

import { findRemoteEvidence } from '../lib/jobs/remoteEvidence'
import { isWorldwideLocationText } from '../lib/jobs/remoteRegions'
import { countryFromText } from '../lib/location/jobLocation'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

type Row = {
  id: string
  source: string
  title: string
  locationRaw: string | null
  city: string | null
  countryCode: string | null
  remote: boolean | null
  remoteMode: string | null
  remoteRegion: string | null
  descriptionHtml: string | null
}

const REMOTE_WORDS = /\b(remote|anywhere|worldwide|work from home|wfh|distributed)\b/i
const HYBRID_WORDS = /\bhybrid\b/i
const ONSITE_WORDS = /\b(on-?site|in[- ]office)\b/i

/** What the stored fields say the job is: remote, hybrid, onsite or unstated (pure). */
export function storedMode(r: Pick<Row, 'remote' | 'remoteMode'>): 'remote' | 'hybrid' | 'onsite' | 'unstated' {
  if (r.remoteMode === 'remote' || r.remoteMode === 'hybrid' || r.remoteMode === 'onsite') return r.remoteMode
  return r.remote === true ? 'remote' : 'unstated'
}

/** Problems found in one job's own fields (pure). Each is a short code. */
export function fieldProblems(r: Row): string[] {
  const p: string[] = []
  const loc = r.locationRaw ?? ''
  const mode = storedMode(r)
  if (r.remote === true && (r.remoteMode === 'onsite' || r.remoteMode === 'hybrid')) p.push(`flag-remote-but-mode-${r.remoteMode}`)
  if (r.remoteMode === 'remote' && r.remote !== true) p.push('mode-remote-but-flag-not-set')
  if (REMOTE_WORDS.test(loc) && mode !== 'remote' && !HYBRID_WORDS.test(loc)) p.push('location-says-remote-but-not-stored-remote')
  if (HYBRID_WORDS.test(loc) && mode !== 'hybrid') p.push('location-says-hybrid-but-not-stored-hybrid')
  if (mode === 'remote' && !r.countryCode && !r.remoteRegion && !isWorldwideLocationText(loc)) p.push('remote-with-no-country-or-region')
  if (mode === 'remote' && r.countryCode && !countryFromText(loc) && !REMOTE_WORDS.test(loc) && loc) p.push('remote-country-not-in-location-text')
  if (r.countryCode && loc) {
    const fromText = countryFromText(loc)
    if (fromText && fromText !== r.countryCode.toUpperCase()) p.push('country-differs-from-location-text')
  }
  return p
}

/** How the stored mode compares with what the posting's own sentences say (pure). */
export function compareWithDescription(r: Row): { head: 'agree' | 'NEW' | 'CONFLICT' | 'none'; quote?: string; said?: string } {
  const ev = findRemoteEvidence(r.descriptionHtml)
  if (!ev) return { head: 'none' }
  const mode = storedMode(r)
  if (mode === 'unstated') return { head: 'NEW', quote: ev.quote, said: ev.mode }
  return mode === ev.mode ? { head: 'agree', quote: ev.quote, said: ev.mode } : { head: 'CONFLICT', quote: ev.quote, said: ev.mode }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const days = Math.min(Math.max(Number(arg('days')) || 3, 1), 14)
  const out: string[] = [`## Remote and place data of jobs posted in the last ${days} days (read-only)`, '']
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        const since = new Date(Date.now() - days * 86_400_000)
        const noDate = await tx.job.count({ where: { isExpired: false, postedAt: null, createdAt: { gte: since } } })
        const rows = (await tx.job.findMany({
          where: { isExpired: false, postedAt: { gte: since } },
          select: { id: true, source: true, title: true, locationRaw: true, city: true, countryCode: true, remote: true, remoteMode: true, remoteRegion: true, descriptionHtml: true },
          orderBy: { postedAt: 'desc' },
          take: 20000,
        })) as Row[]
        out.push(`${rows.length} live jobs with a posting date in the last ${days} days. Left out: ${noDate} live jobs first stored in that time that have no posting date.`, '')

        const modes = new Map<string, number>()
        const bySourceMode = new Map<string, Map<string, number>>()
        for (const r of rows) {
          const m = storedMode(r)
          modes.set(m, (modes.get(m) ?? 0) + 1)
          const s = bySourceMode.get(r.source) ?? new Map<string, number>()
          s.set(m, (s.get(m) ?? 0) + 1)
          bySourceMode.set(r.source, s)
        }
        out.push('### Stored work mode', '', '| mode | jobs | share |', '| --- | --- | --- |')
        for (const m of ['remote', 'hybrid', 'onsite', 'unstated']) out.push(`| ${m} | ${modes.get(m) ?? 0} | ${rows.length ? (((modes.get(m) ?? 0) / rows.length) * 100).toFixed(1) : '0'}% |`)
        out.push('', '### By source', '', '| source | jobs | remote | hybrid | onsite | unstated |', '| --- | --- | --- | --- | --- | --- |')
        for (const [source, m] of [...bySourceMode].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0)).slice(0, 14)) {
          out.push(`| ${source} | ${[...m.values()].reduce((x, y) => x + y, 0)} | ${m.get('remote') ?? 0} | ${m.get('hybrid') ?? 0} | ${m.get('onsite') ?? 0} | ${m.get('unstated') ?? 0} |`)
        }

        const problems = new Map<string, number>()
        const problemSamples = new Map<string, string[]>()
        const desc = new Map<string, number>()
        const descSamples = new Map<string, string[]>()
        for (const r of rows) {
          for (const code of fieldProblems(r)) {
            problems.set(code, (problems.get(code) ?? 0) + 1)
            const l = problemSamples.get(code) ?? []
            if (l.length < 8) l.push(`- ${r.source} | "${(r.locationRaw ?? '').slice(0, 50)}" | remote=${r.remote} mode=${r.remoteMode} country=${r.countryCode} region=${r.remoteRegion} | ${r.title.slice(0, 50)} | /job id ${r.id.slice(0, 40)}`)
            problemSamples.set(code, l)
          }
          const c = compareWithDescription(r)
          const key = c.head === 'none' ? 'description says nothing clear' : c.head === 'agree' ? `agree: ${c.said}` : `${c.head}: stored ${storedMode(r)}, description ${c.said}`
          desc.set(key, (desc.get(key) ?? 0) + 1)
          if (c.head === 'CONFLICT' || c.head === 'NEW') {
            const l = descSamples.get(key) ?? []
            if (l.length < 6) l.push(`- ${r.source} | "${(r.locationRaw ?? '').slice(0, 40)}" | ${r.title.slice(0, 45)} | "${(c.quote ?? '').replace(/\s+/g, ' ').slice(0, 200)}"`)
            descSamples.set(key, l)
          }
        }
        out.push('', '### Problems in the stored fields themselves', '', '| problem | jobs | share |', '| --- | --- | --- |')
        for (const [k, n] of [...problems].sort((a, b) => b[1] - a[1])) out.push(`| ${k} | ${n} | ${((n / Math.max(rows.length, 1)) * 100).toFixed(1)}% |`)
        if (!problems.size) out.push('| (none found) | 0 | 0% |')
        for (const [k, list] of problemSamples) out.push('', `#### ${k}`, '', ...list)

        out.push('', '### Stored mode against the posting\'s own sentences', '', '| result | jobs |', '| --- | --- |')
        for (const [k, n] of [...desc].sort((a, b) => b[1] - a[1])) out.push(`| ${k} | ${n} |`)
        for (const [k, list] of descSamples) out.push('', `#### ${k} (review for wrong readings)`, '', ...list)
      },
      { timeout: 180_000, maxWait: 30_000 },
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
