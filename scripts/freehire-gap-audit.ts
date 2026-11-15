// scripts/freehire-gap-audit.ts
//
// READ-ONLY. What does freehire carry that we do not publish, and why? Reads freehire's newest jobs WITHOUT the salary and
// currency filters our sync sends (so jobs the sync never asks for are visible too), gives each job the first reason
// it would not be published (the same order as mapFreehireJob), then checks which of the publishable ones are not in
// our database. Writes nothing: only freehire GETs and database SELECTs.
//
//   npx tsx scripts/freehire-gap-audit.ts [--pages=20]        (100 jobs per page; needs DATABASE_URL for the database part)
import axios from 'axios'
import { appendFileSync } from 'node:fs'

import { readPayFromDescription } from '../lib/jobs/payEvidence'
import { getMinimumSalaryRejection } from '../lib/jobs/salaryPublicationGate'
import { FREEHIRE_MARKETS, freehireHeaders, isListableByReality, mapFreehireJob, type FreehireJob } from '../lib/scrapers/freehire'

const API_URL = 'https://freehire.me/api/v1/agent/jobs/search'
const PAGE_SIZE = 100
// Hours and days per year as pay rates are usually annualised.
const PERIODS_PER_YEAR: Record<string, number> = { month: 12, week: 52, day: 260, hour: 2080 }

export type GapReason =
  | 'ok'
  | 'closed'
  | 'stale-or-fake-freshness'
  | 'no-salary'
  | 'period-not-year-would-pass'
  | 'period-not-year-below-gate'
  | 'currency-not-queried'
  | 'below-gate'
  | 'unusable-record'

/** The first reason freehire job would not be published, in the order mapFreehireJob checks them. */
export function classifyFreehireJob(job: FreehireJob): { reason: GapReason; detail: string } {
  const e = job.enrichment ?? {}
  if (job.closed_at) return { reason: 'closed', detail: '' }
  if (!isListableByReality(job.reality)) return { reason: 'stale-or-fake-freshness', detail: job.reality?.class ?? '' }
  if (typeof e.salary_min !== 'number') return { reason: 'no-salary', detail: '' }
  const currency = e.salary_currency?.toUpperCase() ?? ''
  const period = e.salary_period ?? ''
  if (period !== 'year') {
    const factor = PERIODS_PER_YEAR[period]
    if (factor && currency && FREEHIRE_MARKETS.some((m) => m.currency === currency)) {
      const rejected = getMinimumSalaryRejection({
        salaryMin: e.salary_min * factor,
        salaryMax: typeof e.salary_max === 'number' ? e.salary_max * factor : null,
        salaryCurrency: currency,
      })
      return { reason: rejected ? 'period-not-year-below-gate' : 'period-not-year-would-pass', detail: `${period} ${currency}` }
    }
    return { reason: 'period-not-year-below-gate', detail: `${period || 'none'} ${currency}`.trim() }
  }
  if (!currency || !FREEHIRE_MARKETS.some((m) => m.currency === currency)) return { reason: 'currency-not-queried', detail: currency || 'none' }
  if (getMinimumSalaryRejection({ salaryMin: e.salary_min, salaryMax: e.salary_max, salaryCurrency: currency })) {
    return { reason: 'below-gate', detail: currency }
  }
  return mapFreehireJob(job) ? { reason: 'ok', detail: '' } : { reason: 'unusable-record', detail: '' }
}

