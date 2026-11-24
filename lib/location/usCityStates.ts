// lib/location/usCityStates.ts
//
// The state of a US city named without one ("Mountain View", "Seattle"), for JobPosting addressRegion. Hand-picked
// (2026-11-24) from general knowledge, not from a dataset: only names that in US job postings mean one city. A wrong
// state is worse than none, so a name another US city of some size shares is left out on purpose, for example
// Portland (OR, ME), Columbus (OH, GA), Kansas City (MO, KS), Arlington (VA, TX), Springfield, Richmond (VA, CA),
// Bellevue (WA, NE), Redmond (WA, OR), Rochester (NY, MN), Aurora, Pasadena, Glendale, Alexandria, Lexington,
// Wilmington, Charleston, Greenville, Columbia, Bloomington, Plymouth, Dublin, Newark, Princeton, Englewood, Henderson,
// Huntsville, Madison, Everett, Watertown, Burlington, Quincy and Washington (the state). Add a city only when that
// holds for it.

const STATE_CITIES: Record<string, readonly string[]> = {
  AK: ['Anchorage'],
  AL: ['Birmingham'],
  AZ: ['Phoenix', 'Scottsdale', 'Tempe', 'Chandler', 'Mesa', 'Tucson'],
  CA: [
    'San Francisco', 'South San Francisco', 'San Francisco Bay Area', 'Silicon Valley', 'San Jose', 'Oakland',
    'Berkeley', 'Palo Alto', 'Mountain View', 'Sunnyvale', 'Santa Clara', 'Cupertino', 'Menlo Park', 'Redwood City',
    'San Mateo', 'Foster City', 'Milpitas', 'Fremont', 'Pleasanton', 'San Ramon', 'Emeryville', 'Burlingame',
    'San Bruno', 'Los Gatos', 'Walnut Creek', 'Livermore', 'Los Angeles', 'Santa Monica', 'Culver City', 'El Segundo',
    'Irvine', 'Long Beach', 'Newport Beach', 'Costa Mesa', 'Torrance', 'San Diego', 'Carlsbad', 'Sacramento',
    'Santa Barbara',
  ],
  CO: ['Denver', 'Boulder', 'Colorado Springs', 'Fort Collins', 'Broomfield'],
  CT: ['Stamford', 'Hartford', 'New Haven'],
  DC: ['Washington DC', 'District of Columbia'],
  FL: ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Fort Lauderdale', 'Boca Raton', 'Tallahassee', 'West Palm Beach', 'St. Petersburg'],
  GA: ['Atlanta', 'Alpharetta', 'Savannah'],
  HI: ['Honolulu'],
  IA: ['Des Moines'],
  ID: ['Boise'],
  IL: ['Chicago', 'Evanston', 'Naperville', 'Schaumburg', 'Oak Brook', 'Northbrook'],
  IN: ['Indianapolis'],
  KY: ['Louisville'],
  LA: ['New Orleans'],
  MA: ['Boston', 'Cambridge', 'Somerville', 'Waltham', 'Woburn', 'Framingham'],
  MD: ['Baltimore', 'Bethesda', 'Rockville', 'Silver Spring', 'Annapolis'],
  MI: ['Detroit', 'Ann Arbor', 'Grand Rapids'],
  MN: ['Minneapolis', 'St. Paul', 'Eden Prairie'],
  MO: ['St. Louis'],
  NC: ['Raleigh', 'Charlotte', 'Durham', 'Cary', 'Chapel Hill', 'Research Triangle Park', 'Wake Forest'],
  NE: ['Omaha'],
  NH: ['Nashua'],
  NJ: ['Jersey City', 'Hoboken'],
  NM: ['Albuquerque', 'Santa Fe'],
  NV: ['Las Vegas', 'Reno'],
  NY: ['New York', 'New York City', 'NYC', 'Manhattan', 'Brooklyn', 'Buffalo', 'White Plains', 'Armonk'],
  OH: ['Cleveland', 'Cincinnati', 'Dayton'],
  OK: ['Oklahoma City', 'Tulsa'],
  OR: ['Beaverton', 'Hillsboro'],
  PA: ['Philadelphia', 'Pittsburgh'],
  RI: ['Providence'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga'],
  TX: ['Austin', 'Dallas', 'Houston', 'San Antonio', 'Fort Worth', 'Plano', 'Irving', 'Frisco', 'Richardson', 'Round Rock', 'The Woodlands', 'El Paso'],
  UT: ['Salt Lake City', 'Lehi', 'Provo'],
  VA: ['Reston', 'Herndon', 'McLean', 'Tysons', 'Fairfax', 'Chantilly', 'Ashburn', 'Norfolk', 'Virginia Beach'],
  WA: ['Seattle', 'Kirkland', 'Tacoma', 'Spokane'],
}

/** Lower case, no accents or dots, "Saint"/"St" as "st": "St. Louis", "Saint Louis" and "st louis" are one key. */
function cityKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/^saint\s/, 'st ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STATE_BY_CITY = new Map(
  Object.entries(STATE_CITIES).flatMap(([state, cities]) => cities.map((city) => [cityKey(city), state] as const)),
)

/** The state code of a US city in the table above ("Mountain View" -> "CA"), else undefined. US places only. */
export function usStateOfCity(city: unknown): string | undefined {
  return typeof city === 'string' ? STATE_BY_CITY.get(cityKey(city)) : undefined
}
