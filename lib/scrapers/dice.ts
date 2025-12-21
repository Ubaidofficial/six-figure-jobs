// lib/scrapers/dice.ts
//
// Dice.com API-only scraper (no HTML scraping / no Puppeteer).

import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'
import type { ScrapedJobInput } from '../ingest/types'
import { addIngestStatus, errorStats, type ScraperStats } from './scraperStats'

const BOARD_NAME = 'dice'
const API_URL = 'https://www.dice.com/api/v3/jobs/search'
const USER_AGENT = 'SixFigureJobs/1.0 (+job-board-scraper)'
const TIMEOUT_MS = 15000

type DiceSearchResponse = {
  jobs?: any[]
  data?: { jobs?: any[] }
}

async function fetchDiceJobs(offset: number = 0, limit: number = 100): Promise<any[]> {
  const body = {
    filters: {
      minSalary: 100000,
      currency: 'USD',
      employmentType: ['FULL_TIME'],
      remote: true,
    },
    sort: 'date',
    offset,
    limit,
  }

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) throw new Error(`Dice API returned ${res.status}`)

    const data = (await res.json()) as DiceSearchResponse
    return (data?.jobs || data?.data?.jobs || []) as any[]
  } finally {
    clearTimeout(id)
  }
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toAnnualDollars(raw: unknown): number | null {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  // Heuristic: some APIs return "k" units (e.g., 120), others return USD (120000).
  return n < 1000 ? Math.round(n * 1000) : Math.round(n)
}

export default async function scrapeDice(): Promise<ScraperStats> {
  console.log('[Dice] Starting scrape...')

  try {
    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    let offset = 0
    const limit = 100
    const maxJobs = 5000

    const seen = new Set<string>()

    while (offset < maxJobs) {
      console.log(`[Dice] Fetching offset=${offset}`)

      const jobs = await fetchDiceJobs(offset, limit)
      if (!jobs.length) break

      for (const job of jobs) {
        const externalId = String(job?.id ?? '')
        if (!externalId) {
          stats.skipped++
          continue
        }
        if (seen.has(externalId)) continue
        seen.add(externalId)

        const title = String(job?.title ?? '').trim()
        if (!title) {
          stats.skipped++
          continue
        }

        const descriptionHtml: string | null = typeof job?.description === 'string' ? job.description : null
        const descriptionText: string | null = descriptionHtml ? stripHtml(descriptionHtml) : null

        const salaryMin = toAnnualDollars(job?.salary?.min)
        const salaryMax = toAnnualDollars(job?.salary?.max)

        const scrapedJob: ScrapedJobInput = {
          externalId,
          title,
          source: makeBoardSource(BOARD_NAME),
          rawCompanyName: job?.company?.name || 'Unknown',
          url: job?.detailUrl || `https://www.dice.com/jobs/detail/${externalId}`,
          applyUrl: job?.applyUrl || job?.detailUrl || `https://www.dice.com/jobs/detail/${externalId}`,
          locationText: job?.location?.displayLocation || 'Remote',
          isRemote: Boolean(job?.isRemote),

          // CRITICAL: Full description for AI enrichment
          descriptionHtml,
          descriptionText,

          salaryMin,
          salaryMax,
          salaryCurrency: job?.salary?.currency || 'USD',
          salaryInterval: 'year',

          employmentType: job?.employmentType || 'Full-time',
          postedAt: job?.postedDate ? new Date(job.postedDate) : null,

          raw: job,
        }

        try {
          const result = await ingestJob(scrapedJob)
          addIngestStatus(stats, result.status)
        } catch (err) {
          console.error('[Dice] Job ingest failed:', err)
          stats.skipped++
        }
      }

      offset += limit
      if (jobs.length < limit) break
    }

    console.log(`[Dice] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[Dice] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}

