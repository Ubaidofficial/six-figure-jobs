// What a job's place looks like to a reader: one text, plus the parts (city, region, country) a page can link and flag.
//
// The stored fields are patchy (see CHANGELOG): countryCode is empty for a third of live jobs, stateCode for all of
// them, and locationRaw is whatever the employer typed. So this reads the structured fields first and only then the
// text of locationRaw, and only where the text is unambiguous (a country name, or a state/province/Land that belongs to
// exactly one country). When unsure it says less instead of guessing.
import { CITY_TARGETS, STATE_TARGETS } from '../seo/pseoTargets'
import { countryName, normalizeCountryCode, COUNTRY_NAMES } from './country'

type Region = { name: string; codes?: string[] }

const REGIONS: Record<string, Region[]> = {
  US: [...STATE_TARGETS.map((s) => ({ name: s.name, codes: [s.code] })), { name: 'DC', codes: ['DC'] }],
  CA: [
    { name: 'Alberta', codes: ['AB'] },
    { name: 'British Columbia', codes: ['BC'] },
    { name: 'Manitoba', codes: ['MB'] },
    { name: 'New Brunswick', codes: ['NB'] },
    { name: 'Newfoundland and Labrador', codes: ['NL'] },
    { name: 'Nova Scotia', codes: ['NS'] },
    { name: 'Ontario', codes: ['ON'] },
    { name: 'Prince Edward Island', codes: ['PE'] },
    { name: 'Quebec', codes: ['QC'] },
    { name: 'Saskatchewan', codes: ['SK'] },
  ],
  AU: [
    { name: 'New South Wales', codes: ['NSW'] },
    { name: 'Victoria', codes: ['VIC'] },
    { name: 'Queensland', codes: ['QLD'] },
    { name: 'Western Australia', codes: ['WA'] },
    { name: 'South Australia', codes: ['SA'] },
    { name: 'Tasmania', codes: ['TAS'] },
    { name: 'Australian Capital Territory', codes: ['ACT'] },
    { name: 'Northern Territory', codes: ['NT'] },
  ],
  GB: [{ name: 'England' }, { name: 'Scotland' }, { name: 'Wales' }, { name: 'Northern Ireland' }],
  DE: [
    'Baden-Württemberg',
    'Bayern',
    'Brandenburg',
    'Hessen',
    'Mecklenburg-Vorpommern',
    'Niedersachsen',
    'Nordrhein-Westfalen',
    'Rheinland-Pfalz',
    'Saarland',
    'Sachsen',
    'Sachsen-Anhalt',
    'Schleswig-Holstein',
    'Thüringen',
  ].map((name) => ({ name })),
}

const clean = (s: string) => s.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()

function findRegion(cc: string, text: string, byCode: boolean): string | null {
  const t = clean(text)
  if (!t) return null
  for (const r of REGIONS[cc] ?? []) {
    if (clean(r.name) === t || (byCode && r.codes?.some((c) => c.toLowerCase() === t))) return r.name
  }
  return null
}

// Region names that imply their country on their own. "Georgia" and "Victoria" are left out: they are also a country
// and a Canadian city. A name only counts when something comes before it ("Kleve, Nordrhein-Westfalen").
const AMBIGUOUS_REGIONS = new Set(['georgia', 'victoria'])
const REGION_IMPLIES_COUNTRY = new Map<string, string>()
for (const cc of ['US', 'CA', 'AU', 'DE']) {
  for (const r of REGIONS[cc]) {
    if (!AMBIGUOUS_REGIONS.has(clean(r.name))) REGION_IMPLIES_COUNTRY.set(clean(r.name), cc)
  }
}

const COUNTRY_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAMES).map(([code, name]) => [name.toLowerCase(), code]),
)

const COUNTRY_ALIASES: Record<string, string> = {
  ...COUNTRY_BY_NAME,
  us: 'US',
  usa: 'US',
  'united states of america': 'US',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  deutschland: 'DE',
  czechia: 'CZ',
  'royaume-uni': 'GB',
}

