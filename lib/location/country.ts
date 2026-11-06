// Country codes -> English names and flags, shared by every page that shows a country.
//
// Names: a fixed table for the countries we have flags for, so the server render and the browser always print the same
// text (Intl.DisplayNames can differ between Node's and the browser's ICU, e.g. "Czechia" / "Czech Republic");
// Intl.DisplayNames only fills in countries outside the table.
// Flags: `public/flags/<code>.svg`, one small file per country in the table (see public/flags/LICENSE.txt). They are
// images, not emoji, because Windows does not ship flag emoji: Chrome and Edge on Windows show the two letters.

export const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  AU: 'Australia',
  NL: 'Netherlands',
  IN: 'India',
  ES: 'Spain',
  IE: 'Ireland',
  IT: 'Italy',
  PT: 'Portugal',
  BR: 'Brazil',
  CH: 'Switzerland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  NZ: 'New Zealand',
  SG: 'Singapore',
  BE: 'Belgium',
  AT: 'Austria',
  PL: 'Poland',
  CZ: 'Czech Republic',
  JP: 'Japan',
  KR: 'South Korea',
  MX: 'Mexico',
  AR: 'Argentina',
  CL: 'Chile',
  HK: 'Hong Kong',
  IL: 'Israel',
  AE: 'United Arab Emirates',
}

// Short forms for tight spaces (job cards).
const SHORT_NAMES: Record<string, string> = { US: 'USA', GB: 'UK' }

/** "au", " AU ", "UK" -> "AU" / "GB"; anything that is not two letters (null, "None", "USA") -> null. ISO is GB, not UK. */
export function normalizeCountryCode(code: unknown): string | null {
  if (typeof code !== 'string') return null
  const cc = code.trim().toUpperCase()
  if (cc === 'UK') return 'GB'
  return /^[A-Z]{2}$/.test(cc) ? cc : null
}

/** True when `public/flags/<code>.svg` exists. */
export function hasFlag(code: unknown): boolean {
  const cc = normalizeCountryCode(code)
  return cc !== null && cc in COUNTRY_NAMES
}

/** English country name; the uppercase code when the name is unknown; null for something that is not a code. */
export function countryName(code: unknown, opts?: { short?: boolean }): string | null {
  const cc = normalizeCountryCode(code)
  if (!cc) return null
  if (opts?.short && SHORT_NAMES[cc]) return SHORT_NAMES[cc]
  if (COUNTRY_NAMES[cc]) return COUNTRY_NAMES[cc]
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(cc)
    if (name && name !== cc && !/^unknown/i.test(name)) return name
  } catch {
    // old runtimes: fall through to the code
  }
  return cc
}
