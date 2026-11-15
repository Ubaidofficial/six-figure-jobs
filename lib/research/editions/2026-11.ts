// lib/research/editions/2026-11.ts
//
// The November 2026 edition of the Six-Figure Job Pay Report, frozen: do not edit these figures after publication except to
// correct a mistake, and then add a line to `corrections` (shown on the page) instead of changing them silently.
// To publish a new edition, add a new file here, put it FIRST in PAY_REPORT_EDITIONS (lib/research/payReport.ts), and leave
// this one as it is: it keeps its own dated address, so links to it keep showing the figures they cited.
import type { PayReportData } from '../payReport'

export const EDITION_2026_11: PayReportData = {
  slug: '2026-11',
  /** Shown on the page and in the title. */
  month: 'November 2026',
  /** Same month as the `[Nov 2026]` tag on the site's other titles. */
  monthTag: 'Nov 2026',
  publishedAt: '2026-11-15',
  updatedAt: '2026-11-15',
  /** What the data covers, in words, for the method section. */
  collected: '5 to 15 November 2026',
  collectedISO: '2026-11-05/2026-11-15',
  window: 'posted in the 30 days before 15 November 2026 (or, when a posting has no date, collected in that period)',

  headline: {
    /** Validated USD listings from named employers (aggregators left out). */
    listings: 15212,
    employers: 2639,
    medianMidpoint: 185500,
    medianMinimum: 155520,
    /** Median of per-employer medians, employers with three or more listings. */
    medianOfEmployerMedians: 180000,
    /** All validated USD listings, including those that arrive through aggregators; the tables below use this base. */
    allListings: 15456,
  },

  bands: [
    { label: '$100,000 to $149,999', listings: 3473, pct: 22.5 },
    { label: '$150,000 to $199,999', listings: 5722, pct: 37.0 },
    { label: '$200,000 to $299,999', listings: 5216, pct: 33.7 },
    { label: '$300,000 and above', listings: 1045, pct: 6.8 },
  ],

  /** Stored experience level; about 8,300 of the listings carry one. Ascending by median. */
  seniority: [
    { label: 'Senior', listings: 4634, median: 185000 },
    { label: 'Lead', listings: 603, median: 194500 },
    { label: 'Director', listings: 1066, median: 219950 },
    { label: 'Principal', listings: 733, median: 220000 },
    { label: 'Staff', listings: 1029, median: 227300 },
    { label: 'VP', listings: 150, median: 253274 },
  ],

  /** Roles with at least MIN_ROLE_LISTINGS listings, descending by median. */
  roles: [
    { label: 'Principal software engineer', listings: 116, employers: 55, median: 278500 },
    { label: 'Senior engineering manager', listings: 65, employers: 52, median: 256000 },
    { label: 'Engineering director', listings: 118, employers: 78, median: 254935 },
    { label: 'Staff software engineer', listings: 237, employers: 119, median: 250000 },
    { label: 'Sales director', listings: 97, employers: 65, median: 240000 },
    { label: 'Senior legal counsel', listings: 55, employers: 28, median: 238500 },
    { label: 'Principal product manager', listings: 83, employers: 46, median: 230600 },
    { label: 'Engineering manager', listings: 226, employers: 123, median: 220000 },
    { label: 'Senior machine learning engineer', listings: 56, employers: 33, median: 219698 },
    { label: 'Staff product manager', listings: 74, employers: 52, median: 219525 },
    { label: 'Marketing director', listings: 62, employers: 48, median: 213750 },
    { label: 'Solutions engineer', listings: 83, employers: 38, median: 212000 },
  ],

  arrangement: [
    { label: 'Remote', listings: 3131, employers: 908, median: 176000 },
    { label: 'On-site', listings: 11055, employers: 1882, median: 185000 },
    { label: 'Hybrid', listings: 640, employers: 70, median: 230000 },
  ],
  remoteSharePct: 20.3,
  visaSharePct: 1.2,

  /** Cities with at least 8 listings from at least MIN_CITY_EMPLOYERS employers, descending by median. */
  cities: [
    { label: 'San Francisco', listings: 1063, employers: 236, median: 225000 },
    { label: 'San Mateo', listings: 172, employers: 12, median: 220020 },
    { label: 'Mountain View', listings: 109, employers: 29, median: 219000 },
    { label: 'Sunnyvale', listings: 59, employers: 14, median: 214700 },
    { label: 'San Jose', listings: 483, employers: 40, median: 211425 },
  ],
  /** Said in words under the cities table: true of every city listed above. */
  citiesRegion: 'San Francisco Bay Area',

  countries: { usSharePct: 93, usMedian: 185900, canadaListings: 278, canadaMedian: 189050 },

  /** Largest employers by listings, recruiting and staffing firms left out. Descending by listings. */
  employers: [
    { label: 'Capital One', listings: 1255, median: 188350 },
    { label: 'NVIDIA', listings: 1231, median: 204000 },
    { label: 'Anduril Industries', listings: 607, median: 171500 },
    { label: 'Cisco', listings: 478, median: 207175 },
    { label: 'Intel', listings: 250, median: 194500 },
    { label: 'Visa', listings: 234, median: 203950 },
    { label: 'OpenAI', listings: 216, median: 278500 },
    { label: 'Micron', listings: 182, median: 212750 },
    { label: 'Workday', listings: 171, median: 196300 },
    { label: 'Mastercard', listings: 159, median: 200500 },
  ],
  concentration: { top1Pct: 8.3, top5Pct: 25.1, top20Pct: 40.6 },

  /** One sentence about the highest advertised ranges, with the date they were read. */
  highestRanges:
    'OpenAI advertised ranges of $459K to $536K for a principal software engineer and a head of data science role, and $401K to $510K for several security and data science roles. These are the ranges shown in the postings on 15 November 2026 and may have changed since.',

  /** Corrections made after publication, newest first. Empty = none so far. */
  corrections: [],
}