// Words that sit next to a country in a remote job's text ("Remote - US", "Canada (Remote)", "Remote in the U.S.").
const FILLER = /\b(?:remote|virtual|hybrid|in|the|only|based|work from home|wfh)\b/g

/**
 * Location text that says nothing about a place: hiring systems fill the field with instructions or placeholders
 * ("Defer to Job Opening Location", "See job description", "TBD", "N/A"). Shown as a location it reads as broken data,
 * so callers treat it as empty and fall back to the stored city or country.
 */
const PLACEHOLDER_LOCATION =
  /^(?:defer to (?:the )?job (?:opening|posting) location|see (?:the )?job (?:description|posting)|location:?\s*(?:tbd|tba)|tbd|tba|to be (?:determined|announced)|n\/?a|none|not specified|unspecified|-+)$/i

export function isPlaceholderLocation(text: unknown): boolean {
  const t = String(text ?? '').trim().replace(/[.\s]+$/, '')
  return t.length > 0 && PLACEHOLDER_LOCATION.test(t)
}

/**
 * The country a location text names, only when unambiguous: its last comma/dash-separated part is a country name or
 * alias ("Winnipeg, Canada", "Remote - US", "United States (Remote)"), or a state/province/Land that belongs to one
 * country ("Kleve, Nordrhein-Westfalen"). Two-letter codes such as CA or DE are never read as countries, and a text
 * that names two countries ("United States/Canada") gives null.
 */
