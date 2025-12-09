// lib/seo/countrySlug.ts
// Map country codes to SEO-friendly full-name slugs (lowercase, hyphenated).

const CODE_TO_SLUG: Record<string, string> = {
  US: 'united-states',
  CA: 'canada',
  GB: 'united-kingdom',
  IE: 'ireland',
  DE: 'germany',
  FR: 'france',
  ES: 'spain',
  NL: 'netherlands',
  SE: 'sweden',
  NO: 'norway',
  DK: 'denmark',
  BE: 'belgium',
  AT: 'austria',
  FI: 'finland',
  CH: 'switzerland',
  SG: 'singapore',
  AU: 'australia',
  NZ: 'new-zealand',
}

const SLUG_TO_CODE: Record<string, string> = Object.entries(CODE_TO_SLUG).reduce(
  (acc, [code, slug]) => {
    acc[slug] = code
    return acc
  },
  {} as Record<string, string>
)

export function countryCodeToSlug(code: string): string {
  const upper = code.toUpperCase()
  return CODE_TO_SLUG[upper] ?? upper.toLowerCase()
}

export function countrySlugToCode(slug: string): string {
  const lower = slug.toLowerCase()
  return SLUG_TO_CODE[lower] ?? slug.toUpperCase()
}

const CODE_TO_NAME: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  IE: 'Ireland',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  NL: 'Netherlands',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  BE: 'Belgium',
  AT: 'Austria',
  FI: 'Finland',
  CH: 'Switzerland',
  SG: 'Singapore',
  AU: 'Australia',
  NZ: 'New Zealand',
}

export function countryCodeToName(code: string): string {
  const upper = code.toUpperCase()
  return CODE_TO_NAME[upper] ?? code
}
