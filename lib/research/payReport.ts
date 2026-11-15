// lib/research/payReport.ts
//
// The monthly "Six-Figure Job Pay Report" (page: /high-paying-jobs-report). One permanent URL that always shows the latest
// edition, so the links it earns build up on one page; every edition also keeps its own dated, frozen address
// (/high-paying-jobs-report/2026-11) so a link or a citation keeps showing the figures it quoted.
//
// HOW TO PUBLISH A NEW EDITION (monthly):
//   1. Run the "30-day research report" workflow (Actions tab) with basis = posted_or_created. It is read-only.
//   2. Copy lib/research/editions/<last month>.ts to lib/research/editions/<this month>.ts and paste its tables into the copy:
//      headline, bands, seniority, roles, arrangement, cities, employers, concentration, and (if the run has them, and they
//      meet the sample floors) rangeWidth, sameRole and skills. Delete an optional block rather than keep last month's.
//   3. Set slug, month, monthTag, publishedAt, updatedAt, collected, window. Write `sinceLastEdition`: one sentence saying
//      whether the method or sources changed, so readers know if the trend table compares like with like.
//   4. Add the new edition FIRST in PAY_REPORT_EDITIONS below. Leave the old file as it is.
//   5. Re-read the "Method and limits" text on the page: if a source or rule changed, say so.
//   6. Run __tests__/research/payReport.test.ts: it checks the bands add up, the tables are sorted, the sample floors hold,
//      the editions are ordered and the CSV matches the tables.
// Every number on the page comes from the edition files; nothing is typed into the page itself.
//
// Method (keep it identical month to month, so editions can be compared): validated USD salary with confidence >= 80 and an annual
// figure BELOW 600,000 (exactly 600,000 is a clamp); annual = midpoint of the advertised minimum and maximum; roles need 50
// listings, cities 8 listings from 10 employers; job-board aggregators and recruiting firms are left out of employer lists.

import { fitTitle } from '../seo/metaText'
import { SITE_NAME, getSiteUrl } from '../seo/site'
import { EDITION_2026_11 } from './editions/2026-11'

export type PayRow = {
  label: string
  listings: number
  /** Distinct employers behind the listings, when the query gave it. */
  employers?: number
  /** Median advertised midpoint in US dollars. */
  median: number
}

/** How wide the advertised ranges are: (maximum - minimum) against the minimum, among listings that state both ends. */
export type RangeWidth = {
  /** Listings whose range has both ends and a maximum above the minimum. */
  ranged: number
  /** All validated USD listings in the window (the base of the tables). */
  of: number
  medianWidthPct: number
  medianWidthUsd: number
  /** Share of the ranged listings whose maximum is at least 1.5 times the minimum. */
  pctWiderThan50: number
}

/** One role that has enough remote AND on-site listings to compare like with like. */
export type SameRoleRow = {
  label: string
  remote: { listings: number; employers: number; median: number }
  onsite: { listings: number; employers: number; median: number }
}

export type Correction = { date: string; text: string }

export type PayReportData = {
  /** `YYYY-MM`: the edition's dated address and file name. */
  slug: string
  /** Shown on the page and in the title. */
  month: string
  /** Same month as the `[Nov 2026]` tag on the site's other titles. */
  monthTag: string
  publishedAt: string
  updatedAt: string
  /** What the data covers, in words, for the method section. */
  collected: string
  window: string
  headline: {
    /** Validated USD listings from named employers (aggregators left out). */
    listings: number
    employers: number
    medianMidpoint: number
    medianMinimum: number
    /** Median of per-employer medians, employers with three or more listings. */
    medianOfEmployerMedians: number
    /** All validated USD listings, including those that arrive through aggregators; the tables below use this base. */
    allListings: number
  }
  bands: Array<{ label: string; listings: number; pct: number }>
  /** Stored experience level, ascending by median. */
  seniority: PayRow[]
  /** Roles with at least MIN_ROLE_LISTINGS listings, descending by median. */
  roles: PayRow[]
  arrangement: PayRow[]
  remoteSharePct: number
  visaSharePct: number
  /** Cities with at least 8 listings from at least MIN_CITY_EMPLOYERS employers, descending by median. */
  cities: PayRow[]
  /** Said in words under the cities table: true of every city listed. */
  citiesRegion: string
  countries: { usSharePct: number; usMedian: number; canadaListings: number; canadaMedian: number }
  /** Largest employers by listings, recruiting and staffing firms left out. Descending by listings. */
  employers: PayRow[]
  concentration: { top1Pct: number; top5Pct: number; top20Pct: number }
  /** One sentence about the highest advertised ranges, with the date they were read. */
  highestRanges: string
  /** Optional: shown only when the edition has them (they come from the research script's extra queries). */
  rangeWidth?: RangeWidth
  sameRole?: SameRoleRow[]
  /** Skills named in the listings with at least MIN_SKILL_LISTINGS listings, descending by median. */
  skills?: PayRow[]
  /** One sentence: did the method or the sources change since the previous edition? Needed from the second edition on. */
  sinceLastEdition?: string
  /** Corrections made after publication, newest first. Empty = none so far. */
  corrections: Correction[]
}