const tally = <T extends string>(items: T[]) => {
  const m = new Map<T, number>()
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

async function main() {
  const pagesArg = process.argv.find((a) => a.startsWith('--pages='))
  const pages = Math.min(100, Math.max(1, Number(pagesArg?.slice(8)) || 20))
  const jobs: FreehireJob[] = []
  let total: number | null = null
  for (let p = 0; p < pages; p++) {
    const res = await axios.get<{ data: FreehireJob[]; meta: { total?: number } }>(API_URL, {
      headers: freehireHeaders(),
      timeout: 30_000,
      params: { sort: 'posted_at', order: 'desc', limit: PAGE_SIZE, offset: p * PAGE_SIZE },
    })
    total = res.data.meta?.total ?? total
    if (!res.data.data.length) break
    jobs.push(...res.data.data)
    await new Promise((r) => setTimeout(r, 700))
  }

  const out: string[] = ['## freehire gap audit (read-only)', '']
  const posted = jobs.map((j) => j.posted_at).filter((v): v is string => !!v).sort()
  out.push(
    `Read ${jobs.length} of freehire's newest jobs with no salary or currency filter (freehire reports ${total ?? 'unknown'} in all). Posted ${posted[0] ?? '?'} to ${posted[posted.length - 1] ?? '?'}.`,
    '',
  )

  const classified = jobs.map((j) => ({ j, ...classifyFreehireJob(j) }))
  out.push('### Why a freehire job is or is not published', '', '| reason | jobs | share |', '| --- | --- | --- |')
  for (const [reason, n] of tally(classified.map((c) => c.reason))) out.push(`| ${reason} | ${n} | ${((100 * n) / jobs.length).toFixed(1)}% |`)
  out.push('')

  for (const [title, reason, note] of [
    ['Pay stated per month, week, day or hour, which would pass the gate if annualised', 'period-not-year-would-pass', 'Our query asks only for yearly pay.'],
    ['A currency our sync does not query', 'currency-not-queried', `The sync queries ${FREEHIRE_MARKETS.map((m) => m.currency).filter((v, i, a) => a.indexOf(v) === i).join(', ')}.`],
    ['Not published because the pay is below the gate', 'below-gate', 'Policy, not a gap.'],
  ] as const) {
    const rows = classified.filter((c) => c.reason === reason)
    if (rows.length === 0) continue
    out.push(`### ${title}`, '', `_${note}_`, '', '| detail | jobs |', '| --- | --- |')
    for (const [d, n] of tally(rows.map((r) => r.detail || '(none)')).slice(0, 12)) out.push(`| ${d} | ${n} |`)
    out.push('', 'Examples:', ...rows.slice(0, 6).map((r) => `- ${r.j.title.slice(0, 70)} — ${(r.j.company ?? '').slice(0, 30)} (${r.detail})`), '')
  }

  const noSalary = classified.filter((c) => c.reason === 'no-salary')
  const read = noSalary
    .map((c) => ({ c, pay: readPayFromDescription(c.j.description, { countries: c.j.countries, location: c.j.location }) }))
    .filter((r) => r.pay)
  const passing = read.filter((r) => !getMinimumSalaryRejection({ salaryMin: r.pay!.min, salaryMax: r.pay!.max, salaryCurrency: r.pay!.currency }))
  out.push(
    "### No pay in freehire's fields: what reading the description gives (lib/jobs/payEvidence.ts)",
    '',
    `${noSalary.length} jobs have no pay in freehire's fields. The description reader found a yearly range in ${read.length} of them, and ${passing.length} of those pass our salary gate. Each line: the range read, then the sentence it came from. Review for wrong readings before this is switched on.`,
    '',
    ...passing.slice(0, 40).map((r) => `- ${r.pay!.currency} ${r.pay!.min}-${r.pay!.max} | ${r.c.j.title.slice(0, 50)} — ${(r.c.j.company ?? '').slice(0, 25)} | "${r.pay!.quote.replace(/\s+/g, ' ').slice(0, 220)}"`),
    '',
    ...(read.length > passing.length
      ? [`Read but below the gate (${read.length - passing.length}):`, ...read.filter((r) => !passing.includes(r)).slice(0, 8).map((r) => `- ${r.pay!.currency} ${r.pay!.min}-${r.pay!.max} | ${r.c.j.title.slice(0, 50)}`), '']
      : []),
  )

  const ok = classified.filter((c) => c.reason === 'ok').map((c) => c.j)
  out.push('### Publishable by our rules: do we have them?', '')
  if (!process.env.DATABASE_URL) {
    out.push('No DATABASE_URL: this part skipped.')
  } else {
    const { prisma } = await import('../lib/prisma')
    try {
      const ids = ok.map((j) => j.external_id || j.public_slug)
      const rows = await prisma.job.findMany({
        where: { source: 'board:freehire', externalId: { in: ids } },
        select: { externalId: true, isExpired: true },
      })
      const have = new Map(rows.map((r) => [r.externalId, r.isExpired]))
      const live = ok.filter((j) => have.get(j.external_id || j.public_slug) === false).length
      const expired = ok.filter((j) => have.get(j.external_id || j.public_slug) === true).length
      const absent = ok.filter((j) => !have.has(j.external_id || j.public_slug))
      // A job posted in the last three hours has simply not been synced yet; one posted earlier may be held under another
      // source's copy of the same posting (same title and company, live), which is not a gap either.
      const THREE_HOURS = 3 * 60 * 60 * 1000
      const tooNew = absent.filter((j) => j.posted_at && Date.now() - new Date(j.posted_at).getTime() < THREE_HOURS)
      const older = absent.filter((j) => !tooNew.includes(j))
      const missing: FreehireJob[] = []
      let heldElsewhere = 0
      for (const j of older) {
        const held = await prisma.job.count({
          where: { isExpired: false, title: j.title, company: { equals: j.company ?? '', mode: 'insensitive' } },
        })
        if (held > 0) heldElsewhere++
        else missing.push(j)
      }
      out.push(
        `${ok.length} publishable by our rules: ${live} live in our database under freehire's id, ${expired} there but expired, ${absent.length} not stored under freehire's id: ${tooNew.length} posted in the last three hours (not synced yet), ${heldElsewhere} held live under another source's copy of the same job, **${missing.length} not in our database at all**.`,
        '',
        ...missing.slice(0, 20).map((j) => `- ${j.title.slice(0, 70)} — ${(j.company ?? '').slice(0, 30)} (posted ${j.posted_at?.slice(0, 16) ?? '?'})`),
      )
    } finally {
      await prisma.$disconnect()
    }
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
