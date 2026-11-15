import {
  MIN_CITY_EMPLOYERS,
  MIN_ROLE_LISTINGS,
  PAY_REPORT as R,
  PAY_REPORT_HEADING,
  payReportDescription,
  payReportFaq,
  payReportFindings,
  payReportTitle,
  usd,
} from '@/lib/research/payReport'
import { KEYWORD_MAP } from '@/lib/seo/keywordMap'
import { ALWAYS_INDEXABLE_HUBS } from '@/lib/seo/indexingPhase'
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX } from '@/lib/seo/metaText'
import { FOOTER_COLUMNS } from '@/components/layout/footerLinks'

const descending = (xs: number[]) => xs.every((x, i) => i === 0 || xs[i - 1] >= x)

describe('pay report data (refresh it monthly: these checks catch a bad paste)', () => {
  it('has bands that add up to all validated listings and to 100%', () => {
    expect(R.bands.reduce((s, b) => s + b.listings, 0)).toBe(R.headline.allListings)
    expect(Math.abs(R.bands.reduce((s, b) => s + b.pct, 0) - 100)).toBeLessThan(0.2)
    for (const b of R.bands) expect(Math.abs(b.pct - (100 * b.listings) / R.headline.allListings)).toBeLessThan(0.1)
  })

  it('counts aggregator listings as a small positive difference, and orders the headline figures sensibly', () => {
    const aggregators = R.headline.allListings - R.headline.listings
    expect(aggregators).toBeGreaterThan(0)
    expect(aggregators / R.headline.allListings).toBeLessThan(0.05)
    expect(R.headline.medianMinimum).toBeLessThan(R.headline.medianMidpoint)
    expect(R.headline.medianOfEmployerMedians).toBeLessThanOrEqual(R.headline.medianMidpoint)
  })

  it('keeps the sample floors: roles need 50 listings, cities 10 employers and 8 listings', () => {
    for (const r of R.roles) expect({ r: r.label, ok: r.listings >= MIN_ROLE_LISTINGS && (r.employers ?? 0) <= r.listings }).toEqual({ r: r.label, ok: true })
    for (const c of R.cities) expect({ c: c.label, ok: (c.employers ?? 0) >= MIN_CITY_EMPLOYERS && c.listings >= 8 }).toEqual({ c: c.label, ok: true })
  })

  it('sorts every table the way its heading says', () => {
    expect(descending(R.roles.map((r) => r.median))).toBe(true)
    expect(descending(R.cities.map((c) => c.median))).toBe(true)
    expect(descending(R.employers.map((e) => e.listings))).toBe(true)
    expect(descending(R.seniority.map((s) => s.median).reverse())).toBe(true) // ascending by median
  })

  it('leaves job boards and recruiting firms out of the employer table, and ties concentration to it', () => {
    for (const e of R.employers) expect(e.label).not.toMatch(/jobgether|true talent|orion placement|credence|recruit|staffing/i)
    const { top1Pct, top5Pct, top20Pct } = R.concentration
    expect(top1Pct <= top5Pct && top5Pct <= top20Pct && top20Pct <= 100).toBe(true)
    expect(Math.abs(top1Pct - (100 * R.employers[0].listings) / R.headline.listings)).toBeLessThan(0.1)
  })

  it('writes the findings and FAQ from the data, so the prose cannot disagree with the tables', () => {
    const text = [...payReportFindings(), ...payReportFaq().map((q) => q.answer)].join('\n')
    for (const figure of [R.headline.medianMidpoint, R.headline.medianMinimum, R.headline.medianOfEmployerMedians, R.roles[0].median]) {
      expect(text).toContain(usd(figure))
    }
    expect(text).toContain(R.headline.listings.toLocaleString('en-US'))
    const questions = payReportFaq().map((q) => q.question)
    expect(new Set(questions).size).toBe(questions.length)
    expect(payReportFaq().every((q) => q.answer.length > 40)).toBe(true)
  })
})

describe('pay report page registration', () => {
  it('is one permanent, absolute-able path', () => {
    expect(R.path).toBe('/high-paying-jobs-report')
    expect(R.path.startsWith('/')).toBe(true)
    expect(R.path.endsWith('/')).toBe(false)
  })

  it('has a title and description that fit and carry the keywords', () => {
    const title = payReportTitle()
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(title.toLowerCase()).toContain(KEYWORD_MAP.payReport.titleHas)
    expect(title).toContain(R.monthTag)
    const description = payReportDescription()
    expect(description.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN - 10)
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    for (const frag of KEYWORD_MAP.payReport.descHas) expect(description.toLowerCase()).toContain(frag)
    expect(PAY_REPORT_HEADING).toBe('Six-Figure Job Pay Report')
  })

  it('is indexable in every phase and linked from the footer', () => {
    expect(ALWAYS_INDEXABLE_HUBS.has(R.path)).toBe(true)
    const hrefs = FOOTER_COLUMNS.flatMap((c) => c.links.map(([, href]) => href))
    expect(hrefs).toContain(R.path)
  })

  it('does not take the keywords of the pages it supports', () => {
    expect(KEYWORD_MAP.payReport.primary).not.toBe(KEYWORD_MAP.highPayingJobs.primary)
    expect(KEYWORD_MAP.payReport.primary).not.toBe('six figure jobs')
  })
})
