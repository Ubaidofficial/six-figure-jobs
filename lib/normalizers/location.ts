import { normalizeLocationRaw, hasMultiLocationSignals } from '../location/locationRaw'

export type LocationKind = 'remote' | 'hybrid' | 'onsite'

export interface NormalizedLocation {
  /** Clean, human-friendly location string */
  normalizedText: string | null

  /** Is this job remote at all (fully or partially)? */
  isRemote: boolean | null

  /** High-level label */
  kind: LocationKind | null

  /** Parsed components (best-effort) */
  city: string | null
  region: string | null
  country: string | null
}

const NON_CITY_LABELS = new Set([
  'remote',
  'remote friendly',
  'remote-friendly',
  'remote worldwide',
  'remote global',
  'remote anywhere',
  'work from home',
  'wfh',
  'anywhere',
  'anywhere in the world',
  'anywhere in world',
  'worldwide',
  'global',
  'world',
  'europe',
  'emea',
  'apac',
  'latam',
  'americas',
  'north america',
  'south america',
  'central america',
  'asia',
  'asia pacific',
  'middle east',
  'africa',
  'eu',
  'uk',
  'us',
  'usa',
  'united kingdom',
  'united states',
  'united states of america',
  'canada',
  'germany',
  'france',
  'spain',
  'italy',
  'australia',
  'new zealand',
  'india',
  'singapore',
])

