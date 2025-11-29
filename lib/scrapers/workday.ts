// lib/scrapers/ats/workday.ts

type AtsJob = any

/**
 * Workday ATS scraper (safe stub).
 *
 * Workday implementations vary per company and require a tenant-specific
 * JSON endpoint. This stub prevents crashes in the ingestion pipeline by
 * returning an empty list while logging a warning.
 *
 * When you obtain a valid Workday endpoint (usually something like
 * `.../wday/cxs/company/api/jobs`), implement real parsing here.
 */
export async function scrapeWorkday(atsUrl: string): Promise<AtsJob[]> {
  console.warn(
    `[Workday] No scraper implemented for ${atsUrl}. Returning empty job list.`
  )

  // Always return a safe, typed array
  return []
}
