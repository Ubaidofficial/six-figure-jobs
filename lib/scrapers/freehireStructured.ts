// lib/scrapers/freehireStructured.ts
//
// What freehire's own geography fields (`work_mode`, `countries`, `regions`, `location`) say about where a remote job can
// be worked from. Our freehire mapping keeps only the free-text location and a remote flag, so "worldwide" is lost: a job
// freehire marks `regions: ['global']` with the text "Remote" reaches us as a bare "Remote" and gets the company's country
// guessed (2026-11-13 audit: 172 live freehire jobs say just "Remote" with no country). Not wired into ingest yet.
//
// Conservative on purpose. In a sample of 100 newest USD jobs with regions=global (2026-11-13), 18 were not remote at all
// (hybrid, "In-Office") and 33 also carried a country ('us'), so `global` alone is not believed: worldwide needs a remote
// job, no country, and text that names no place. A country freehire lists wins, as a stored country does on the site.
import { isWorldwideLocationText } from '../jobs/remoteRegions'
import { normalizeCountryCode } from '../location/country'

export type FreehireGeoInput = {
  work_mode?: string | null
  location?: string | null
  countries?: string[] | null
  regions?: string[] | null
}

export type RemoteScope =
  | { scope: 'worldwide' }
  | { scope: 'countries'; countries: string[] }
  | { scope: 'regions'; regions: string[] }
  | { scope: 'unknown' }

/** freehire's region codes (from its docs); anything else is ignored. */
const REGIONS = new Set(['global', 'north_america', 'latam', 'eu', 'uk', 'mena', 'africa', 'apac', 'cis', 'none'])

const BARE_REMOTE = /^\s*(?:fully\s+|100%\s+)?remote\s*$/i

/** freehire's lower-case country codes to ISO codes, without repeats; anything that is not a real country is dropped. */
export function freehireCountryCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const code = normalizeCountryCode(item)
    if (code && !out.includes(code)) out.push(code)
  }
  return out
}

export function freehireRemoteScope(job: FreehireGeoInput): RemoteScope {
  // Hybrid and on-site jobs have a place, not a remote scope.
  if (job.work_mode !== 'remote') return { scope: 'unknown' }

  const countries = freehireCountryCodes(job.countries)
  if (countries.length > 0) return { scope: 'countries', countries }

  const regions = (Array.isArray(job.regions) ? job.regions : [])
    .map((r) => String(r).trim().toLowerCase())
    .filter((r) => REGIONS.has(r))

  if (regions.includes('global')) {
    const text = (job.location ?? '').trim()
    return text === '' || BARE_REMOTE.test(text) || isWorldwideLocationText(text) ? { scope: 'worldwide' } : { scope: 'unknown' }
  }

  const named = regions.filter((r) => r !== 'none')
  return named.length > 0 ? { scope: 'regions', regions: named } : { scope: 'unknown' }
}
