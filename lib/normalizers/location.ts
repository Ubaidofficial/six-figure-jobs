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
  const lr = normalizeLocationRaw(display)

  // Detect remote/hybrid/onsite with separator-aware boundaries
  const hasRemote =
    /(^|[ ,;|/])remote([ ,;|/]|$)/.test(lr) ||
    /telecommute/.test(lr) ||
    /work from home/.test(lr) ||
    /(^|[ ,;|/])wfh([ ,;|/]|$)/.test(lr) ||
    /(^|[ ,;|/])anywhere([ ,;|/]|$)/.test(lr) ||
    /(^|[ ,;|/])global([ ,;|/]|$)/.test(lr)

  const hasHybrid =
    /(^|[ ,;|/])hybrid([ ,;|/]|$)/.test(lr) ||
    /remote (and|\/) (on ?site|onsite|in office|office)/.test(lr) ||
    /(on ?site|onsite|in office|office) (and|\/) remote/.test(lr)

  const hasOnsite =
    /(^|[ ,;|/])(on ?site|onsite|in office|office based)([ ,;|/]|$)/.test(lr) ||
    /(^|[ ,;|/])office([ ,;|/]|$)/.test(lr)

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

  return result.trim()
}

function splitLocationParts(text: string): {
  city: string | null
  region: string | null
  country: string | null
} {
  const parts = text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) return { city: null, region: null, country: null }

  const last = parts[parts.length - 1]
  const country = normalizeCountry(last)

  if (parts.length === 1) {
    if (country) return { city: null, region: null, country }
    return { city: last, region: null, country: null }
  }

  if (parts.length === 2) {
    const [p1, p2] = parts
    const c2 = normalizeCountry(p2)
    if (c2) return { city: p1, region: null, country: c2 }
    return { city: p1, region: p2, country: null }
  }

  const [p1, p2] = parts
  const p3 = parts[2]
  const c3 = normalizeCountry(p3)
  if (c3) return { city: p1, region: p2, country: c3 }

  return { city: p1, region: p2, country: null }
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

    let withoutRemote = token.replace(/\bremote\b/gi, '').trim()
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
