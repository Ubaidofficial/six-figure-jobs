// lib/normalizers/location.ts

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
 * Examples:
 *  "Remote"                     → remote, kind=remote, normalizedText="Remote"
 *  "Remote - US"                → remote, country="United States"
 *  "San Francisco, CA, US"      → city="San Francisco", region="CA", country="United States"
 *  "Berlin, Germany (Hybrid)"   → kind=hybrid, city="Berlin", country="Germany"
 *  "London or Remote (EMEA)"    → kind=hybrid, isRemote=true
 */
export function normalizeLocation(
  raw: string | null | undefined,
): NormalizedLocation {
  if (!raw) {
    return emptyLocation()
  }

  // Normalize whitespace and collapse weird characters
  let text = raw
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-') // en/em dashes → hyphen
    .trim()

  if (!text) {
    return emptyLocation()
  }

  const lower = text.toLowerCase()

  // Detect remote/hybrid/onsite keywords
  const hasRemote =
    /\bremote\b/.test(lower) ||
    /\bwork from home\b/.test(lower) ||
    /\bwfh\b/.test(lower) ||
    /\banywhere\b/.test(lower) ||
    /\bglobal\b/.test(lower)

  const hasHybrid = /\bhybrid\b/.test(lower)

  const hasOnsite =
    /\bonsite\b/.test(lower) || // "onsite"
    /\bon site\b/.test(lower) || // "on site"
    /\bon-site\b/.test(lower) || // "on-site"
    /\boffice\b/.test(lower)

  let kind: LocationKind | null = null
  let isRemote: boolean | null = null

  if (hasRemote && hasOnsite) {
    // e.g. "London / Remote", "Hybrid, some onsite"
    kind = 'hybrid'
    isRemote = true
  } else if (hasHybrid) {
    kind = 'hybrid'
    isRemote = true
  } else if (hasRemote) {
    kind = 'remote'
    isRemote = true
  } else if (hasOnsite) {
    kind = 'onsite'
    isRemote = false
  } else {
    kind = null
    isRemote = null
  }

  // Strip trailing qualifiers like "(Remote)", "(Hybrid)", " - Remote", "| Remote"
  text = stripRemoteQualifiers(text)

  // Parse into components city / region / country (best-effort)
  const { city, region, country } = splitLocationParts(text)

  const normalizedText = text || null

  return {
    normalizedText,
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
    // If ATS is explicit, trust it but upgrade to true if we also see strong remote hints.
    if (explicitRemote) return true
    if (normalized.kind === 'remote' || normalized.kind === 'hybrid') return true
    return false
  }

  // No explicit field: infer from normalized location
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

  // Remove trailing parenthetical qualifiers: "(Remote)", "(Hybrid, US)", etc.
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

/**
 * Very lightweight location splitting:
 * - Split by commas first
 * - Use heuristics for city, region, country
 *
 * Also handles "Remote - US", "Remote / US", "Remote | US" by
 * letting the country normalizer look at trailing segments.
 */
function splitLocationParts(text: string): {
  city: string | null
  region: string | null
  country: string | null
} {
  const parts = text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return { city: null, region: null, country: null }
  }

  // Guess country from last part (with extra handling inside normalizeCountry)
  const last = parts[parts.length - 1]
  const country = normalizeCountry(last)

  if (parts.length === 1) {
    // Single token: it might be just "Remote", "USA", or a city like "Berlin"
    if (country) {
      return { city: null, region: null, country }
    }
    return { city: last, region: null, country: null }
  }

  if (parts.length === 2) {
    // e.g. "Berlin, Germany" / "San Francisco, US"
    const [p1, p2] = parts
    const c2 = normalizeCountry(p2)

    if (c2) {
      return { city: p1, region: null, country: c2 }
    }

    // Maybe "City, Region"
    return { city: p1, region: p2, country: null }
  }

  // 3+ tokens: try to map "City, Region, Country"
  const [p1, p2] = parts
  const p3 = parts[2]
  const c3 = normalizeCountry(p3)

  if (c3) {
    return { city: p1, region: p2, country: c3 }
  }

  // Fallback: city = first, region = second, ignore the rest
  return { city: p1, region: p2, country: null }
}

/**
 * Small best-effort country normalizer.
 * This is NOT exhaustive — just a pragmatic mapping for common cases.
 *
 * New behaviour:
 *  - Looks at trailing pieces split by ",", "-", "/", "|" etc.
 *    so "Remote - US", "Remote / Canada" correctly resolve to
 *    United States / Canada.
 */
function normalizeCountry(raw: string): string | null {
  const cleaned = raw.trim()
  if (!cleaned) return null

  // Break into tokens on common separators, then scan from right to left.
  const tokens = cleaned
    .split(/[,\/\-|]/)
    .map((t) => t.trim())
    .filter(Boolean)

  // Helper to map a single token to a country (or null)
  const mapToken = (token: string): string | null => {
    const lower = token.toLowerCase()

    // Region-ish placeholders we *don't* want as country:
    if (
      lower.includes('emea') ||
      lower.includes('apac') ||
      lower.includes('latam') ||
      lower.includes('americas') ||
      lower.includes('europe') ||
      lower.includes('worldwide') ||
      lower.includes('anywhere')
    ) {
      return null
    }

    // If it has "remote", it's not a country
    if (lower.includes('remote')) return null

    if (/^(us|usa|united states|united states of america)$/i.test(token)) {
      return 'United States'
    }
    if (/^(uk|united kingdom|great britain|england|scotland)$/i.test(token)) {
      return 'United Kingdom'
    }
    if (lower === 'canada' || lower === 'ca') return 'Canada'
    if (lower === 'germany' || lower === 'de' || lower === 'deutschland') return 'Germany'
    if (lower === 'france' || lower === 'fr') return 'France'
    if (lower === 'netherlands' || lower === 'nl' || lower === 'holland') return 'Netherlands'
    if (lower === 'spain' || lower === 'es') return 'Spain'
    if (lower === 'italy' || lower === 'it') return 'Italy'
    if (lower === 'australia' || lower === 'au') return 'Australia'
    if (lower === 'new zealand' || lower === 'nz') return 'New Zealand'
    if (lower === 'sweden' || lower === 'se') return 'Sweden'
    if (lower === 'norway' || lower === 'no') return 'Norway'
    if (lower === 'denmark' || lower === 'dk') return 'Denmark'
    if (lower === 'finland' || lower === 'fi') return 'Finland'
    if (lower === 'switzerland' || lower === 'ch') return 'Switzerland'
    if (lower === 'ireland' || lower === 'ie') return 'Ireland'
    if (lower === 'poland' || lower === 'pl') return 'Poland'
    if (lower === 'portugal' || lower === 'pt') return 'Portugal'
    if (lower === 'brazil' || lower === 'br') return 'Brazil'
    if (lower === 'mexico' || lower === 'mx') return 'Mexico'
    if (lower === 'india' || lower === 'in') return 'India'
    if (lower === 'singapore' || lower === 'sg') return 'Singapore'

    // If it's one or two letters, probably a region/state (e.g., "CA", "TX", "NY")
    if (token.length <= 2) return null

    // As a fallback, if it looks like a real word with letters, use it as-is
    if (/[a-zA-Z]/.test(token)) {
      return token.trim()
    }

    return null
  }

  // Check tokens from right to left to pick the most specific trailing region/country
  for (let i = tokens.length - 1; i >= 0; i--) {
    const candidate = mapToken(tokens[i])
    if (candidate) {
      return candidate
    }
  }

  // Nothing matched
  return null
}
