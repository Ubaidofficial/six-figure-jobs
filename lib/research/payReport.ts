// lib/research/payReport.ts
//
// The monthly "Six-Figure Job Pay Report" (page: /high-paying-jobs-report). One permanent URL that is refreshed each month, so
// the links it earns build up on one page instead of being split across dated posts.
//
// HOW TO REFRESH (monthly):
//   1. Run the "30-day research report" workflow (Actions tab) with basis = posted_or_created. It is read-only.
//   2. Copy its tables into PAY_REPORT below: headline, bands, seniority, roles, arrangement, cities, employers, concentration.
//   3. Set month, monthTag, publishedAt (first edition only) and updatedAt; update `collected` and `window`.
//   4. Re-read the "Method and limits" text on the page: if a source or rule changed, say so.
//   5. Run __tests__/research/payReport.test.ts: it checks the bands add up, the tables are sorted and the sample floors hold.
// Every number on the page comes from this file; nothing is typed into the page itself.
//
// Method (keep it identical month to month, so editions can be compared): validated USD salary with confidence >= 80 and an annual
// figure BELOW 600,000 (exactly 600,000 is a clamp); annual = midpoint of the advertised minimum and maximum; roles need 50
// listings, cities 8 listings from 10 employers; job-board aggregators and recruiting firms are left out of employer lists.

import { fitTitle } from '../seo/metaText'
import { SITE_NAME } from '../seo/site'

export type PayRow = {
  label: string
  listings: number
  /** Distinct employers behind the listings, when the query gave it. */
  employers?: number
  /** Median advertised midpoint in US dollars. */
  median: number
}

export const MIN_ROLE_LISTINGS = 50
export const MIN_CITY_EMPLOYERS = 10

export const PAY_REPORT = {
  path: '/high-paying-jobs-report',
  /** Shown on the page and in the title. */
  month: 'November 2026',
  /** Same month as the `[Nov 2026]` tag on the site's other titles. */
  monthTag: 'Nov 2026',
  publishedAt: '2026-11-15',
  updatedAt: '2026-11-15',
  /** What the data covers, in words, for the method section. */
  collected: '5 to 15 November 2026',
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
  ] as PayRow[],

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
  ] as PayRow[],

  arrangement: [
    { label: 'Remote', listings: 3131, employers: 908, median: 176000 },
    { label: 'On-site', listings: 11055, employers: 1882, median: 185000 },
    { label: 'Hybrid', listings: 640, employers: 70, median: 230000 },
  ] as PayRow[],
  remoteSharePct: 20.3,
  visaSharePct: 1.2,

  /** Cities with at least 8 listings from at least MIN_CITY_EMPLOYERS employers, descending by median. */
  cities: [
    { label: 'San Francisco', listings: 1063, employers: 236, median: 225000 },
    { label: 'San Mateo', listings: 172, employers: 12, median: 220020 },
    { label: 'Mountain View', listings: 109, employers: 29, median: 219000 },
    { label: 'Sunnyvale', listings: 59, employers: 14, median: 214700 },
    { label: 'San Jose', listings: 483, employers: 40, median: 211425 },
  ] as PayRow[],
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
  ] as PayRow[],
  concentration: { top1Pct: 8.3, top5Pct: 25.1, top20Pct: 40.6 },

  /** One sentence about the highest advertised ranges, with the date they were read. */
  highestRanges:
    'OpenAI advertised ranges of $459K to $536K for a principal software engineer and a head of data science role, and $401K to $510K for several security and data science roles. These are the ranges shown in the postings on 15 November 2026 and may have changed since.',
}

export type PayReport = typeof PAY_REPORT

export const usd = (n: number): string => `$${n.toLocaleString('en-US')}`

export const PAY_REPORT_HEADING = 'Six-Figure Job Pay Report'

