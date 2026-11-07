// lib/scrapers/freehire.ts
// Pulls six-figure jobs from the freehire.me public API (https://freehire.me/docs/api) for the
// US (any location, USD), UK, EU, Canada, Australia and Switzerland (CHF). The minimum salary per currency comes from
// lib/currency/thresholds.ts. Auth is optional: set FREEHIRE_API_KEY for the higher account limit.
import axios from 'axios'

import { getHighSalaryThresholdAnnual } from '../currency/thresholds'
import { ingestBoardJob, type BoardJobInput } from '../jobs/ingestBoardJob'
import { normalizePublicCompanyWebsite } from '../companies/website'
import { repairCompanyName } from '../companies/repairCompanyName'
import { getMinimumSalaryRejection } from '../jobs/salaryPublicationGate'
import { addBoardIngestResult, type ScraperStats } from './scraperStats'

const BOARD = 'freehire'
// The /agent/ variant takes the same filters and returns the same jobs, but each carries its description in full.
// Plain /jobs/search only returns a preview cut at ~1,000 characters (the qualifications never reached our pages).
const API_URL = 'https://freehire.me/api/v1/agent/jobs/search'
const PAGE_SIZE = 100
/** Oldest a posting may be and still be listed, when freehire has not flagged it as a re-stamped old job. */
export const MAX_LISTED_AGE_DAYS = 30
// freehire refuses offset + limit > 10000, so one query can reach at most this many newest jobs.
const MAX_OFFSET = 10_000
const LOOKBACK_DAYS = Number(process.env.FREEHIRE_LOOKBACK_DAYS) || 30
// Public limit is 120 requests/minute without a key; stay well under it.
const PAGE_DELAY_MS = 700

/** One query per currency. `geo` narrows by freehire's region/country facets (unset = anywhere). */
export const FREEHIRE_MARKETS: ReadonlyArray<{ currency: string; geo: Record<string, string> }> = [
  { currency: 'USD', geo: {} },
  { currency: 'GBP', geo: { regions: 'uk' } },
  { currency: 'EUR', geo: { regions: 'eu' } },
  { currency: 'CAD', geo: { countries: 'ca' } },
  { currency: 'AUD', geo: { countries: 'au' } },
  // Swiss-franc jobs are Swiss; freehire has no region facet for them. ~96 listable jobs in a 30-day sample (2026-11-07).
  { currency: 'CHF', geo: {} },
]

export type FreehireJob = {
  public_slug: string
  external_id?: string | null
  url: string
  title: string
  company?: string | null
  company_slug?: string | null
  location?: string | null
  description?: string | null
  work_mode?: string | null
  posted_at?: string | null
  updated_at?: string | null
  closed_at?: string | null
  /** Skill / technology slugs, e.g. ['python', 'react', 'terraform']. */
  skills?: string[] | null
  /** freehire's own freshness verdict; `stale`/`fake_freshness` are old postings with a bumped date. */
  reality?: { class?: string | null; age_days?: number | null; fake_freshness?: boolean | null } | null
  enrichment?: {
    employment_type?: string | null
    salary_min?: number | null
    salary_max?: number | null
    salary_currency?: string | null
    salary_period?: string | null
    visa_sponsorship?: boolean | null
  } | null
}

type FreehireResponse = {
  data: FreehireJob[]
  meta: { total: number; limit: number; offset: number; ignored_params?: unknown }
}

export type FreehireMarketReport = {
  currency: string
  available: number
  fetched: number
  mappable: number
  gateRejected: number
  oldest: string | null
  newest: string | null
  sample: string[]
  /** True only if paging ended because the window (or the result list) was exhausted, not because a cap was hit or a request failed. */
  complete: boolean
}

export type FreehireSyncOptions = {
  /** Fetch and map, but write nothing. */
  dryRun?: boolean
  /** Stop each market after this many pages (default: until lookback or freehire's paging cap). */
  maxPagesPerMarket?: number
  /** Only jobs posted at or after this moment (default: now minus FREEHIRE_LOOKBACK_DAYS). */
  since?: Date
}

/** freehire tags outbound links with utm_source=freehire.me; drop only that tag. */
export function stripFreehireUtm(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.searchParams.get('utm_source') === 'freehire.me') {
      parsed.searchParams.delete('utm_source')
    }
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * freehire answers 200 and silently ignores filters it does not know. If our salary filter is
 * ignored the response is the whole catalogue, so refuse to ingest it.
 */
export function assertFiltersApplied(meta: FreehireResponse['meta']): void {
  if (meta.ignored_params) {
    throw new Error(`freehire ignored request params: ${JSON.stringify(meta.ignored_params)}`)
  }
}

