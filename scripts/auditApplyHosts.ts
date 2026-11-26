// scripts/auditApplyHosts.ts
//
// READ-ONLY. Where the apply buttons of listed jobs lead, by source and site (the link's domain), and for freehire split
// by when the job was created, to see what freehire's /data/jobs links (read since 2026-11-26, PR #259) brought in.
// Sites on our aggregator list (lib/jobs/applyUrl.ts) are marked. Every statement is a SELECT in a READ ONLY transaction.
//
//   npx tsx scripts/auditApplyHosts.ts [--since=2026-11-26T00:40:00Z]
import { appendFileSync } from 'node:fs'

import { isAggregatorApplyUrl } from '../lib/jobs/applyUrl'
import { buildWhere } from '../lib/jobs/queryJobs'

/** The link's site without "www." and subdomains of common two-part endings kept whole ("jobs.ashbyhq.com" -> "ashbyhq.com"). */
export function siteOf(url: string | null): string {
  if (!url) return '(none)'
  try {
    const host = new URL(url).hostname.toLowerCase()
    const parts = host.split('.')
    const twoPart = /^(co|com|gov|gc|org|ac|net)$/.test(parts[parts.length - 2] ?? '') && parts.length > 2
    return parts.slice(twoPart ? -3 : -2).join('.')
  } catch {
    return '(not a link)'
  }
}

const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)
const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const sinceArg = process.argv.find((a) => a.startsWith('--since='))?.slice(8) ?? '2026-11-26T00:40:00Z'
  const since = new Date(sinceArg)
  const { prisma } = await import('../lib/prisma')
  const out: string[] = ['## Where listed jobs\' apply links lead (read-only)', '']
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        const rows = await tx.job.findMany({ where: buildWhere({}), select: { source: true, applyUrl: true, createdAt: true } })
        const bySource = new Map<string, Map<string, number>>()
        const freehire = { before: new Map<string, number>(), after: new Map<string, number>() }
        const marked = new Map<string, boolean>()
        for (const r of rows) {
          const site = siteOf(r.applyUrl)
          if (r.applyUrl && !marked.has(site)) marked.set(site, isAggregatorApplyUrl(r.applyUrl, null))
          const m = bySource.get(r.source) ?? new Map<string, number>()
          count(m, site)
          bySource.set(r.source, m)
          if (r.source === 'board:freehire') count(r.createdAt >= since ? freehire.after : freehire.before, site)
        }
        const line = ([site, n]: [string, number], total: number) =>
          `- ${site}: ${n} (${Math.round((n / Math.max(total, 1)) * 100)}%)${marked.get(site) ? ' · on our aggregator list' : ''}`
        out.push(`${rows.length} listed jobs.`, '')
        for (const [label, m] of [[`freehire jobs created before ${since.toISOString()}`, freehire.before], [`freehire jobs created since ${since.toISOString()}`, freehire.after]] as const) {
          const total = [...m.values()].reduce((a, b) => a + b, 0)
          out.push(`### ${label}: ${total}`, '', ...top(m, 25).map((e) => line(e, total)), '')
        }
        out.push('### Every source: its five most common sites', '')
        for (const [source, m] of [...bySource.entries()].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))) {
          const total = [...m.values()].reduce((a, b) => a + b, 0)
          out.push(`- ${source} (${total}): ${top(m, 5).map(([s, n]) => `${s} ${n}`).join(', ')}`)
        }
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
