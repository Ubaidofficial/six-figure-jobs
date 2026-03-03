// lib/scrapers/remoteok.ts
// RemoteOK → 100k+ jobs via public API + company ingestion
//
// Uses the shared ingestBoardJob helper, which:
//  - Upserts Company via upsertCompanyFromBoard
//  - Gives priority to ATS/company jobs (board jobs become fallback)
//  - Normalizes salary/location/role, etc.

import { ingestBoardJob } from '../jobs/ingestBoardJob'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'
import { detectATS, getCompanyJobsUrl, isExternalToHost, toAtsProvider } from './utils/detectATS'
import { extractApplyDestinationFromHtml } from './utils/extractApplyLink'
import { resolveFinalUrl } from './utils/resolveFinalUrl'
import { saveCompanyATS } from './utils/saveCompanyATS'

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

        const boardUrlRaw: string | null = j.url || null
        const applyUrlRaw: string | null = j.apply_url || null
        const fallbackUrlRaw: string | null = boardUrlRaw || applyUrlRaw || null
        if (!fallbackUrlRaw) continue

        const boardUrl =
          (boardUrlRaw || fallbackUrlRaw).startsWith('http')
            ? (boardUrlRaw || fallbackUrlRaw)
            : `https://remoteok.com${boardUrlRaw || fallbackUrlRaw}`

        const applyUrlCandidate =
          applyUrlRaw && applyUrlRaw.startsWith('http')
            ? applyUrlRaw
            : applyUrlRaw
            ? `https://remoteok.com${applyUrlRaw}`
            : null

	        let applyUrl =
	          applyUrlCandidate && isExternalToHost(applyUrlCandidate, 'remoteok.com')
	            ? applyUrlCandidate
	            : boardUrl

	        let discoveredApplyUrl: string | null = null
	        if (applyUrl && applyUrl.toLowerCase().includes('remoteok.com')) {
	          discoveredApplyUrl = await discoverRemoteOKApplyUrl(boardUrl, String(id))
	          if (discoveredApplyUrl) applyUrl = discoveredApplyUrl
	        }

	        const atsType = detectATS(applyUrl)
	        const explicitAtsProvider = toAtsProvider(atsType)
	        const explicitAtsUrl = explicitAtsProvider ? getCompanyJobsUrl(applyUrl, atsType) : null

        if (rawCompanyName && isExternalToHost(applyUrl, 'remoteok.com')) {
          await saveCompanyATS(rawCompanyName, applyUrl, 'remoteok')
        }

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
          url: boardUrl,
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
          applyUrl,
          explicitAtsProvider,
          explicitAtsUrl,
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

async function discoverRemoteOKApplyUrl(jobUrl: string, remoteOkId?: string): Promise<string | null> {
  try {
    // RemoteOK uses an internal /l/<id> redirect with JS-obfuscated destination.
    // When we have the numeric id from the API, decode it directly (no need to parse the job page).
    if (remoteOkId) {
      const redirectUrl = `https://remoteok.com/l/${encodeURIComponent(remoteOkId)}`
      const resolved = await resolveFinalUrl(redirectUrl, { referer: jobUrl })
      if (resolved) return resolved
    }

    const res = await fetch(jobUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
	    })

	    if (!res.ok) {
	      return null
	    }

	    const html = await res.text()
	    if (!html) {
	      return null
	    }

	    const result = extractApplyDestinationFromHtml(html, jobUrl)
	    if (!result) return null

    try {
      const parsed = new URL(result)
      if (parsed.hostname.toLowerCase().includes('remoteok.com') && parsed.pathname.startsWith('/l/')) {
        const resolved = await resolveFinalUrl(result, { referer: jobUrl })
        if (resolved) {
          // RemoteOK may decode to another internal /l/?rh=... step; use it as a better applyUrl even if still internal.
          if (!resolved.toLowerCase().includes('remoteok.com')) return resolved
          return resolved
        }
      }
    } catch {
      // ignore
    }

	    return result
	  } catch (err: any) {
	    return null
	  }
	}
