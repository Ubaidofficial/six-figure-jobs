// lib/scrapers/worldwideBoards.ts
//
// Worldwide-remote jobs from two remote-first boards freehire barely carries (2026-11-10: freehire had 54 We Work
// Remotely and 3,318 Himalayas jobs, none of them tagged worldwide at $100k+):
//   - We Work Remotely: its RSS feeds (the main feed and the category feeds), items whose region is "Anywhere in the
//     World". Its pages sit behind a bot check; the feeds do not.
//   - Himalayas: its public search API with `worldwide=true` (812 jobs on 2026-11-10, about 23 at $100k+ a year).
// Both go through the normal board ingest, so the salary gate decides what is published.
//
// A board's "anywhere" label is not believed on its own: of 10 We Work Remotely jobs labelled "Anywhere in the World"
// at $100k+, 4 said US-only in the text ("only considering candidates located in ... the United States"). A job counts
// as worldwide on the site only when its description names no place or time zone that limits it; otherwise it is
// imported as a remote job in the place it names (or plain "Remote").
//
// Neither board gives the employer's own apply link, so these jobs apply on the board (lib/jobs/applyUrl.ts,
// OWN_BOARD_APPLY_HOSTS; the owner's choice, 2026-11-10).

import { ingestBoardJob, type BoardJobInput } from '../jobs/ingestBoardJob'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'

const UA = '6FigJobs/1.0 (+https://www.6figjobs.com)'

// ----------------------------------------------------------------------------------------------------------------
// Where a remote job can be done from, read from its description
// ----------------------------------------------------------------------------------------------------------------

const US_LIMIT =
  /\b(?:u\.?s\.?|usa|united states)[- ]?(?:only|based|residents?)\b|\b(?:located|based|reside|residing|live|living) (?:in|within) the (?:u\.?s\.?|united states|us)\b|\b(?:eligible|authori[sz]ed) to work in the (?:u\.?s\.?|united states)\b|\bremote (?:with)?in the (?:u\.?s\.?|united states|us)\b|\banywhere in the (?:u\.?s\.?|united states|us)\b|\bremote applicants in the (?:u\.?s\.?|us)\b|\bfully remote \((?:u\.?s\.?|us)[- ]based\)/i
const OTHER_LIMIT =
  /\b(?:canada|uk|united kingdom|europe|eu|emea|latam|latin america|apac|north america|americas)[- ]?(?:only|based|residents?)\b|\b(?:located|based|reside|residing|live|living) (?:in|within) (?:canada|the uk|europe|the eu|north america|latin america)\b|\btime ?zones? (?:between|from|of|within)\b|\b(?:utc|gmt|cet|est|pst|cst|et|pt)\s?[±+-]\s?\d|\b(?:est|pst|cst|cet)\b(?: or \w+)? (?:hours|business hours|time ?zone)/i

// We Work Remotely descriptions open with "Headquarters: ...", which holds the job's location from the employer's careers
// system, not the head office: "Remote - USA", "San Francisco, CA or Remote, US", "Remote - Canada" (Lattice, whose head
// office is San Francisco). 126 of 128 WWR jobs labelled "Anywhere in the World" at $100k+ had such a line or another
// place or time zone in the text (2026-11-10).
// The whole line (tags become line breaks): a list of states can run past 300 characters.
const HQ_LINE = /headquarters:\s*([^<\n]{1,400})/i
const US_WORDS = /\b(?:us|usa|u\.s\.?(?:a\.?)?|united states|america|amer)\b/i
const US_STATE_CODE = /,\s*[A-Z]{2}\b/
// Words that say nothing about where: what is left after removing them is a place ("Remote - Canada" -> "Canada").
const NOT_A_PLACE = /\b(?:remote|worldwide|anywhere|global|globally|fully|100%|work from home|wfh|or)\b|[-–—,;:()/|]/gi
// A region in the job title: "Enterprise Account Executive - California", "Salesforce Lead - USA", "Director, West".
const TITLE_PLACE =
  /\b(?:usa|u\.s\.?|us|united states|canada|emea|apac|latam|europe|uk|americas|north america|amer|west|east|central|midwest|northeast|southeast|northwest|southwest|california|new york|texas)\b/i

