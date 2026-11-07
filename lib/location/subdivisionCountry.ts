// lib/location/subdivisionCountry.ts
//
// The country of a job whose location is written without a country name. The location normalizer only reads a
// country when the text ends with one ("Munich, Germany"); freehire and many European employers write "Nürnberg,
// Bayern" or "Zürich, Kanton Zürich", which left the job with no country, so it never appeared on its country page.
//
// Deliberately narrow: only names that belong to one country. A bare city that is also a US town ("Berlin", "Vienna",
// "Bremen") is left alone, and only the LAST comma segment is read ("Berlin, NH" has no match, not Germany).

const GERMAN_STATES = [
  'baden-wurttemberg', 'bayern', 'bavaria', 'brandenburg', 'hessen', 'hesse', 'mecklenburg-vorpommern',
  'mecklenburg-western pomerania', 'niedersachsen', 'lower saxony', 'nordrhein-westfalen', 'north rhine-westphalia',
  'rheinland-pfalz', 'rhineland-palatinate', 'saarland', 'sachsen', 'saxony', 'sachsen-anhalt', 'saxony-anhalt',
  'schleswig-holstein', 'thuringen', 'thuringia',
]

const AUSTRIAN_STATES = [
  'wien', 'niederosterreich', 'lower austria', 'oberosterreich', 'upper austria', 'steiermark', 'styria', 'tirol',
  'vorarlberg', 'karnten', 'carinthia', 'burgenland',
]

const BY_SUBDIVISION = new Map<string, string>([
  ...GERMAN_STATES.map((s): [string, string] => [s, 'DE']),
  ...AUSTRIAN_STATES.map((s): [string, string] => [s, 'AT']),
])

/** Lower case, accents removed ("Zürich" -> "zurich"), spaces collapsed. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Country code for `locationText` when it names a German or Austrian state or a Swiss canton ("Kanton X", "Canton of
 * X", "Canton de X"), else null. Only the last comma-separated segment counts.
 */
export function countryCodeFromSubdivision(locationText: string | null | undefined): string | null {
  if (!locationText) return null
  const last = fold(locationText.split(',').pop() ?? '')
  if (!last) return null
  if (/^(kanton|canton)( of| de| du)? \S/.test(last)) return 'CH'
  return BY_SUBDIVISION.get(last) ?? null
}

/**
 * Country when the text does not end in a country name: a state or canton, else Switzerland for a job paid in Swiss
 * francs (the franc is used by essentially nothing else), else null. Euro and dollar salaries say nothing about the
 * country, so they get no fallback.
 */
export function countryCodeFromContext(
  locationText: string | null | undefined,
  salaryCurrency: string | null | undefined,
): string | null {
  const fromSubdivision = countryCodeFromSubdivision(locationText)
  if (fromSubdivision) return fromSubdivision
  return String(salaryCurrency ?? '').trim().toUpperCase() === 'CHF' ? 'CH' : null
}