export function countryFromText(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const lower = text.toLowerCase().replace(/\./g, '')
  const parts = lower
    .replace(/[()[\]]/g, ',')
    .replace(FILLER, ' ')
    .split(/[,;|/–—]|\s-\s/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const last = parts[parts.length - 1]
  if (!last) return null

  let code: string | null = COUNTRY_ALIASES[last] ?? null
  if (!code) {
    // "ca united states": a state code run into the country name. Long names only, so "us" is never a suffix match.
    for (const [name, c] of Object.entries(COUNTRY_BY_NAME)) {
      if (last.endsWith(` ${name}`)) code = c
    }
  }
  if (!code && parts.length >= 2) code = REGION_IMPLIES_COUNTRY.get(last) ?? null
  if (!code) {
    // "France, Auvergne-Rhône-Alpes, Savoie (73)": the country comes first. Fine when exactly one country is named.
    const named = new Set(parts.map((p) => COUNTRY_ALIASES[p]).filter(Boolean))
    if (named.size === 1) code = Array.from(named)[0]
  }
  if (!code) return null

  const rest = lower.replace('northern ireland', '')
  for (const [name, c] of Object.entries(COUNTRY_BY_NAME)) {
    if (c !== code && new RegExp(`\\b${name}\\b`).test(rest)) return null
  }
  return code
}

export type JobLocationView = {
  /** Everything the reader sees in the chip, as plain text (also its tooltip). */
  text: string
  /** "First place +N more" for a `;` list, else null. */
  compact: string | null
  /** How many `;`-separated places the text names (1 for a single place), and the first of them. */
  count: number
  first: string
  /** For the flag. For a `;` list this is the first place's country. */
  countryCode: string | null
  remote: boolean
  /** Set for a single place only, so a page can link them. */
  city: string | null
  region: string | null
  countryName: string | null
}

type LocationFields = {
  remote?: boolean | null
  remoteMode?: string | null
  remoteRegion?: string | null
  city?: string | null
  stateCode?: string | null
  countryCode?: string | null
  locationRaw?: string | null
}

const MAX_TEXT = 90

/** "bay-area" -> "Bay Area" (slugs sometimes leak into locationRaw); long employer text is cut at a word. */
function tidy(value: string): string {
  let v = value.trim()
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(v)) {
    v = v
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ')
  }
  if (v.length <= MAX_TEXT) return v
  const cut = v.slice(0, MAX_TEXT)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).replace(/[,;:.\s-]+$/, '')}…`
}

const REMOTE_SCOPE: Record<string, string> = {
  'us-only': 'United States',
  canada: 'Canada',
  emea: 'EMEA',
  europe: 'Europe',
  apac: 'APAC',
  'uk-ireland': 'UK & Ireland',
}

/**
 * Where a remote job can be worked from. `remoteRegion` is "Global" on every live remote job, including 273 with a US
 * country code, so "Global" alone is not believed; the country code, then the text, decide.
 */
function remoteScope(job: LocationFields, cc: string | null, raw: string): string | null {
  const region = String(job.remoteRegion ?? '').trim().toLowerCase()
  if (REMOTE_SCOPE[region]) return REMOTE_SCOPE[region]
  if (cc) return countryName(cc)
  if (/\b(worldwide|anywhere|global)\b/i.test(raw)) return 'Worldwide'
  return null
}

export function describeJobLocation(job: LocationFields): JobLocationView {
  const raw = isPlaceholderLocation(job.locationRaw) ? '' : String(job.locationRaw ?? '').trim()
  const isRemote = job.remote === true || job.remoteMode === 'remote'
  const stored = normalizeCountryCode(job.countryCode)
  const city = job.city && !isPlaceholderLocation(job.city) ? tidy(String(job.city)) : null
  const none = { compact: null, count: 1, first: '', city: null, region: null, countryName: null }

  const places = Array.from(new Set(raw.split(';').map((p) => p.trim()).filter(Boolean)))

  if (isRemote) {
    const cc = stored ?? countryFromText(places[0] ?? raw)
    const scope = remoteScope(job, cc, raw)
    return { ...none, text: scope ? `Remote · ${scope}` : 'Remote', countryCode: cc, remote: true }
  }

  // "Los Angeles; Miami; New York City": several workplaces. The stored city/country (if any) describe one of them.
  if (places.length >= 2) {
    const first = tidy(places[0])
    return {
      ...none,
      text: places.map(tidy).join('; '),
      compact: `${first} +${places.length - 1} more`,
      count: places.length,
      first,
      countryCode: stored ?? countryFromText(places[0]),
      remote: false,
    }
  }

  // City + country, unless the text says the country is a different one (stored data and text can disagree; then the
  // text is what the reader sees, so its country is the one flagged).
  const textCountry = countryFromText(raw)
  const cc = textCountry ?? stored
  if (city && stored && !(textCountry && textCountry !== stored)) {
    const segments = raw.split(',').map((s) => s.trim())
    const fromCode = job.stateCode ? findRegion(stored, String(job.stateCode), true) : null
    const fromText =
      segments
        .slice(1)
        .filter((s) => clean(s) !== clean(city))
        .map((s) => findRegion(stored, s, true))
        .find(Boolean) ?? null
    const region = fromCode ?? fromText
    const name = countryName(stored)
    return {
      text: [city, region, name].filter(Boolean).join(', '),
      compact: null,
      count: 1,
      first: city,
      countryCode: stored,
      remote: false,
      city,
      region,
      countryName: name,
    }
  }

  if (raw) {
    const segments = raw.split(',')
    const name = cc ? countryName(cc) : null
    // A country on its own ("Deutschland", "Virtual - Canada") is replaced by the country's name; a place whose country
    // was only worked out from a state ("Kleve, Nordrhein-Westfalen") gets the name added.
    const text =
      name && segments.length === 1 && textCountry === cc
        ? name
        : name && !COUNTRY_ALIASES[clean(segments[segments.length - 1])]
          ? `${tidy(raw)}, ${name}`
          : tidy(raw)
    return { ...none, text, countryCode: cc, remote: false }
  }
  if (stored) return { ...none, text: countryName(stored) as string, countryCode: stored, remote: false }
  return { ...none, text: 'Location not specified', countryCode: null, remote: false }
}

const fold = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const CITY_COUNTRY = new Map(
  CITY_TARGETS.flatMap((c) =>
    c.countryCode ? [[c.slug, c.countryCode] as const, [fold(c.label), c.countryCode] as const] : [],
  ),
)

/** The country of a city we have a page for ("Amsterdam" -> NL, "Zürich" -> CH), else null. Ambiguous names (London, ON) are the caller's risk. */
export function countryFromCity(city: unknown): string | null {
  return typeof city === 'string' ? (CITY_COUNTRY.get(fold(city)) ?? null) : null
}
