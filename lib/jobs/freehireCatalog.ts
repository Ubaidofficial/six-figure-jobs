// lib/jobs/freehireCatalog.ts
//
// The size of freehire's catalogue, which our freehire import screens for jobs with published six-figure pay.
// freehire publishes these numbers live so others can quote them (https://freehire.me/open, "Every number, live, with
// the endpoint behind it"); this reads that endpoint rather than copying a snapshot that would go stale.
import { memoAsync } from '@/lib/cache/memo'

export type FreehireCatalog = { jobs: number; companies: number; sources: number; atsPlatforms: number }

export const FREEHIRE_CATALOG_URL = 'https://freehire.me/api/v1/stats/catalog'
/** Their figures move slowly; a failed read is kept for the same hour, so a freehire outage cannot slow every visit. */
export const FREEHIRE_CATALOG_TTL_MS = 60 * 60 * 1000

const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)

/** Pure: the endpoint's body to the four numbers shown, or null when any is missing or not a positive whole number. */
export function parseFreehireCatalog(body: unknown): FreehireCatalog | null {
  const d = (body as { data?: Record<string, unknown> } | null)?.data
  if (!d) return null
  const jobs = count(d.unique_open_jobs)
  const companies = count(d.companies)
  const sources = count(d.sources)
  const atsPlatforms = count(d.ats_platforms)
  if (!jobs || !companies || !sources || !atsPlatforms) return null
  return { jobs, companies, sources, atsPlatforms }
}

/** freehire's live catalogue size, or null when it cannot be read (the homepage then leaves the line out). */
export function loadFreehireCatalog(): Promise<FreehireCatalog | null> {
  return memoAsync('freehire-catalog', FREEHIRE_CATALOG_TTL_MS, async () => {
    try {
      const res = await fetch(FREEHIRE_CATALOG_URL, {
        headers: { 'User-Agent': '6FigJobs/1.0 (+https://www.6figjobs.com)' },
        signal: AbortSignal.timeout(2500),
        // Cacheable, never `cache: 'no-store'`: a no-store fetch makes Next render the whole homepage on every request
        // (it had been `private, no-store` and 4-8 s slow since 2026-11-09 17:28 instead of a 5-minute ISR page).
        next: { revalidate: FREEHIRE_CATALOG_TTL_MS / 1000 },
      })
      return res.ok ? parseFreehireCatalog(await res.json()) : null
    } catch {
      return null
    }
  })
}