/** Clean freehire's skill list: lowercase slugs, de-duplicated, at most 12, junk (empty / very long) dropped. */
export function normalizeFreehireSkills(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const skill = item.trim().toLowerCase()
    if (skill.length < 2 || skill.length > 40 || out.includes(skill)) continue
    out.push(skill)
    if (out.length === 12) break
  }
  return out
}

/**
 * Whether freehire's `reality` verdict allows listing a job. Bulk refreshes re-stamp old postings with a new
 * posted_at, so we trust this verdict, not the date. `fresh` means up to 14 days old; `stale` also covers ordinary
 * 15-60 day old postings that are still open (measured on 300 live USD jobs on 2026-11-05: 30 were 15-30 days old
 * and not flagged), while the re-stamped ones carry `fake_freshness` (91-146 days old). So: never a flagged job, and
 * `stale` only while it is within MAX_LISTED_AGE_DAYS. No verdict at all keeps the job.
 */
export function isListableByReality(reality: FreehireJob['reality']): boolean {
  if (!reality) return true
  if (reality.fake_freshness) return false
  if (reality.class === 'fresh') return true
  return reality.class === 'stale' && typeof reality.age_days === 'number' && reality.age_days <= MAX_LISTED_AGE_DAYS
}

/** Map a freehire record to the board ingest input, or null if it must not be published. */
export function mapFreehireJob(job: FreehireJob): BoardJobInput | null {
  const e = job.enrichment ?? {}
  if (job.closed_at) return null
  if (!isListableByReality(job.reality)) return null
  if (e.salary_period !== 'year') return null
  const currency = e.salary_currency?.toUpperCase()
  if (!currency || !FREEHIRE_MARKETS.some((m) => m.currency === currency)) return null
  const threshold = getHighSalaryThresholdAnnual(currency)
  if (threshold == null || typeof e.salary_min !== 'number' || e.salary_min < threshold) return null
  if (!job.title || !job.url) return null

  const url = stripFreehireUtm(job.url)
  // freehire sometimes has an ATS identifier where the employer's name should be (Amplitude's Ashby jobs came as
  // "9c26369c-d400-4eb7-a9b3-ab8f6469f9e8"). Recover the real name; a name that is only an id and cannot be recovered
  // means the job is skipped rather than published under an id.
  const given = (job.company ?? '').trim()
  const companyName = repairCompanyName({ name: given, applyUrl: url, descriptionHtml: job.description })
  if (given && !companyName) return null
  const repaired = companyName !== given
  return {
    externalId: job.external_id || job.public_slug,
    title: job.title,
    url,
    applyUrl: url,
    rawCompanyName: companyName,
    // The slug is only used to look the company's website up at freehire; an id-named company has none to find.
    companyRef: repaired ? null : job.company_slug || null,
    locationText: job.location ?? null,
    isRemote: job.work_mode === 'remote',
    employmentType: e.employment_type ?? null,
    salaryMin: e.salary_min,
    salaryMax: e.salary_max ?? null,
    salaryCurrency: currency,
    salaryInterval: 'year',
    postedAt: job.posted_at ? new Date(job.posted_at) : null,
    updatedAt: job.updated_at ? new Date(job.updated_at) : null,
    descriptionHtml: job.description ?? null,
    sourceRef: job.public_slug || null,
    skills: normalizeFreehireSkills(job.skills),
    visaSponsorship: e.visa_sponsorship === true,
  }
}

/** Request headers for the freehire API (the key is optional; it only raises the rate limit). */
export function freehireHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': '6FigJobs/1.0 (+https://www.6figjobs.com)' }
  if (process.env.FREEHIRE_API_KEY) headers.Authorization = `Bearer ${process.env.FREEHIRE_API_KEY}`
  return headers
}