/** Where a "work from anywhere" posting says it can really be done: 'US', somewhere else named, or nowhere. */
export function workplaceLimit(text: string | null | undefined, title?: string | null): 'US' | 'other' | null {
  const raw = String(text ?? '').replace(/&nbsp;/g, ' ')
  const hq = HQ_LINE.exec(raw.replace(/<[^>]+>/g, '\n'))?.[1]?.trim()
  if (hq && hq.replace(NOT_A_PLACE, ' ').trim()) return US_WORDS.test(hq) || US_STATE_CODE.test(hq) ? 'US' : 'other'
  const t = raw.replace(/<[^>]+>/g, ' ')
  if (US_LIMIT.test(t)) return 'US'
  if (OTHER_LIMIT.test(t)) return 'other'
  const titlePlace = TITLE_PLACE.exec(String(title ?? ''))
  if (titlePlace) return US_WORDS.test(titlePlace[0]) ? 'US' : 'other'
  return null
}

/** Location text our parser reads: worldwide only when nothing limits it. */
export function worldwideLocationText(description: string | null | undefined, title?: string | null): string {
  const limit = workplaceLimit(description, title)
  return limit === 'US' ? 'Remote - United States' : limit === 'other' ? 'Remote' : 'Remote - Worldwide'
}

// ----------------------------------------------------------------------------------------------------------------
// We Work Remotely (RSS)
// ----------------------------------------------------------------------------------------------------------------

export const WWR_FEEDS = [
  'remote-jobs',
  'categories/remote-programming-jobs',
  'categories/remote-full-stack-programming-jobs',
  'categories/remote-back-end-programming-jobs',
  'categories/remote-front-end-programming-jobs',
  'categories/remote-devops-sysadmin-jobs',
  'categories/remote-design-jobs',
  'categories/remote-product-jobs',
  'categories/remote-sales-and-marketing-jobs',
  'categories/remote-management-and-finance-jobs',
  'categories/remote-customer-support-jobs',
  'categories/all-other-remote-jobs',
].map((path) => `https://weworkremotely.com/${path}.rss`)

const decodeXml = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()

function xmlTag(item: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(item)
  return m ? decodeXml(m[1]) : ''
}

const AMOUNT = String.raw`\$\s?(\d{2,3}(?:,\d{3})|\d{2,3}(?:\.\d)?\s?[kK])`
const RANGE = new RegExp(`${AMOUNT}\\s?(?:-|–|—|to)\\s?(?:USD\\s?)?${AMOUNT}`)
const SINGLE = new RegExp(AMOUNT)

function toAmount(raw: string): number {
  const s = raw.replace(/\s/g, '')
  return /k$/i.test(s) ? Math.round(parseFloat(s) * 1000) : Number(s.replace(/,/g, ''))
}

/** A yearly USD range from posting text ("$180,000 - $220,000", "$150k–$190k"); null when none is stated. */
export function salaryFromText(text: string | null | undefined): { min: number; max: number } | null {
  const t = String(text ?? '').replace(/<[^>]+>/g, ' ')
  const range = RANGE.exec(t)
  const [min, max] = range ? [toAmount(range[1]), toAmount(range[2])] : (() => {
    const one = SINGLE.exec(t)
    const v = one ? toAmount(one[1]) : 0
    return [v, v]
  })()
  // Bonuses, stipends and hourly rates are not salaries.
  if (!(min >= 20_000 && max >= min && max <= 2_000_000)) return null
  return { min, max }
}

/** One RSS item as a board job, or null when it is not labelled "Anywhere in the World" or lacks what we need. */
export function mapWwrItem(item: string): BoardJobInput | null {
  if (!/anywhere in the world/i.test(xmlTag(item, 'region'))) return null
  const link = xmlTag(item, 'link')
  const full = xmlTag(item, 'title') // "Company: Job title"
  const idx = full.indexOf(': ')
  if (!link || idx < 1) return null
  const description = xmlTag(item, 'description')
  const pay = salaryFromText(description)
  const pub = xmlTag(item, 'pubDate')
  return {
    externalId: link.replace(/\/+$/, '').split('/').pop() || link,
    title: full.slice(idx + 2).trim(),
    rawCompanyName: full.slice(0, idx).trim(),
    url: link,
    applyUrl: link,
    locationText: worldwideLocationText(description, full.slice(idx + 2)),
    isRemote: true,
    salaryMin: pay?.min ?? null,
    salaryMax: pay?.max ?? null,
    salaryCurrency: pay ? 'USD' : null,
    salaryInterval: 'year',
    postedAt: pub ? new Date(pub) : null,
    descriptionHtml: description || null,
    sourceRef: link,
  }
}