export const MIN_ROLE_LISTINGS = 50
export const MIN_CITY_EMPLOYERS = 10
export const MIN_SAME_ROLE_LISTINGS = 20
export const MIN_SKILL_LISTINGS = 50

/** Every edition, newest first. Old editions stay here for good: each keeps its own address. */
export const PAY_REPORT_EDITIONS: PayReportData[] = [EDITION_2026_11]

export const PAY_REPORT_PATH = '/high-paying-jobs-report'

/** The latest edition, on the permanent path. */
export const PAY_REPORT = { ...PAY_REPORT_EDITIONS[0], path: PAY_REPORT_PATH }

export type PayReport = PayReportData

/** Who is named as the author. Leave null until the owner names a person: the page then credits the site, which is true. */
export const REPORT_AUTHOR: { name: string; role?: string; url?: string } | null = null

/** Where corrections and press questions go: an address the site already publishes (see /about). */
export const REPORT_CONTACT = 'support@6figjobs.com'

export const editionPath = (r: Pick<PayReportData, 'slug'>): string => `${PAY_REPORT_PATH}/${r.slug}`
export const isLatestEdition = (r: Pick<PayReportData, 'slug'>): boolean => r.slug === PAY_REPORT_EDITIONS[0].slug
export const findEdition = (slug: string): PayReportData | undefined => PAY_REPORT_EDITIONS.find((e) => e.slug === slug)
/** The edition before `r`, if there is one. */
export function previousEdition(r: Pick<PayReportData, 'slug'>): PayReportData | undefined {
  const i = PAY_REPORT_EDITIONS.findIndex((e) => e.slug === r.slug)
  return i >= 0 ? PAY_REPORT_EDITIONS[i + 1] : undefined
}
/** Address of the edition's data file. The latest edition's own address is the dated one, so a link to it never changes meaning. */
export const csvPath = (r: Pick<PayReportData, 'slug'>): string => `${editionPath(r)}/data.csv`

/** Listings that carry a stored experience level (the base of the seniority table). */
export const seniorityListings = (r: Pick<PayReportData, 'seniority'>): number => r.seniority.reduce((s, x) => s + x.listings, 0)

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
    ...optionalFindings(r),
  ]
}

const n0 = (v: number) => v.toLocaleString('en-US')

/** Sentences for the optional blocks, each written only when the edition has the data and the data says it. */
function optionalFindings(r: PayReportData): string[] {
  const out: string[] = []
  const director = r.seniority.find((s) => s.label === 'Director')
  const staff = r.seniority.find((s) => s.label === 'Staff')
  if (director && staff && staff.median > director.median) {
    out.push(
      `Staff-level listings advertise a higher median (${usd(staff.median)}) than Director listings (${usd(director.median)}): at the top of the six-figure range, advertised pay for senior individual contributors is on par with, or above, management.`,
    )
  }
  const w = r.rangeWidth
  if (w) {
    out.push(
      `Advertised ranges are wide: among the ${n0(w.ranged)} listings that state both ends, the typical maximum is ${w.medianWidthPct}% above the minimum (a median gap of ${usd(w.medianWidthUsd)}), and ${w.pctWiderThan50}% have a maximum at least 1.5 times the minimum. The minimum alone understates what the posting allows.`,
    )
  }
  const pairs = r.sameRole
  if (pairs && pairs.length > 0) {
    const lower = pairs.filter((p) => p.remote.median < p.onsite.median).length
    out.push(
      `Comparing like with like, in ${lower} of the ${pairs.length} roles with at least ${MIN_SAME_ROLE_LISTINGS} remote and ${MIN_SAME_ROLE_LISTINGS} on-site listings, the remote median is below the on-site median. The gap between all remote and all on-site listings mixes roles and cities; this comparison does not.`,
    )
  }
  return out
}

