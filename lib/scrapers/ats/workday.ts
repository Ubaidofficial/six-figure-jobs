// lib/scrapers/ats/workday.ts
import type { AtsJob } from './types'

/**
 * Workday is tenant-specific. No generic scraper exists.
 * Returning [] keeps ingestion safe until Phase 3.
 */
export async function scrapeWorkday(_: string): Promise<AtsJob[]> {
  console.warn('[Workday] Stub called. No generic scraper implemented.')
  return []
}