function normalizeLabel(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isNonCityLabel(value: string | null | undefined): boolean {
  const key = normalizeLabel(String(value || ''))
  if (!key) return false
  if (NON_CITY_LABELS.has(key)) return true
  if (key.includes('remote') && (key.includes('anywhere') || key.includes('worldwide') || key.includes('global'))) {
    return true
  }
  return false
}

/**
 * Normalize a raw location string coming from ATS or boards.
 *
 * Key fixes:
 * - Uses normalizeLocationRaw() so "•" becomes '|' (Fix 2) and separators are preserved.
 * - Avoids treating normal "City, State, Country" as multi-location (Fix 1).
 * - If the string is multi-location (pipes/semicolons/slashes or long comma lists), do NOT try to parse city/region/country.
 */
export function normalizeLocation(raw: string | null | undefined): NormalizedLocation {
  if (!raw) return emptyLocation()

  // Keep a human-ish display string (don’t destroy punctuation here)
  let display = String(raw)
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-') // en/em → hyphen
    .trim()

  if (!display) return emptyLocation()

  // Deterministic normalized form for regex checks
  const lrRaw = normalizeLocationRaw(display)

  // Detect remote/hybrid/onsite with separator-aware boundaries
  const hasRemote =
    /(^|[ ,;|/])remote([ ,;|/]|$)/.test(lrRaw) ||
    /telecommute/.test(lrRaw) ||
    /work from home/.test(lrRaw) ||
    /(^|[ ,;|/])wfh([ ,;|/]|$)/.test(lrRaw) ||
    /(^|[ ,;|/])anywhere([ ,;|/]|$)/.test(lrRaw) ||
    /(^|[ ,;|/])global([ ,;|/]|$)/.test(lrRaw)

  const hasHybrid =
    /(^|[ ,;|/])hybrid([ ,;|/]|$)/.test(lrRaw) ||
    /remote (and|\/) (on ?site|onsite|in office|office)/.test(lrRaw) ||
    /(on ?site|onsite|in office|office) (and|\/) remote/.test(lrRaw)

  const hasOnsite =
    /(^|[ ,;|/])(on ?site|onsite|in office|office based)([ ,;|/]|$)/.test(lrRaw) ||
    /(^|[ ,;|/])office([ ,;|/]|$)/.test(lrRaw)

  let kind: LocationKind | null = null
  let isRemote: boolean | null = null

  // Precedence: HYBRID > ONSITE > REMOTE > unknown
  if (hasHybrid) {
    kind = 'hybrid'
    isRemote = true
  } else if (hasOnsite) {
    kind = 'onsite'
    isRemote = false
  } else if (hasRemote) {
    kind = 'remote'
    isRemote = true
  } else {
    kind = null
    isRemote = null
  }

  // Remove trailing qualifiers only from the display string
  display = stripRemoteQualifiers(display)

  // If multi-location signals exist, do not attempt component parsing
  const lr = normalizeLocationRaw(display)
  const multi = hasMultiLocationSignals(lr)
  if (multi) {
    return {
      normalizedText: display || null,
      isRemote,
      kind,
      city: null,
      region: null,
      country: null,
    }
  }

  // Parse into components city / region / country (best-effort)
  const { city, region, country } = splitLocationParts(display)

  return {
    normalizedText: display || null,
    isRemote,
    kind,
    city,
    region,
    country,
  }
}

/**
 * Use this when you have BOTH:
 *  - an explicit `remote` field (from ATS)
 *  - a location string
 *
 * It combines them intelligently.
 */
export function coerceRemoteFlag(
  explicitRemote: boolean | null | undefined,
  normalized: NormalizedLocation,
): boolean | null {
  if (typeof explicitRemote === 'boolean') {
    if (explicitRemote) return true
    if (normalized.kind === 'remote' || normalized.kind === 'hybrid') return true
    return false
  }

  if (normalized.kind === 'remote' || normalized.kind === 'hybrid') return true
  if (normalized.kind === 'onsite') return false
  return null
}

/* ------------------------------------------------------------------ */
/* Internals                                                          */
/* ------------------------------------------------------------------ */

function emptyLocation(): NormalizedLocation {
  return {
    normalizedText: null,
    isRemote: null,
    kind: null,
    city: null,
    region: null,
    country: null,
  }
}

function stripRemoteQualifiers(text: string): string {
  let result = text
  const original = result

  // Remove leading qualifiers like "Hybrid - London" / "Remote: Berlin" / "Onsite in Dublin"
  result = result.replace(
    /^\s*(remote|hybrid|onsite|on[- ]site|in office|office based)\s*(?:[-|:/,]\s*)+/i,
    '',
  )
  result = result.replace(
    /^\s*(remote|hybrid|onsite|on[- ]site|in office|office based)\s+(?:in|at)\s+/i,
    '',
  )

  // Remove trailing parenthetical qualifiers
  result = result.replace(
    /\s*\((remote|hybrid|onsite|on site|on-site|anywhere|global)[^)]*\)\s*$/gi,
    '',
  )

  // Remove simple suffixes: " - Remote", " | Remote", ", Remote"
  result = result.replace(
    /(\s*[-|,]\s*(remote|hybrid|onsite|on site|on-site|anywhere|global)\s*)$/gi,
    '',
  )

  result = result.trim()
  return result ? result : original.trim()
}

