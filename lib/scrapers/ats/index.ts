// lib/scrapers/ats/index.ts

import type { ATSResult, AtsProvider } from './types'
import { scrapeGreenhouseResult } from './greenhouse'
import { scrapeLeverResult } from './lever'
import { scrapeAshbyResult } from './ashby'
import { scrapeSmartRecruitersResult } from './smartrecruiters'
import { scrapeRecruiteeResult } from './recruitee'
import { scrapeWorkdayResult } from './workday'
import { scrapeWorkableResult } from './workable'

export type { ATSResult } from './types'

/**
 * Central entrypoint for scraping jobs from a company's ATS.
 *
 * - Input: provider + atsUrl (or slug-like URL)
 * - Output: standardized ATSResult (distinguishes empty vs failure)
 *
 * NOTE:
 *  - Each scraper must return success=false on failures (network/parsing).
 *  - success=true with jobs=[] means "board had no jobs".
 */
export async function scrapeCompanyAtsJobs(
  provider: AtsProvider,
  atsUrl: string,
): Promise<ATSResult> {
  if (!provider || !atsUrl) {
    return {
      success: false,
      source: provider || 'workday',
      atsUrl,
      error: 'Missing provider or atsUrl',
    }
  }

  try {
    switch (provider) {
      case 'greenhouse':
        return await scrapeGreenhouseResult(atsUrl)

      case 'lever':
        return await scrapeLeverResult(atsUrl)

      case 'ashby':
        // HTML-based scraper (no more careers.json)
        return await scrapeAshbyResult(atsUrl)

      case 'smartrecruiters':
        return await scrapeSmartRecruitersResult(atsUrl)

      case 'recruitee':
        return await scrapeRecruiteeResult(atsUrl)

      case 'workday':
        return await scrapeWorkdayResult(atsUrl)

      case 'workable':
        return await scrapeWorkableResult(atsUrl)

      default:
        return {
          success: false,
          source: provider,
          atsUrl,
          error: `Unsupported provider="${provider}"`,
        }
    }
  } catch (err) {
    return {
      success: false,
      source: provider,
      atsUrl,
      error: (err as any)?.message || String(err),
    }
  }
}
