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

// The two city-states as written in full (found 2026-11-25: "Bremen, Freie Hansestadt Bremen"). Bare "Bremen" and
// "Hamburg" stay out: both are also US towns.
const GERMAN_CITY_STATES = ['freie hansestadt bremen', 'freie und hansestadt hamburg']

// France's regions, the 13 of 2016 and the 22 before them, which freehire and French employers still write ("Lyon,
// Rhône-Alpes", "Toulouse, Midi-Pyrénées"; 2026-11-25, missing_country quality check: about 110 listed jobs, paid in
// euros, which names no country). Left out as too ambiguous on their own: "Centre", "Lorraine".
const FRENCH_REGIONS = [
  'auvergne-rhone-alpes', 'rhone-alpes', 'auvergne', 'bretagne', 'brittany', 'occitanie', 'midi-pyrenees',
  'languedoc-roussillon', 'hauts-de-france', 'nord-pas-de-calais', 'picardie', "provence-alpes-cote d'azur",
  "provence-alpes-cotes d'azur", 'pays de la loire', 'nouvelle-aquitaine', 'aquitaine', 'limousin', 'poitou-charentes',
  'ile-de-france', 'grand est', 'alsace', 'champagne-ardenne', 'bourgogne-franche-comte', 'bourgogne', 'franche-comte',
  'centre-val de loire', 'normandie', 'basse-normandie', 'haute-normandie', 'corse',
]

/** The lookup key: folded, with hyphens and apostrophes read as spaces ("Pays-de-la-Loire" = "Pays de la Loire"). */
const key = (value: string) => fold(value).replace(/[-'’]/g, ' ').replace(/\s+/g, ' ').trim()

const BY_SUBDIVISION = new Map<string, string>([
  ...GERMAN_STATES.map((s): [string, string] => [key(s), 'DE']),
  ...GERMAN_CITY_STATES.map((s): [string, string] => [key(s), 'DE']),
  ...AUSTRIAN_STATES.map((s): [string, string] => [key(s), 'AT']),
  ...FRENCH_REGIONS.map((s): [string, string] => [key(s), 'FR']),
])

// A German district: "Landkreis Böblingen", "München (Kreis)", "Hohenlohekreis", "Rhein-Sieg-Kreis" (not "Kreis" alone).
const GERMAN_DISTRICT = /^landkreis \S|\(kreis\)$|[a-z-]kreis$/

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
 * Country code for `locationText` when it names a German or Austrian state, a German district, a French region or a
 * Swiss canton ("Kanton X", "Canton of X", "Canton de X"), else null. Only the last comma-separated segment counts.
 */
export function countryCodeFromSubdivision(locationText: string | null | undefined): string | null {
  if (!locationText) return null
  const last = fold(locationText.split(',').pop() ?? '')
  if (!last) return null
  if (/^(kanton|canton)( of| de| du)? \S/.test(last)) return 'CH'
  if (GERMAN_DISTRICT.test(last)) return 'DE'
  // "Bundesland Wien": the word for "federal state" before its name.
  return BY_SUBDIVISION.get(key(last.replace(/^(bundesland|land) /, ''))) ?? null
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