function splitLocationParts(text: string): {
  city: string | null
  region: string | null
  country: string | null
} {
  const lower = text.toLowerCase().trim()
  const normalized = normalizeLabel(lower)
  const normalizedCountry = normalizeCountry(text)

  if (isNonCityLabel(normalized)) {
    return { city: null, region: null, country: normalizedCountry }
  }
  if (
    lower === 'remote' ||
    lower === 'hybrid' ||
    lower === 'onsite' ||
    lower === 'on site' ||
    lower === 'on-site' ||
    lower === 'anywhere' ||
    lower === 'worldwide' ||
    lower === 'global' ||
    lower === 'emea' ||
    lower === 'apac' ||
    lower === 'latam' ||
    lower === 'anywhere in the world' ||
    lower === 'anywhere in world' ||
    lower === 'europe' ||
    lower === 'north america' ||
    lower === 'south america' ||
    lower === 'asia' ||
    lower === 'asia pacific' ||
    lower === 'middle east' ||
    lower === 'africa'
  ) {
    return { city: null, region: null, country: normalizedCountry }
  }

  const parts = text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) return { city: null, region: null, country: null }

  const last = parts[parts.length - 1]
  const country = normalizeCountry(last)

  if (parts.length === 1) {
    if (country) return { city: null, region: null, country }
    const inferred = inferCountryFromCity(last)
    if (inferred) return { city: inferred.city, region: null, country: inferred.country }
    return { city: last, region: null, country: null }
  }

  if (parts.length === 2) {
    const [p1, p2] = parts
    const c2 = normalizeCountry(p2)
    if (c2) return { city: p1, region: null, country: c2 }
    const inferred = inferCountryFromCity(p1)
    if (inferred) return { city: inferred.city, region: p2, country: inferred.country }
    if (isUsState(p2)) return { city: p1, region: p2, country: 'United States' }
    return { city: p1, region: p2, country: null }
  }

  const [p1, p2] = parts
  const p3 = parts[2]
  const c3 = normalizeCountry(p3)
  if (c3) return { city: p1, region: p2, country: c3 }

  const inferred = inferCountryFromCity(p1)
  if (inferred) return { city: inferred.city, region: p2, country: inferred.country }
  if (isUsState(p2)) return { city: p1, region: p2, country: 'United States' }

  return { city: p1, region: p2, country: null }
}

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
])

const US_STATE_NAMES = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine',
  'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri',
  'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico',
  'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
  'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee',
  'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
  'wisconsin', 'wyoming', 'district of columbia',
])

function isUsState(token: string): boolean {
  const t = String(token || '').trim()
  if (!t) return false
  if (t.length === 2) return US_STATE_CODES.has(t.toUpperCase())
  return US_STATE_NAMES.has(t.toLowerCase())
}

