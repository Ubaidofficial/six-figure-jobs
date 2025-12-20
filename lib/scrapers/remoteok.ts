// lib/scrapers/remoteok.ts
// RemoteOK → 100k+ jobs via public API + company ingestion
//
// Uses the shared ingestBoardJob helper, which:
//  - Upserts Company via upsertCompanyFromBoard
//  - Gives priority to ATS/company jobs (board jobs become fallback)
//  - Normalizes salary/location/role, etc.

import { ingestBoardJob } from '../jobs/ingestBoardJob'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'

const BOARD_NAME = 'remoteok'
const API_URL = 'https://remoteok.com/api'

export default async function scrapeRemoteOK() {
  console.log('[RemoteOK] Starting scrape...')

  try {
    let json: any[] = []
    const res = await fetch(API_URL, {
      headers: {
        'User-Agent': 'SixFigureJobs/1.0 (+remoteok-scraper)',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(`[${BOARD_NAME}] HTTP ${res.status} for ${API_URL}`)
      return { created: 0, updated: 0, skipped: 0, error: `HTTP ${res.status}` } satisfies ScraperStats
    }

    json = await res.json()
    if (!Array.isArray(json) || json.length === 0) {
      console.warn(`[${BOARD_NAME}] Empty API response`)
      return { created: 0, updated: 0, skipped: 0, error: 'empty-api-response' } satisfies ScraperStats
    }

    // First element of RemoteOK API is metadata; jobs start from index 1
    const rawJobs = json.slice(1)

    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    for (const j of rawJobs) {
      try {
        const id = j.id ?? j.slug ?? j.position
        if (!id) continue

        const title = j.position || j.title
        if (!title) continue

        const rawCompanyName: string | null = j.company || j.company_name || null

        const urlRaw: string | null = j.url || j.apply_url || null
        if (!urlRaw) continue

        const url = urlRaw.startsWith('http') ? urlRaw : `https://remoteok.com${urlRaw}`

        const locationText: string | null =
          j.location ||
          j.region ||
          (Array.isArray(j.tags) && j.tags.includes('Worldwide') ? 'Worldwide' : null)

        // Salary info from API if present
        let salaryMin: number | null = null
        let salaryMax: number | null = null
        let salaryCurrency: string | null = null
        let salaryInterval: string | null = null

        if (j.salary_min != null || j.salary_max != null) {
          salaryMin = j.salary_min != null ? Number(j.salary_min) : null
          salaryMax = j.salary_max != null ? Number(j.salary_max) : null
          salaryCurrency = j.salary_currency || null
          salaryInterval = j.salary_interval || j.salary_type || 'year'
        }

        const descriptionHtml: string | null = j.description || null
        const descriptionText: string | null = (j.description && stripHtml(j.description)) || null

        const postedAt = j.date ? new Date(j.date) : null

        const result = await ingestBoardJob(BOARD_NAME, {
          externalId: String(id),
          title,
          url,
          rawCompanyName,
          locationText,
          salaryMin,
          salaryMax,
          salaryCurrency,
          salaryInterval,
          isRemote: true,
          employmentType: j.job_type || j.type || null,
          postedAt,
          updatedAt: postedAt,
          descriptionHtml,
          descriptionText,
          companyWebsiteUrl: null,
          applyUrl: url,
          explicitAtsProvider: null,
          explicitAtsUrl: null,
          raw: j,
        })

        addBoardIngestResult(stats, result)
      } catch (err: any) {
        console.error(`[${BOARD_NAME}] Error processing job id=${j?.id}:`, err?.message || err)
        stats.skipped++
      }
    }

    console.log(`[RemoteOK] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[RemoteOK] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
