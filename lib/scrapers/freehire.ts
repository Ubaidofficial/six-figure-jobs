// lib/scrapers/freehire.ts
// Pulls six-figure jobs from the freehire.me public API (https://freehire.me/docs/api) for the
// US (any location, USD), UK, EU, Canada and Australia. The minimum salary per currency comes from
// lib/currency/thresholds.ts. Auth is optional: set FREEHIRE_API_KEY for the higher account limit.
import axios from 'axios'

import { getHighSalaryThresholdAnnual } from '../currency/thresholds'
import { ingestBoardJob, type BoardJobInput } from '../jobs/ingestBoardJob'
import { getMinimumSalaryRejection } from '../jobs/salaryPublicationGate'
import { addBoardIngestResult, type ScraperStats } from './scraperStats'

const BOARD = 'freehire'
const API_URL = 'https://freehire.me/api/v1/jobs/search'
const PAGE_SIZE = 100
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
]

export type FreehireJob = {
  public_slug: string
  external_id?: string | null
  url: string
  title: string
  company?: string | null
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

/** Map a freehire record to the board ingest input, or null if it must not be published. */
export function mapFreehireJob(job: FreehireJob): BoardJobInput | null {
  const e = job.enrichment ?? {}
  if (job.closed_at) return null
  // Bulk refreshes re-stamp old postings with a new posted_at; trust freehire's reality check, not the date.
  if (job.reality && (job.reality.class !== 'fresh' || job.reality.fake_freshness)) return null
  if (e.salary_period !== 'year') return null
  const currency = e.salary_currency?.toUpperCase()
  if (!currency || !FREEHIRE_MARKETS.some((m) => m.currency === currency)) return null
  const threshold = getHighSalaryThresholdAnnual(currency)
  if (threshold == null || typeof e.salary_min !== 'number' || e.salary_min < threshold) return null
  if (!job.title || !job.url) return null

  const url = stripFreehireUtm(job.url)
  return {
    externalId: job.external_id || job.public_slug,
    title: job.title,
    url,
    applyUrl: url,
    rawCompanyName: job.company ?? null,
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

/** fetchPage that waits out freehire's 429 rate limit (Retry-After) instead of aborting the market. */
async function fetchPageWithRetry(market: (typeof FREEHIRE_MARKETS)[number], offset: number): Promise<FreehireResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchPage(market, offset)
    } catch (error) {
      const response = (error as { response?: { status?: number; headers?: Record<string, string> } }).response
      if (response?.status === 429 && attempt < 4) {
        const wait = Number(response.headers?.['retry-after']) || 20
        console.warn(`[freehire] 429 rate limited; waiting ${wait}s (attempt ${attempt + 1})`)
        await sleep(wait * 1000)
        continue
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

/** Write already-collected jobs through the normal board ingest (dedupe, priority, salary gate). */
export async function ingestFreehireJobs(inputs: BoardJobInput[]): Promise<ScraperStats> {
  const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }
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