async function fetchPage(market: (typeof FREEHIRE_MARKETS)[number], offset: number): Promise<FreehireResponse> {
  const res = await axios.get<FreehireResponse>(API_URL, {
    headers: freehireHeaders(),
    timeout: 30_000,
    params: {
      salary_currency: market.currency,
      salary_period: 'year',
      salary_min: getHighSalaryThresholdAnnual(market.currency),
      sort: 'posted_at',
      order: 'desc',
      limit: PAGE_SIZE,
      offset,
      ...market.geo,
    },
  })
  return res.data
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Longest rate-limit wait we will sit through. Anything longer means the quota is used up, not a short burst limit. */
export const MAX_RATE_LIMIT_WAIT_S = 120

/**
 * What to do with a 429: wait the (short) time freehire asks for, or give up when it asks for longer than
 * `capSeconds`. On 2026-11-05 freehire answered a sync with Retry-After 49611 (about 13.8 hours); the old code slept
 * through all of it, so the job sat idle until the 45-minute job timeout killed it.
 */
export function decideRateLimitWait(
  retryAfter: unknown,
  capSeconds: number = MAX_RATE_LIMIT_WAIT_S,
): { action: 'wait' | 'give-up'; seconds: number } {
  const n = Number(retryAfter)
  const seconds = Number.isFinite(n) && n >= 0 && retryAfter !== null && retryAfter !== undefined && retryAfter !== '' ? n : 20
  return { action: seconds > capSeconds ? 'give-up' : 'wait', seconds }
}

/** fetchPage that waits out short 429 rate limits (Retry-After) and fails fast, with a clear message, on a long one. */
async function fetchPageWithRetry(market: (typeof FREEHIRE_MARKETS)[number], offset: number): Promise<FreehireResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchPage(market, offset)
    } catch (error) {
      const response = (error as { response?: { status?: number; headers?: Record<string, string> } }).response
      if (response?.status === 429) {
        const h = response.headers ?? {}
        const decision = decideRateLimitWait(h['retry-after'])
        console.warn(
          `[freehire] 429 rate limited: retry-after=${h['retry-after'] ?? '-'} limit=${h['x-ratelimit-limit'] ?? '-'} remaining=${h['x-ratelimit-remaining'] ?? '-'} reset=${h['x-ratelimit-reset'] ?? '-'} (attempt ${attempt + 1})`,
        )
        if (decision.action === 'give-up') {
          throw new Error(
            `freehire rate limit: asked to wait ${decision.seconds}s (about ${Math.round(decision.seconds / 3600)}h), longer than the ${MAX_RATE_LIMIT_WAIT_S}s we will wait. The API key's quota looks used up: check its plan and usage with freehire.`,
          )
        }
        if (attempt < 4) {
          await sleep(decision.seconds * 1000)
          continue
        }
      }
      throw error
    }
  }
}

export type FreehireCollected = {
  inputs: BoardJobInput[]
  markets: FreehireMarketReport[]
  /** Per-market failures. Non-empty means the collection is incomplete. */
  errors: string[]
  /** Records fetched in the window that were not publishable (closed, stale, wrong currency, below threshold). */
  unmappable: number
}