/** Percentage difference of `a` against `b`, one decimal, signed ("-6.1"). */
export const diffPct = (a: number, b: number): number => Math.round(((a - b) / b) * 1000) / 10

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
    {
      question: 'Can I download the data or cite this report?',
      answer: `Yes. Every table on this page is available as one CSV file, and the page gives a ready-to-copy citation and embeddable charts. Please link to the report when you quote it. Each edition keeps its own dated address, so a citation of the ${r.month} edition always shows the figures it quoted.`,
    },
  ]
}

/** One citation line for the edition. */
export function payReportCitation(r: PayReportData = PAY_REPORT): string {
  return `${SITE_NAME}, "${PAY_REPORT_HEADING}, ${r.month}", ${getSiteUrl()}${PAY_REPORT_PATH}. Data collected ${r.collected}; edition address ${getSiteUrl()}${editionPath(r)}.`
}

const csvCell = (v: string | number | undefined): string => {
  const t = v === undefined ? '' : String(v)
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/**
 * Every table of the edition as one long CSV: table, label, listings, employers, value_usd, share_pct. `value_usd` is the
 * median advertised midpoint unless the row says otherwise in `label` (the headline rows name what they are).
 */
export function payReportCsv(r: PayReportData = PAY_REPORT): string {
  const rows: Array<[string, string, number | undefined, number | undefined, number | undefined, number | undefined]> = []
  const h = r.headline
  rows.push(['headline', 'Median advertised midpoint', h.listings, h.employers, h.medianMidpoint, undefined])
  rows.push(['headline', 'Median advertised minimum', h.listings, h.employers, h.medianMinimum, undefined])
  rows.push(['headline', 'Median of employer medians (employers with 3+ listings)', undefined, undefined, h.medianOfEmployerMedians, undefined])
  for (const b of r.bands) rows.push(['salary_band', b.label, b.listings, undefined, undefined, b.pct])
  const pay = (table: string, list: PayRow[]) => {
    for (const x of list) rows.push([table, x.label, x.listings, x.employers, x.median, undefined])
  }
  pay('seniority', r.seniority)
  pay('role', r.roles)
  pay('work_arrangement', r.arrangement)
  pay('city', r.cities)
  pay('employer', r.employers)
  if (r.skills) pay('skill', r.skills)
  if (r.sameRole) {
    for (const p of r.sameRole) {
      rows.push(['same_role_remote', p.label, p.remote.listings, p.remote.employers, p.remote.median, undefined])
      rows.push(['same_role_onsite', p.label, p.onsite.listings, p.onsite.employers, p.onsite.median, undefined])
    }
  }
  if (r.rangeWidth) {
    const w = r.rangeWidth
    rows.push(['range_width', 'Median gap, maximum minus minimum (USD)', w.ranged, undefined, w.medianWidthUsd, undefined])
    rows.push(['range_width', 'Median gap as % of the minimum', w.ranged, undefined, undefined, w.medianWidthPct])
    rows.push(['range_width', 'Ranges with maximum at least 1.5x the minimum', w.ranged, undefined, undefined, w.pctWiderThan50])
  }
  const head = ['table', 'label', 'listings', 'employers', 'value_usd', 'share_pct']
  return [head, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n'
}

export type TrendRow = { label: string; current: number; previous: number; kind: 'usd' | 'pct'; changePct: number }

/** Edition-on-edition changes in the headline figures; empty when there is no previous edition to compare with. */
export function payReportTrend(current: PayReportData, previous: PayReportData | undefined): TrendRow[] {
  if (!previous) return []
  const row = (label: string, cur: number | undefined, prev: number | undefined, kind: 'usd' | 'pct'): TrendRow[] =>
    cur === undefined || prev === undefined || prev === 0 ? [] : [{ label, current: cur, previous: prev, kind, changePct: diffPct(cur, prev) }]
  const med = (rep: PayReportData, label: string) => rep.arrangement.find((a) => a.label === label)?.median
  return [
    ...row('Median advertised midpoint', current.headline.medianMidpoint, previous.headline.medianMidpoint, 'usd'),
    ...row('Median advertised minimum', current.headline.medianMinimum, previous.headline.medianMinimum, 'usd'),
    ...row('Median of employer medians', current.headline.medianOfEmployerMedians, previous.headline.medianOfEmployerMedians, 'usd'),
    ...row('Remote median', med(current, 'Remote'), med(previous, 'Remote'), 'usd'),
    ...row('On-site median', med(current, 'On-site'), med(previous, 'On-site'), 'usd'),
    ...row('Remote share of listings (%)', current.remoteSharePct, previous.remoteSharePct, 'pct'),
    ...row('Listings at $300,000 or more (%)', current.bands[3]?.pct, previous.bands[3]?.pct, 'pct'),
  ]
}
