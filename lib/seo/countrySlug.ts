// lib/seo/countrySlug.ts
// Helpers for mapping ISO country codes to SEO-friendly slugs + display names.

export const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  DE: 'Germany',
  CH: 'Switzerland',
  FR: 'France',
  IE: 'Ireland',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  AU: 'Australia',
  NZ: 'New Zealand',
  // you can extend this list as needed; unknown codes will fall back to the raw code
}

export const COUNTRY_CODE_TO_SLUG: Record<string, string> = {
  US: 'united-states',
  CA: 'canada',
  GB: 'united-kingdom',
  DE: 'germany',
  CH: 'switzerland',
  FR: 'france',
  IE: 'ireland',
  ES: 'spain',
  IT: 'italy',
  NL: 'netherlands',
  SE: 'sweden',
  NO: 'norway',
  DK: 'denmark',
  FI: 'finland',
  AU: 'australia',
  NZ: 'new-zealand',
}

// Reverse lookup: slug → ISO code
export const COUNTRY_SLUG_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_CODE_TO_SLUG).map(([code, slug]) => [slug, code]),
)

/**
 * Convert ISO country code ("US") to SEO slug ("united-states").
 * Returns null if the code is unknown.
 */
export function countryCodeToSlug(code?: string | null): string | null {
  if (!code) return null
  const upper = code.toUpperCase()
  return COUNTRY_CODE_TO_SLUG[upper] ?? null
}

/**
 * Convert ISO country code ("US") to human-readable name ("United States").
 * Falls back to the raw uppercased code if we don't have a mapping.
 */
export function countryCodeToName(code?: string | null): string {
  if (!code) return ''
  const upper = code.toUpperCase()
  return COUNTRY_CODE_TO_NAME[upper] ?? upper
}

/**
 * Convert a slug like "united-states" back to ISO code "US".
 * Returns null for unknown slugs.
 */
export function slugToCountryCode(slug?: string | null): string | null {
  if (!slug) return null
  const lower = slug.toLowerCase()
  return COUNTRY_SLUG_TO_CODE[lower] ?? null
}

/**
 * True if we recognize this country code in our map.
 */
export function isKnownCountryCode(code?: string | null): boolean {
  if (!code) return false
  return !!COUNTRY_CODE_TO_NAME[code.toUpperCase()]
}
