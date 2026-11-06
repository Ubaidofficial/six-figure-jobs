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

// Every officially assigned ISO 3166-1 alpha-2 code (249). A two-letter string that is not on this list ("HQ", "SF") is
// not a country, whatever it looks like.
export const ISO_COUNTRY_CODES: ReadonlySet<string> = new Set(
  (
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO ' +
    'JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR ' +
    'MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO ' +
    'RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV ' +
    'TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
  ).split(' '),
)

/** "au", " AU ", "UK" -> "AU" / "GB". Anything that is not an ISO 3166-1 alpha-2 code (null, "None", "USA", "HQ") -> null. */
export function normalizeCountryCode(code: unknown): string | null {
  if (typeof code !== 'string') return null
  const cc = code.trim().toUpperCase()
  if (cc === 'UK') return 'GB'
  return ISO_COUNTRY_CODES.has(cc) ? cc : null
}

/** True when `public/flags/<code>.svg` exists. */
export function hasFlag(code: unknown): boolean {
  const cc = normalizeCountryCode(code)
  return cc !== null && cc in COUNTRY_NAMES
}

/** English country name; null when the value is not an ISO country code. */
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
  return cc // a real code this runtime has no name for
}