/** Fetch and map every market without writing anything. */
export async function collectFreehireJobs(options: FreehireSyncOptions = {}): Promise<FreehireCollected> {
  const inputs = new Map<string, BoardJobInput>() // paging over posted_at ties can repeat rows
  const markets: FreehireMarketReport[] = []
  const errors: string[] = []
  let unmappable = 0
  const cutoff = options.since?.getTime() ?? Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000

  for (const market of FREEHIRE_MARKETS) {
    const report: FreehireMarketReport = {
      currency: market.currency,
      available: 0,
      fetched: 0,
      mappable: 0,
      gateRejected: 0,
      oldest: null,
      newest: null,
      sample: [],
      complete: false,
    }
    markets.push(report)

    try {
      // Newest first. posted_at ties and bulk refreshes leave the order slightly uneven, so stop only
      // after two consecutive pages made up entirely of jobs older than the window.
      let pages = 0
      let oldPages = 0
      for (let offset = 0; offset < MAX_OFFSET; offset += PAGE_SIZE) {
        if (options.maxPagesPerMarket && pages >= options.maxPagesPerMarket) break
        const page = await fetchPageWithRetry(market, offset)
        assertFiltersApplied(page.meta)
        report.available = page.meta.total
        pages++
        if (page.data.length === 0) {
          report.complete = true
          break
        }

        let oldOnPage = 0
        for (const job of page.data) {
          if (job.posted_at && new Date(job.posted_at).getTime() < cutoff) {
            oldOnPage++
            continue
          }
          report.fetched++
          if (job.posted_at) {
            report.newest = report.newest && report.newest > job.posted_at ? report.newest : job.posted_at
            report.oldest = report.oldest && report.oldest < job.posted_at ? report.oldest : job.posted_at
          }

          const input = mapFreehireJob(job)
          if (!input) {
            unmappable++
            continue
          }
          report.mappable++
          if (report.sample.length < 3) report.sample.push(`${input.title} — ${input.rawCompanyName}`)
          // Mirror the ingest salary gate so the report shows what would really be published.
          if (getMinimumSalaryRejection({ salaryMin: input.salaryMin, salaryCurrency: input.salaryCurrency })) {
            report.gateRejected++
          }
          inputs.set(input.externalId, input)
        }

        oldPages = oldOnPage === page.data.length ? oldPages + 1 : 0
        if (oldPages >= 2 || page.data.length < PAGE_SIZE) {
          report.complete = true
          break
        }
        await sleep(PAGE_DELAY_MS)
      }
    } catch (error) {
      console.error(`[freehire] ❌ ${market.currency} fetch failed:`, error)
      errors.push(`${market.currency}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { inputs: [...inputs.values()], markets, errors, unmappable }
}

const COMPANY_URL = 'https://freehire.me/api/v1/companies'

/**
 * freehire's company records carry the employer's website for roughly a third of companies (the job records carry no
 * company website at all). Returns slug -> website for the ones that have a real company site; a company that is not
 * found, has none, or whose lookup fails is simply absent, so ingestion never depends on it. Paced (3 workers) and
 * honours Retry-After on 429.
 */
export async function loadFreehireCompanyWebsites(
  slugs: string[],
  fetchFn: typeof fetch = fetch,
  pauseMs = 150,
  budgetMs = 4 * 60_000,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  // Overall time budget: this is a nice-to-have, so when freehire is slow or rate-limiting we stop looking up more
  // companies (the rest keep their name-based logo) instead of holding up the job ingest behind it.
  const deadline = Date.now() + budgetMs
  let rateLimited = false // a long 429 means freehire is refusing us: stop asking, for every worker
  const queue = [...new Set(slugs.filter(Boolean))]
  async function lookup(slug: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetchFn(`${COMPANY_URL}/${encodeURIComponent(slug)}`, {
          headers: freehireHeaders(),
          signal: AbortSignal.timeout(15_000),
        })
        if (res.status === 429) {
          const decision = decideRateLimitWait(res.headers.get('retry-after'), 30)
          if (decision.action === 'give-up') {
            rateLimited = true
            return
          }
          await sleep(decision.seconds * 1000)
          continue
        }
        if (!res.ok) return
        const json = (await res.json()) as { data?: { company?: { company_info?: { website?: unknown } | null } } }
        const raw = json?.data?.company?.company_info?.website
        const site = typeof raw === 'string' ? normalizePublicCompanyWebsite(raw) : null
        if (site) out.set(slug, site)
        return
      } catch {
        return
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length > 0 && Date.now() < deadline && !rateLimited) {
        const slug = queue.shift()!
        await lookup(slug)
        if (pauseMs > 0) await sleep(pauseMs)
      }
    }),
  )
  return out
}

/** Write already-collected jobs through the normal board ingest (dedupe, priority, salary gate). */
export async function ingestFreehireJobs(inputs: BoardJobInput[]): Promise<ScraperStats> {
  const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }
  // Give each job its employer's website (when freehire has one) so its logo comes from a real domain, not a name guess.
  try {
    const wanted = [...new Set(inputs.filter((i) => !i.companyWebsiteUrl).map((i) => i.companyRef ?? '').filter(Boolean))]
    const t0 = Date.now()
    const sites = await loadFreehireCompanyWebsites(wanted)
    console.log(`[freehire] company websites: ${sites.size} found for ${wanted.length} companies in ${Math.round((Date.now() - t0) / 1000)}s`)
    for (const input of inputs) {
      const site = input.companyRef ? sites.get(input.companyRef) : undefined
      if (site && !input.companyWebsiteUrl) input.companyWebsiteUrl = site
    }
  } catch (error) {
    console.warn('[freehire] company website lookup skipped:', error instanceof Error ? error.message : error)
  }
  for (const input of inputs) addBoardIngestResult(stats, await ingestBoardJob(BOARD, input))
  return stats
}

export async function syncFreehire(
  options: FreehireSyncOptions = {},
): Promise<{ stats: ScraperStats; markets: FreehireMarketReport[] }> {
  const collected = await collectFreehireJobs(options)
  const stats = options.dryRun ? { created: 0, updated: 0, skipped: 0 } : await ingestFreehireJobs(collected.inputs)
  stats.skipped += collected.unmappable
  if (collected.errors.length > 0) stats.error = collected.errors.join('; ')
  return { stats, markets: collected.markets }
}

export default async function scrapeFreehire(): Promise<ScraperStats> {
  console.log('[freehire] Starting sync...')
  const { stats } = await syncFreehire({ dryRun: process.env.FREEHIRE_DRY_RUN === '1' })
  console.log(`[freehire] ✓ created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`)
  return stats
}
