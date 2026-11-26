// scripts/probeDirectLinks.ts
//
// READ-ONLY PROBE (no database writes). Owner's question, 2026-11-26: for freehire jobs whose apply link goes to a job
// board, can the employer's own link (their site or applicant tracking system) be found, keeping the board link only
// when none exists? For a sample of listed jobs per board site it tries two ways and reports how often each finds one:
//   A. freehire: the job's own `source_url`, and its copies from other sources (GET /jobs/{slug}/copies, each read with
//      GET /data/jobs/{slug}) — freehire links one posting's copies from different sources.
//   B. the board's page: where its redirect ends, or a link on the page to an applicant tracking system or to the
//      company's own website. Not tried for LinkedIn and XING, whose terms forbid automated access.
// Database: SELECTs in a READ ONLY transaction. freehire: one request at a time, at least 300 ms apart (the API plan
// allows 1,200 a minute). Board pages: one at a time, at least 1.5 s apart.
//
//   npx tsx scripts/probeDirectLinks.ts [--limit=12]   (jobs per board site)
import { appendFileSync } from 'node:fs'

import { applySiteOf, isAggregatorApplyUrl, isJobBoardApplyUrl } from '../lib/jobs/applyUrl'
import { buildWhere } from '../lib/jobs/queryJobs'
import { detectAtsFromUrl } from '../lib/normalizers/ats'
import { freehireHeaders } from '../lib/scrapers/freehire'

const NO_PAGE_FETCH = new Set(['linkedin.com', 'xing.com'])
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let lastFreehire = 0
async function freehireJson(path: string): Promise<any | null> {
  const wait = lastFreehire + 300 - Date.now()
  if (wait > 0) await sleep(wait)
  lastFreehire = Date.now()
  try {
    const res = await fetch(`https://freehire.me/api/v1${path}`, { headers: freehireHeaders(), signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** A link that is the employer's own: an applicant tracking system, or the company's website domain. */
function isDirect(url: string | null | undefined, companySite: string | null): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false
  if (isJobBoardApplyUrl(url) || isAggregatorApplyUrl(url) || /freehire\.me/i.test(url)) return false
  if (detectAtsFromUrl(url)) return true
  return Boolean(companySite && applySiteOf(url) === companySite)
}

async function viaFreehire(slug: string, companySite: string | null): Promise<string | null> {
  const own = (await freehireJson(`/data/jobs/${encodeURIComponent(slug)}`))?.data
  if (isDirect(own?.source_url, companySite)) return own.source_url
  const copies = (await freehireJson(`/jobs/${encodeURIComponent(slug)}/copies`))?.data ?? []
  for (const c of copies.slice(0, 6)) {
    if (!c?.public_slug || c.public_slug === slug) continue
    const d = (await freehireJson(`/data/jobs/${encodeURIComponent(c.public_slug)}`))?.data
    for (const u of [d?.url, d?.source_url]) if (isDirect(u, companySite)) return u
  }
  return null
}

let lastPage = 0
async function viaPage(url: string, companySite: string | null): Promise<string | null> {
  const wait = lastPage + 1500 - Date.now()
  if (wait > 0) await sleep(wait)
  lastPage = Date.now()
  try {
    const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
    if (isDirect(res.url, companySite)) return res.url
    if (!res.ok) return null
    const html = (await res.text()).replace(/&amp;/g, '&').replace(/\\\//g, '/')
    for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)) if (isDirect(m[0], companySite)) return m[0]
    return null
  } catch {
    return null
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8)) || 12
  const { prisma } = await import('../lib/prisma')
  let rows: Array<{ applyUrl: string | null; sourceRef: string | null; company: { website: string | null } | null }> = []
  try {
    rows = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        return tx.job.findMany({
          where: { AND: [buildWhere({}), { source: 'board:freehire' }] },
          select: { applyUrl: true, sourceRef: true, company: { select: { website: true } } },
        })
      },
      { timeout: 120_000 },
    )
  } finally {
    await prisma.$disconnect()
  }

  const bySite = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!r.sourceRef || !isJobBoardApplyUrl(r.applyUrl)) continue
    const site = applySiteOf(r.applyUrl)!
    bySite.set(site, [...(bySite.get(site) ?? []), r])
  }
  const sites = [...bySite.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12)
  const out = ['## Employer links for job-board jobs (read-only probe)', '', `${limit} random listed jobs per board site (the 12 biggest).`, '']
  out.push('| board site | listed | sampled | A: via freehire | B: via the board page | either |', '|---|---|---|---|---|---|')
  const examples: string[] = []
  for (const [site, list] of sites) {
    const sample = [...list].sort(() => Math.random() - 0.5).slice(0, limit)
    let a = 0
    let b = 0
    let either = 0
    for (const r of sample) {
      const companySite = applySiteOf(r.company?.website)
      const fa = await viaFreehire(r.sourceRef!, companySite)
      const fb = fa || NO_PAGE_FETCH.has(site) ? null : await viaPage(r.applyUrl!, companySite)
      if (fa) a++
      if (fb) b++
      if (fa || fb) either++
      if ((fa || fb) && examples.length < 25) examples.push(`- ${site}: ${r.applyUrl} → ${fa ?? fb} (${fa ? 'A' : 'B'})`)
    }
    out.push(`| ${site} | ${list.length} | ${sample.length} | ${a} | ${NO_PAGE_FETCH.has(site) ? 'not tried' : b} | ${either} |`)
  }
  out.push('', 'B is tried only where A found nothing, so B counts only extra finds.', '', '### Examples', '', ...examples)
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