export async function fetchWwrJobs(fetchImpl: typeof fetch = fetch): Promise<BoardJobInput[]> {
  const byId = new Map<string, BoardJobInput>()
  for (const feed of WWR_FEEDS) {
    const res = await fetchImpl(feed, { headers: { 'User-Agent': UA, accept: 'application/rss+xml' }, cache: 'no-store' })
    if (!res.ok) throw new Error(`We Work Remotely feed ${res.status}: ${feed}`)
    for (const item of (await res.text()).split('<item>').slice(1)) {
      const job = mapWwrItem(item.split('</item>')[0])
      if (job) byId.set(job.externalId, job)
    }
  }
  return [...byId.values()]
}

// ----------------------------------------------------------------------------------------------------------------
// Himalayas (search API, worldwide only)
// ----------------------------------------------------------------------------------------------------------------

export type HimalayasJob = {
  guid: string
  title: string
  companyName: string
  companyLogo?: string | null
  applicationLink: string
  description?: string | null
  locationRestrictions?: string[] | null
  minSalary?: number | null
  maxSalary?: number | null
  currency?: string | null
  salaryPeriod?: string | null
  pubDate?: number | null
}

const HIMALAYAS_API = 'https://himalayas.app/jobs/api/search?worldwide=true&limit=20'
const HIMALAYAS_MAX_PAGES = 80 // 812 worldwide jobs on 2026-11-10 fill 41 pages

/** One worldwide Himalayas job as a board job; null when it is not unrestricted or its pay is not yearly. */
export function mapHimalayasJob(job: HimalayasJob): BoardJobInput | null {
  if ((job.locationRestrictions ?? []).length > 0) return null
  if (!job.title || !job.companyName || !job.applicationLink) return null
  const yearly = job.salaryPeriod === 'annual'
  return {
    externalId: job.guid || job.applicationLink,
    title: job.title.trim(),
    rawCompanyName: job.companyName.trim(),
    url: job.applicationLink,
    applyUrl: job.applicationLink,
    locationText: worldwideLocationText(job.description, job.title),
    isRemote: true,
    salaryMin: yearly ? (job.minSalary ?? null) : null,
    salaryMax: yearly ? (job.maxSalary ?? null) : null,
    salaryCurrency: yearly ? (job.currency ?? null) : null,
    salaryInterval: 'year',
    postedAt: job.pubDate ? new Date(job.pubDate * 1000) : null,
    descriptionHtml: job.description ?? null,
    sourceRef: job.applicationLink,
  }
}

export async function fetchHimalayasJobs(
  fetchImpl: typeof fetch = fetch,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<BoardJobInput[]> {
  const out: BoardJobInput[] = []
  for (let page = 1; page <= HIMALAYAS_MAX_PAGES; page++) {
    const res = await fetchImpl(`${HIMALAYAS_API}&page=${page}`, { headers: { 'User-Agent': UA, accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) throw new Error(`Himalayas API ${res.status} on page ${page}`)
    const jobs = ((await res.json()) as { jobs?: HimalayasJob[] }).jobs ?? []
    if (jobs.length === 0) break
    for (const j of jobs) {
      const mapped = mapHimalayasJob(j)
      if (mapped) out.push(mapped)
    }
    await pause(600)
  }
  return out
}

// ----------------------------------------------------------------------------------------------------------------
// Sync
// ----------------------------------------------------------------------------------------------------------------

export async function syncWorldwideBoards(opts: { dryRun?: boolean } = {}): Promise<Record<string, ScraperStats>> {
  const out: Record<string, ScraperStats> = {}
  const boards: Array<[string, () => Promise<BoardJobInput[]>]> = [
    ['weworkremotely', () => fetchWwrJobs()],
    ['himalayas', () => fetchHimalayasJobs()],
  ]
  for (const [board, fetchJobs] of boards) {
    try {
      const jobs = await fetchJobs()
      const withPay = jobs.filter((j) => j.salaryMax != null)
      const worldwide = jobs.filter((j) => j.locationText === 'Remote - Worldwide')
      console.log(`[${board}] ${jobs.length} worldwide-labelled jobs, ${withPay.length} with yearly pay, ${worldwide.length} with no limit in the text`)
      const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }
      if (opts.dryRun) {
        for (const j of withPay.slice(0, 5)) console.log(`    e.g. ${j.title} | ${j.rawCompanyName} | ${j.salaryMin}-${j.salaryMax} ${j.salaryCurrency} | ${j.locationText}`)
        out[board] = { ...stats, skipped: jobs.length }
        continue
      }
      for (const job of jobs) addBoardIngestResult(stats, await ingestBoardJob(board, job))
      console.log(`[${board}] created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`)
      out[board] = stats
    } catch (error) {
      console.error(`[${board}] failed:`, error)
      out[board] = errorStats(error)
    }
  }
  return out
}
