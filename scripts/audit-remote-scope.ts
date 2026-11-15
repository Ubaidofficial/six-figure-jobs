// scripts/audit-remote-scope.ts
//
// READ-ONLY. For live remote jobs, what does the description say about WHO can apply (anywhere in the world, one or more
// countries, a region), and how does that compare with what we store (countryCode, the location text)? Uses
// lib/jobs/remoteScope.ts, which answers only from the posting's own sentences and quotes them. Every statement is a
// SELECT inside a READ ONLY transaction. Output: counts, and examples with the sentence, for a person to review before
// anything is written.
//
//   npx tsx scripts/audit-remote-scope.ts [--limit=6000]
import { appendFileSync } from 'node:fs'

import { isWorldwideLocationText } from '../lib/jobs/remoteRegions'
import { readRemoteScope, type RemoteScope } from '../lib/jobs/remoteScope'
import { parseLimit } from '../lib/ai/freeEnrichWrite'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

type Stored = { kind: 'country'; code: string } | { kind: 'worldwide-text' } | { kind: 'undecided' }

export function storedScope(job: { countryCode: string | null; locationRaw: string | null }): Stored {
  if (job.countryCode) return { kind: 'country', code: job.countryCode.toUpperCase() }
  if (isWorldwideLocationText(job.locationRaw)) return { kind: 'worldwide-text' }
  return { kind: 'undecided' }
}

/** How the description's reading compares with what is stored (pure). */
export function compareScope(stored: Stored, read: RemoteScope | null): string {
  if (!read) return 'description says nothing clear'
  const label = read.kind === 'countries' ? `limits to ${read.countries.join('+')}` : read.kind === 'region' ? `limits to region ${read.region}` : 'worldwide'
  if (stored.kind === 'undecided') return `NEW: stored nothing, description ${label}`
  if (stored.kind === 'worldwide-text') {
    return read.kind === 'worldwide' ? 'agree: worldwide' : `CONFLICT: location text worldwide, description ${label}`
  }
  if (read.kind === 'countries') return read.countries.includes(stored.code) ? 'agree: country' : `CONFLICT: stored ${stored.code}, description ${label}`
  if (read.kind === 'worldwide') return `CONFLICT: stored ${stored.code}, description worldwide`
  return `info: stored ${stored.code}, description ${label}`
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const limit = parseLimit(arg('limit'), 6000, 20000)
  const out: string[] = ['## Remote scope: what the description says vs what we store (read-only)', '']
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        const jobs = await tx.job.findMany({
          where: { isExpired: false, OR: [{ remote: true }, { remoteMode: 'remote' }], descriptionHtml: { not: null } },
          select: { source: true, title: true, countryCode: true, locationRaw: true, descriptionHtml: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })
        const buckets = new Map<string, number>()
        const bySource = new Map<string, Map<string, number>>()
        const samples = new Map<string, string[]>()
        for (const j of jobs) {
          const read = readRemoteScope(j.descriptionHtml)
          const stored = storedScope(j)
          const bucket = compareScope(stored, read)
          const head = bucket.split(':')[0]
          buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
          const s = bySource.get(j.source) ?? new Map<string, number>()
          s.set(head, (s.get(head) ?? 0) + 1)
          bySource.set(j.source, s)
          if (read && (head === 'NEW' || head === 'CONFLICT')) {
            const list = samples.get(head) ?? []
            if (list.length < 40) {
              list.push(
                `- ${bucket} | ${j.source} | "${(j.locationRaw ?? '').slice(0, 40)}" | ${j.title.slice(0, 45)} | "${read.quote.replace(/\s+/g, ' ').slice(0, 200)}"`,
              )
              samples.set(head, list)
            }
          }
        }
        out.push(`${jobs.length} live remote jobs read.`, '', '| result | jobs |', '| --- | --- |')
        for (const [k, n] of [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) out.push(`| ${k} | ${n} |`)
        out.push('', '### By source', '', '| source | agree | NEW | CONFLICT | info | nothing clear |', '| --- | --- | --- | --- | --- | --- |')
        for (const [source, m] of bySource) {
          out.push(`| ${source} | ${m.get('agree') ?? 0} | ${m.get('NEW') ?? 0} | ${m.get('CONFLICT') ?? 0} | ${m.get('info') ?? 0} | ${m.get('description says nothing clear') ?? 0} |`)
        }
        for (const head of ['CONFLICT', 'NEW']) {
          out.push('', `### ${head} examples (review for wrong readings)`, '', ...(samples.get(head) ?? ['(none)']))
        }
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
