// lib/research/method.ts
//
// The rules behind the Six-Figure Job Pay Report, in one place. The research script (scripts/research-30d-stats.ts) builds
// its SQL from these values and the methodology page (/high-paying-jobs-report/method) prints them, so the page can only
// say what the query does. Change a rule here, bump METHOD_VERSION, and add a line to METHOD_CHANGELOG: editions made
// under different versions should not be compared without saying so.

export const METHOD_VERSION = '1.0'

/** The methodology page. */
export const METHOD_PATH = '/high-paying-jobs-report/method'

/** A listing's salary counts only when it was validated with at least this confidence (the gate the /salary pages use). */
export const MIN_CONFIDENCE = 80

/** Pay is read in US dollars only (no exchange-rate guess). An annual figure at exactly this value is a clamp, not a real figure. */
export const USD_CAP = 600_000

/** Sample floors that are not shown in the tables themselves: employers behind each side of a same-role comparison, and behind a skill. */
export const MIN_SAME_ROLE_EMPLOYERS = 5
export const MIN_SKILL_EMPLOYERS = 10

/** Job boards and aggregators list other employers' jobs under their own name; they are not employers. SQL ILIKE patterns. */
export const AGGREGATOR_PATTERNS = [
  'jobgether%',
  'jooble%',
  'adzuna%',
  'talent.com%',
  'lensa%',
  'jobrapido%',
  'careerjet%',
  'ziprecruiter%',
  'simplyhired%',
  'whatjobs%',
  'neuvoo%',
  'remote rocketship%',
  'remoterocketship%',
] as const

/**
 * Cities counted as the San Francisco Bay Area for the sensitivity check "excluding the Bay Area". A listing with no city is
 * kept. The list is deliberately explicit: a reader can disagree with it, which is better than a rule they cannot see.
 */
export const BAY_AREA_CITIES = [
  'San Francisco',
  'South San Francisco',
  'San Mateo',
  'Redwood City',
  'Menlo Park',
  'Palo Alto',
  'Mountain View',
  'Sunnyvale',
  'Santa Clara',
  'Cupertino',
  'Milpitas',
  'San Jose',
  'Fremont',
  'Oakland',
  'San Bruno',
] as const

export const METHOD_CHANGELOG: Array<{ version: string; date: string; change: string }> = [
  {
    version: '1.0',
    date: '2026-11-15',
    change:
      'First published method (November 2026 edition). Validated USD salary with confidence of at least 80, annual figure below $600,000, midpoint of minimum and maximum, medians, sample floors for roles and cities, aggregators left out of employer lists.',
  },
]

/** What the terms on the report and the columns of its CSV mean. */
export const DATA_DICTIONARY: Array<{ term: string; meaning: string }> = [
  { term: 'Listing', meaning: 'One job posting we collected and stored. It is not one opening: the same role advertised in several places can be counted more than once.' },
  { term: 'Validated salary', meaning: `A pay figure that passed our salary checks, with a confidence of at least ${MIN_CONFIDENCE} out of 100. The report uses the stored yearly minimum and maximum; a listing whose figure did not pass the checks is not counted.` },
  { term: 'Advertised minimum / maximum', meaning: 'The lowest and highest figure in the posting\'s pay range, per year, in US dollars.' },
  { term: 'Advertised midpoint', meaning: 'Half-way between the advertised minimum and maximum. When a posting gives one figure, that figure. It describes the posting, not the offer or what anyone is paid.' },
  { term: 'Median', meaning: 'The middle value: half the listings advertise more, half less. The report uses medians because a few very high ranges would pull an average up.' },
  { term: 'Employers', meaning: 'Distinct company names behind a group of listings. A row with many listings but few employers is shaped by those few.' },
  { term: 'Seniority', meaning: 'The experience level stored for the listing (Senior, Staff, Director and so on). Many listings carry none, so seniority tables describe only those that do.' },
  { term: 'Work arrangement', meaning: 'Remote, hybrid or on-site as stored for the listing, from the source or, when the source gives none, from a sentence in the posting that says so.' },
  { term: 'Listings, in the CSV (listings)', meaning: 'Number of listings in the group.' },
  { term: 'value_usd, in the CSV', meaning: 'The figure for the row in US dollars: the median advertised midpoint, unless the row\'s label says otherwise (the headline rows name what they are).' },
  { term: 'share_pct, in the CSV', meaning: 'A percentage, where the row is a share (salary bands, range-width rows).' },
  { term: 'table, in the CSV', meaning: 'Which table of the report the row belongs to: headline, salary_band, seniority, role, work_arrangement, city, employer and, when an edition has them, skill, same_role_remote, same_role_onsite, range_width, sensitivity, funnel.' },
]
