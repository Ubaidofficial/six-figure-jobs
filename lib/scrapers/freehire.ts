// lib/scrapers/freehire.ts
// Pulls $100k+ USD yearly jobs from the freehire.me public API (https://freehire.me/docs/api).
// Auth is optional: set FREEHIRE_API_KEY for the higher per-account rate limit.
import axios from 'axios'

import { ingestBoardJob, type BoardJobInput } from '../jobs/ingestBoardJob'
import { MIN_PUBLISHED_SALARY } from '../jobs/salaryPublicationGate'
import { addBoardIngestResult, type ScraperStats } from './scraperStats'

const BOARD = 'freehire'
const API_URL = 'https://freehire.me/api/v1/jobs/search'
const PAGE_SIZE = 100
// freehire refuses offset + limit > 10000, so one query can reach at most this many newest jobs.
const MAX_OFFSET = 10_000
const LOOKBACK_DAYS = Number(process.env.FREEHIRE_LOOKBACK_DAYS) || 30
// Public limit is 120 requests/minute without a key; stay well under it.
const PAGE_DELAY_MS = 700

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
  enrichment?: {
    employment_type?: string | null
    salary_min?: number | null
    salary_max?: number | null
    salary_currency?: string | null
    salary_period?: string | null
  } | null
}

type FreehireResponse = {
  data: FreehireJob[]
  meta: { total: number; limit: number; offset: number; ignored_params?: unknown }
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

/** Map a freehire record to the board ingest input, or null if it must not be published. */
export function mapFreehireJob(job: FreehireJob): BoardJobInput | null {
  const e = job.enrichment ?? {}
  if (job.closed_at) return null
  if (e.salary_currency !== 'USD' || e.salary_period !== 'year') return null
  if (typeof e.salary_min !== 'number' || e.salary_min < MIN_PUBLISHED_SALARY) return null
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
    salaryCurrency: 'USD',
    salaryInterval: 'year',
    postedAt: job.posted_at ? new Date(job.posted_at) : null,
    updatedAt: job.updated_at ? new Date(job.updated_at) : null,
    descriptionHtml: job.description ?? null,
  }
}

async function fetchPage(offset: number): Promise<FreehireResponse> {
  const headers: Record<string, string> = { 'User-Agent': '6FigJobs/1.0 (+https://www.6figjobs.com)' }
  if (process.env.FREEHIRE_API_KEY) headers.Authorization = `Bearer ${process.env.FREEHIRE_API_KEY}`

  const res = await axios.get<FreehireResponse>(API_URL, {
    headers,
    timeout: 30_000,
    params: {
      salary_currency: 'USD',
      salary_period: 'year',
      salary_min: MIN_PUBLISHED_SALARY,
      sort: 'posted_at',
      order: 'desc',
      limit: PAGE_SIZE,
      offset,
    },
  })
  return res.data
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default async function scrapeFreehire(): Promise<ScraperStats> {
  console.log('[freehire] Starting sync...')
  const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000

  try {
    // Newest first: stop once a page reaches jobs older than the lookback window.
    for (let offset = 0; offset < MAX_OFFSET; offset += PAGE_SIZE) {
      const page = await fetchPage(offset)
      assertFiltersApplied(page.meta)
      if (page.data.length === 0) break

      let reachedCutoff = false
      for (const job of page.data) {
        if (job.posted_at && new Date(job.posted_at).getTime() < cutoff) {
          reachedCutoff = true
          continue
        }
        const input = mapFreehireJob(job)
        if (!input) {
          stats.skipped++
          continue
        }
        addBoardIngestResult(stats, await ingestBoardJob(BOARD, input))
      }

      if (reachedCutoff || page.data.length < PAGE_SIZE) break
      await sleep(PAGE_DELAY_MS)
    }

    console.log(`[freehire] ✓ created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`)
    return stats
  } catch (error) {
    console.error('[freehire] ❌ Sync failed:', error)
    // Keep the counts of jobs already ingested before the failure.
    return { ...stats, error: error instanceof Error ? error.message : String(error) }
  }
}
