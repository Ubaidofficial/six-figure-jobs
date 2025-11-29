// lib/scrapers/ats/index.ts

import type { AtsProvider, AtsJob } from './types'
import { scrapeGreenhouse } from './greenhouse'
import { scrapeLever } from './lever'
import { scrapeAshby } from './ashby'
import { scrapeWorkday } from './workday'

/**
 * Central entrypoint for scraping jobs from a company's ATS.
 *
 * - Input: provider + atsUrl (or slug-like URL)
 * - Output: standardized AtsJob[]
 *
 * NOTE:
 *  - Each scraper is responsible for accepting either a slug or full URL.
 *  - We swallow errors here so a single bad board doesn't crash the pipeline.
 */
export async function scrapeCompanyAtsJobs(
  provider: AtsProvider,
  atsUrl: string,
): Promise<AtsJob[]> {
  if (!provider || !atsUrl) {
    return []
  }

  try {
    switch (provider) {
      case 'greenhouse':
        return await scrapeGreenhouse(atsUrl)

      case 'lever':
        return await scrapeLever(atsUrl)

      case 'ashby':
        // HTML-based scraper (no more careers.json)
        return await scrapeAshby(atsUrl)

      case 'workday':
        // Currently a stub / safe implementation
        return await scrapeWorkday(atsUrl)

      default:
        console.warn(`[ATS] Unsupported provider="${provider}"`)
        return []
    }
  } catch (err) {
    console.error(`[ATS] Error for ${provider} ${atsUrl}`, err)
    return []
  }
}
