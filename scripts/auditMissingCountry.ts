// scripts/auditMissingCountry.ts
//
// READ-ONLY. The quality finding `missing_country` (lib/quality/checks.ts): listed jobs with no countryCode, so they are in
// no country filter, country page or remote-region list. For each, today's location rules (processLocation in
// lib/ingest/index.ts) are run again on what is stored (location text, pay currency, work mode), to tell rows that are
// only stale (today's code would give them a country) from the ones today's code still cannot place, grouped by source
// and location text. Every statement is a SELECT in a READ ONLY transaction.
//
//   npx tsx scripts/auditMissingCountry.ts
import { appendFileSync } from 'node:fs'

import { processLocation } from '../lib/ingest/index'
import { buildWhere } from '../lib/jobs/queryJobs'

type Row = { id: string; source: string; title: string; locationRaw: string | null; currency: string | null; remote: boolean | null; remoteMode: string | null }

const REGION = /\b(emea|apac|apj|latam|americas|europe|european union|eu|asia|nordics|dach|benelux|middle east|africa|oceania|anz|north america|worldwide|global|anywhere)\b/i

/** Why a row has no country, in a few buckets (pure). */
export function bucketOf(r: Pick<Row, 'locationRaw'>): string {
  const t = (r.locationRaw ?? '').trim()
  if (!t) return 'no location text'
  if (/^remote\.?$/i.test(t)) return 'just "Remote"'
  if (REGION.test(t)) return 'names a region (EMEA, Europe, worldwide…)'
  return 'other text'
}

const count = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1)
const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const out: string[] = ['## Listed jobs with no country (read-only)', '']
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        const rows = (await tx.job.findMany({
          where: { AND: [buildWhere({}), { countryCode: null }] },
          select: { id: true, source: true, title: true, locationRaw: true, currency: true, remote: true, remoteMode: true },
          take: 20000,
        })) as Row[]
        out.push(`${rows.length} listed jobs have no country.`, '')

        const resolved: Array<Row & { cc: string }> = []
        const unresolved: Row[] = []
        for (const r of rows) {
          const mode = r.remoteMode === 'remote' || r.remoteMode === 'hybrid' || r.remoteMode === 'onsite' ? r.remoteMode : null
          const loc = processLocation({ locationText: r.locationRaw, salaryCurrency: r.currency, isRemote: r.remote, workplaceType: mode } as Parameters<typeof processLocation>[0])
          if (loc.countryCode) resolved.push({ ...r, cc: loc.countryCode })
          else unresolved.push(r)
        }

        out.push(`### Stale: today's rules give ${resolved.length} of them a country`, '')
        const byCc = new Map<string, number>()
        for (const r of resolved) count(byCc, r.cc)
        out.push(`By country: ${top(byCc, 15).map(([k, n]) => `${k} ${n}`).join(', ') || '-'}`, '')
        for (const r of resolved.slice(0, 12)) out.push(`- ${r.source} · "${r.locationRaw}" · ${r.currency ?? '-'} · ${r.remoteMode ?? '-'} -> ${r.cc}`)
        out.push('')

        out.push(`### Still no country with today's rules: ${unresolved.length}`, '')
        const bySource = new Map<string, number>()
        const byBucket = new Map<string, number>()
        const byText = new Map<string, number>()
        const byMode = new Map<string, number>()
        for (const r of unresolved) {
          count(bySource, r.source.replace(/:[^:]*$/, '').startsWith('board') ? r.source : r.source.split(':').slice(0, 2).join(':'))
          count(byBucket, bucketOf(r))
          count(byText, (r.locationRaw ?? '(none)').trim().toLowerCase().slice(0, 80))
          count(byMode, r.remoteMode ?? 'unknown')
        }
        out.push(`By source: ${top(bySource, 15).map(([k, n]) => `${k} ${n}`).join(', ')}`)
        out.push(`By reason: ${top(byBucket, 10).map(([k, n]) => `${k} ${n}`).join(', ')}`)
        out.push(`By work mode: ${top(byMode, 5).map(([k, n]) => `${k} ${n}`).join(', ')}`, '')
        out.push('Most common location texts:', '')
        for (const [t, n] of top(byText, 60)) out.push(`- ${n} × "${t}"`)
        out.push('', 'Examples:', '')
        for (const r of unresolved.slice(0, 25)) out.push(`- ${r.id} · ${r.title.slice(0, 70)} · "${r.locationRaw ?? ''}" · ${r.currency ?? '-'} · ${r.remoteMode ?? '-'}`)
      },
      { timeout: 120_000 },
    )
  } finally {
    await prisma.$disconnect()
  }
  const text = out.join('\n') + '\n'
  process.stdout.write(text)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text)
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
}
