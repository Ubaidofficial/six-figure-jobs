// lib/jobs/siteStatsShape.ts
//
// The numbers in the "6figjobs today" band as the live endpoint sends them (app/api/stats/live), and the check the page runs
// on what comes back. Plain data with no server imports, so the browser bundle can use it.

export type LiveSiteStats = {
  /** Listed jobs ("You see"). */
  jobs: number
  companies: number
  newThisWeek: number
  countries: number | null
  /** What is screened; null when it could not be read. */
  catalog: { jobs: number; companies: number; sources: number; atsPlatforms: number } | null
  /** ISO time the job list was last refreshed; null when unknown. */
  refreshedAt: string | null
}

const whole = (v: unknown, min: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min

/**
 * The endpoint's body as numbers the band can show, or null when anything it needs is missing or not a whole number. A
 * number that does not pass is never shown: the band keeps what it has instead of flashing 0 or NaN.
 */
export function parseLiveSiteStats(body: unknown): LiveSiteStats | null {
  const d = body as Record<string, unknown> | null
  if (!d || typeof d !== 'object') return null
  if (!whole(d.jobs, 1) || !whole(d.companies, 0) || !whole(d.newThisWeek, 0)) return null

  const c = d.catalog as Record<string, unknown> | null | undefined
  const catalog =
    c && whole(c.jobs, 1) && whole(c.companies, 1) && whole(c.sources, 1) && whole(c.atsPlatforms, 1)
      ? { jobs: c.jobs, companies: c.companies, sources: c.sources, atsPlatforms: c.atsPlatforms }
      : null

  const refreshedAt = typeof d.refreshedAt === 'string' && !Number.isNaN(Date.parse(d.refreshedAt)) ? d.refreshedAt : null

  return {
    jobs: d.jobs,
    companies: d.companies,
    newThisWeek: d.newThisWeek,
    countries: whole(d.countries, 1) ? d.countries : null,
    catalog,
    refreshedAt,
  }
}