function normalizeCityKey(city: string): string {
  return String(city || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferCountryFromCity(cityRaw: string): { city: string; country: string } | null {
  const key = normalizeCityKey(cityRaw)
  if (!key) return null

  const map: Record<string, { city: string; country: string }> = {
    // Ireland
    dublin: { city: 'Dublin', country: 'Ireland' },

    // United Kingdom
    london: { city: 'London', country: 'United Kingdom' },
    manchester: { city: 'Manchester', country: 'United Kingdom' },
    edinburgh: { city: 'Edinburgh', country: 'United Kingdom' },

    // Germany
    berlin: { city: 'Berlin', country: 'Germany' },
    munich: { city: 'Munich', country: 'Germany' },
    hamburg: { city: 'Hamburg', country: 'Germany' },

    // France
    paris: { city: 'Paris', country: 'France' },

    // Netherlands
    amsterdam: { city: 'Amsterdam', country: 'Netherlands' },

    // Spain / Portugal / Italy
    madrid: { city: 'Madrid', country: 'Spain' },
    barcelona: { city: 'Barcelona', country: 'Spain' },
    lisbon: { city: 'Lisbon', country: 'Portugal' },
    milan: { city: 'Milan', country: 'Italy' },

    // Nordics
    stockholm: { city: 'Stockholm', country: 'Sweden' },
    oslo: { city: 'Oslo', country: 'Norway' },
    copenhagen: { city: 'Copenhagen', country: 'Denmark' },
    helsinki: { city: 'Helsinki', country: 'Finland' },

    // Switzerland
    zurich: { city: 'Zurich', country: 'Switzerland' },

    // US / Canada
    'new york': { city: 'New York', country: 'United States' },
    'san francisco': { city: 'San Francisco', country: 'United States' },
    seattle: { city: 'Seattle', country: 'United States' },
    austin: { city: 'Austin', country: 'United States' },
    toronto: { city: 'Toronto', country: 'Canada' },
    vancouver: { city: 'Vancouver', country: 'Canada' },

    // Australia / Singapore
    sydney: { city: 'Sydney', country: 'Australia' },
    melbourne: { city: 'Melbourne', country: 'Australia' },
    singapore: { city: 'Singapore', country: 'Singapore' },
  }

  return map[key] ?? null
}

function normalizeCountry(raw: string): string | null {
  const cleaned = raw.trim()
  if (!cleaned) return null

  const tokens = cleaned
    .split(/[,\/\-|]/)
    .map((t) => t.trim())
    .filter(Boolean)

  const mapToken = (token: string): string | null => {
    if (!token) return null

    const withoutRemote = token.replace(/\bremote\b/gi, '').trim()
    if (!withoutRemote) return null

    const noDots = withoutRemote.replace(/\./g, '').trim()
    const lower = noDots.toLowerCase()
    const compact = lower.replace(/\s+/g, '')

    if (
      lower.includes('emea') ||
      lower.includes('apac') ||
      lower.includes('latam') ||
      lower.includes('americas') ||
      lower.includes('europe') ||
      lower.includes('worldwide') ||
      lower.includes('anywhere') ||
      lower.includes('global') ||
      lower.includes('middle east') ||
      lower.includes('asia pacific') ||
      lower.includes('north america') ||
      lower.includes('south america') ||
      lower.includes('central america')
    ) {
      return null
    }

    if (
      /full ?time/.test(lower) ||
      /part ?time/.test(lower) ||
      lower === 'contract' ||
      lower === 'permanent'
    ) {
      return null
    }

    if (compact === 'us' || compact === 'usa' || lower === 'united states' || lower === 'united states of america') {
      return 'United States'
    }

    if (compact === 'uk' || lower === 'united kingdom' || lower === 'great britain' || lower === 'england' || lower === 'scotland') {
      return 'United Kingdom'
    }

    // ISO2 country codes (commonly seen as "City, GB" or "Dublin, IE")
    if (compact === 'ca') return 'Canada'
    if (compact === 'de') return 'Germany'
    if (compact === 'fr') return 'France'
    if (compact === 'nl') return 'Netherlands'
    if (compact === 'es') return 'Spain'
    if (compact === 'it') return 'Italy'
    if (compact === 'au') return 'Australia'
    if (compact === 'nz') return 'New Zealand'
    if (compact === 'se') return 'Sweden'
    if (compact === 'no') return 'Norway'
    if (compact === 'dk') return 'Denmark'
    if (compact === 'fi') return 'Finland'
    if (compact === 'ch') return 'Switzerland'
    if (compact === 'ie') return 'Ireland'
    if (compact === 'pl') return 'Poland'
    if (compact === 'pt') return 'Portugal'
    if (compact === 'br') return 'Brazil'
    if (compact === 'mx') return 'Mexico'
    if (compact === 'in') return 'India'
    if (compact === 'sg') return 'Singapore'

    if (lower === 'canada') return 'Canada'
    if (lower === 'germany' || lower === 'deutschland') return 'Germany'
    if (lower === 'france') return 'France'
    if (lower === 'netherlands' || lower === 'holland') return 'Netherlands'
    if (lower === 'spain') return 'Spain'
    if (lower === 'italy') return 'Italy'
    if (lower === 'australia') return 'Australia'
    if (lower === 'new zealand') return 'New Zealand'
    if (lower === 'sweden') return 'Sweden'
    if (lower === 'norway') return 'Norway'
    if (lower === 'denmark') return 'Denmark'
    if (lower === 'finland') return 'Finland'
    if (lower === 'switzerland') return 'Switzerland'
    if (lower === 'ireland') return 'Ireland'
    if (lower === 'poland') return 'Poland'
    if (lower === 'portugal') return 'Portugal'
    if (lower === 'brazil') return 'Brazil'
    if (lower === 'mexico') return 'Mexico'
    if (lower === 'india') return 'India'
    if (lower === 'singapore') return 'Singapore'

    if (noDots.length <= 2) return null

    if (!/\s/.test(noDots) && /[a-zA-Z]/.test(noDots)) {
      return withoutRemote.trim()
    }

    return null
  }

  for (let i = tokens.length - 1; i >= 0; i--) {
    const candidate = mapToken(tokens[i])
    if (candidate) return candidate
  }

  return null
}
