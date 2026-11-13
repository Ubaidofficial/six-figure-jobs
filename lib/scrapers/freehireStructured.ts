// lib/scrapers/freehireStructured.ts
//
// What freehire's own geography fields (`work_mode`, `countries`, `regions`, `location`) say about where a remote job can
// be worked from. Our freehire mapping keeps only the free-text location and a remote flag, so "worldwide" is lost: a job
// freehire marks `regions: ['global']` with the text "Remote" reaches us as a bare "Remote" and gets the company's country
// guessed (2026-11-13 audit: 172 live freehire jobs say just "Remote" with no country). mapFreehireJob uses it through
// freehireStructuredLocationText (below) for remote jobs whose text names no place.
//
// Conservative on purpose. In a sample of 100 newest USD jobs with regions=global (2026-11-13), 18 were not remote at all
// (hybrid, "In-Office") and 33 also carried a country ('us'), so `global` alone is not believed: worldwide needs a remote
// job, no country, and text that names no place. A country freehire lists wins, as a stored country does on the site.
import { isWorldwideLocationText } from '../jobs/remoteRegions'
import { countryName, normalizeCountryCode } from '../location/country'

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

/** freehire regions that one location phrase covers, in the words regionFromLocationText (JobPosting markup) reads. */
const REGION_TEXT: Record<string, string> = { eu: 'Europe', uk: 'United Kingdom', north_america: 'North America', apac: 'APAC' }
/** More countries than this and the text would be a long list on the job page: keep freehire's text instead. */
const MAX_LISTED_COUNTRIES = 6

/**
 * For a remote job whose text names no place ("Remote" or nothing), a location text built from freehire's own fields, in
 * the forms ingest and the JobPosting markup already read: "Remote - Worldwide" (every eligible country),
 * "Remote - United States" (stored country US), "Remote - United States; Remote - Canada" (both listed, no single stored
 * country), "Remote - Europe". Null keeps freehire's text: it names a place, or freehire's fields do not say enough.
 */
export function freehireStructuredLocationText(job: FreehireGeoInput): string | null {
  const text = (job.location ?? '').trim()
  if (text !== '' && !BARE_REMOTE.test(text)) return null

  const remote = freehireRemoteScope(job)
  if (remote.scope === 'worldwide') return 'Remote - Worldwide'
  if (remote.scope === 'countries') {
    if (remote.countries.length > MAX_LISTED_COUNTRIES) return null
    const names = remote.countries.map((code) => countryName(code))
    if (names.some((name) => !name)) return null
    return names.map((name) => `Remote - ${name}`).join('; ')
  }
  if (remote.scope === 'regions') {
    // "eu" and "uk" together are Europe (the UK is in it); any other mix says too little for one phrase.
    const regions = remote.regions.every((r) => r === 'eu' || r === 'uk') && remote.regions.includes('eu') ? ['eu'] : remote.regions
    const phrase = regions.length === 1 ? REGION_TEXT[regions[0]] : undefined
    return phrase ? `Remote - ${phrase}` : null
  }
  return null
}