/** `<title>`: the report's name with the edition's month tag, like the site's other dated titles. */
export function payReportTitle(r: PayReport = PAY_REPORT): string {
  return fitTitle([`${PAY_REPORT_HEADING} [${r.monthTag}] | ${SITE_NAME}`, `${PAY_REPORT_HEADING} [${r.monthTag}]`, PAY_REPORT_HEADING])
}

/** Meta description, 130-155 characters. */
export function payReportDescription(r: PayReport = PAY_REPORT): string {
  return `${r.headline.listings.toLocaleString('en-US')} six-figure job listings, median advertised pay ${usd(r.headline.medianMidpoint)}. Best-paid roles, remote vs on-site pay and top cities. Updated monthly.`
}

/** The key findings as sentences, built from the data so they cannot disagree with the tables. */
export function payReportFindings(r: PayReport = PAY_REPORT): string[] {
  const h = r.headline
  const below200 = Math.round(r.bands[0].pct + r.bands[1].pct)
  const top = r.roles[0]
  const remote = r.arrangement.find((a) => a.label === 'Remote')!
  const onsite = r.arrangement.find((a) => a.label === 'On-site')!
  return [
    `The median advertised midpoint is ${usd(h.medianMidpoint)} across ${h.listings.toLocaleString('en-US')} listings from ${h.employers.toLocaleString('en-US')} named employers. The median advertised minimum is ${usd(h.medianMinimum)}, and counting each employer with three or more listings once, the median is ${usd(h.medianOfEmployerMedians)}.`,
    `About ${below200}% of listings advertise a midpoint below $200,000, and ${r.bands[3].pct}% advertise $300,000 or more.`,
    `${top.label} is the best-paid role with a large sample: a median of ${usd(top.median)} across ${top.listings} listings from ${top.employers} employers.`,
    `Remote listings advertise a median of ${usd(remote.median)}, against ${usd(onsite.median)} for on-site listings.`,
    `The cities with the highest medians are all in the ${r.citiesRegion}, led by ${r.cities[0].label} at ${usd(r.cities[0].median)}.`,
    `The 20 largest employers account for ${r.concentration.top20Pct}% of the listings, so large technology employers shape these figures.`,
  ]
}

export function payReportFaq(r: PayReport = PAY_REPORT): Array<{ question: string; answer: string }> {
  const h = r.headline
  const remote = r.arrangement.find((a) => a.label === 'Remote')!
  const onsite = r.arrangement.find((a) => a.label === 'On-site')!
  const hybrid = r.arrangement.find((a) => a.label === 'Hybrid')!
  const [first, second, third, fourth] = r.roles
  return [
    {
      question: 'What is the median advertised salary for six-figure jobs?',
      answer: `Across ${h.listings.toLocaleString('en-US')} listings from named employers with a validated USD salary, the median advertised midpoint is ${usd(h.medianMidpoint)} and the median advertised minimum is ${usd(h.medianMinimum)}. Counting each employer with three or more listings once, the median is ${usd(h.medianOfEmployerMedians)}. These are advertised ranges, not what people are paid.`,
    },
    {
      question: 'Which six-figure roles pay the most?',
      answer: `Among roles with at least ${MIN_ROLE_LISTINGS} listings, ${first.label.toLowerCase()}s lead with a median advertised midpoint of ${usd(first.median)}, followed by ${second.label.toLowerCase()}s (${usd(second.median)}), ${third.label.toLowerCase()}s (${usd(third.median)}) and ${fourth.label.toLowerCase()}s (${usd(fourth.median)}).`,
    },
    {
      question: 'Do remote six-figure jobs pay less than on-site jobs?',
      answer: `In this data, remote listings advertise a lower median (${usd(remote.median)}) than on-site listings (${usd(onsite.median)}). Hybrid listings are highest (${usd(hybrid.median)}) but come from only ${hybrid.employers} employers, so read that figure with caution.`,
    },
    {
      question: 'Where does this data come from?',
      answer: `It comes from listings we collected between ${r.collected} from company career pages and job boards. Only USD-priced listings with a validated salary of $100,000 or more are included, so it describes six-figure listings, not the whole job market.`,
    },
  ]
}
