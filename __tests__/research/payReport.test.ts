import {
  MIN_CITY_EMPLOYERS,
  MIN_ROLE_LISTINGS,
  MIN_SAME_ROLE_LISTINGS,
  PAY_REPORT as R,
  PAY_REPORT_EDITIONS,
  PAY_REPORT_HEADING,
  csvPath,
  diffPct,
  editionPath,
  findEdition,
  isLatestEdition,
  payReportCitation,
  payReportCsv,
  payReportDescription,
  payReportFaq,
  payReportFindings,
  payReportTitle,
  payReportTrend,
  previousEdition,
  seniorityListings,
  usd,
  type PayReportData,
} from '@/lib/research/payReport'
import { EDITION_2026_11 } from '@/lib/research/editions/2026-11'
import { PAY_REPORT_CHART_NAMES, chartEmbedHtml, chartPath, isChartName, payReportChart } from '@/lib/research/payReportCharts'
import { payReportMetadata } from '@/lib/research/payReportMetadata'
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

/** A later edition with every optional block, to exercise what the page shows once the research script has produced them. */
const FULL: PayReportData = {
  ...EDITION_2026_11,
  slug: '2026-12',
  month: 'December 2026',
  monthTag: 'Dec 2026',
  publishedAt: '2026-12-15',
  updatedAt: '2026-12-15',
  headline: { ...EDITION_2026_11.headline, medianMidpoint: 190000, medianMinimum: 160000 },
  sinceLastEdition: 'The method and sources are unchanged since November 2026.',
  rangeWidth: { ranged: 12000, of: 15500, medianWidthPct: 28.6, medianWidthUsd: 50000, pctWiderThan50: 17.2 },
  sameRole: [
    { label: 'Software engineer', remote: { listings: 300, employers: 90, median: 190000 }, onsite: { listings: 900, employers: 200, median: 205000 } },
    { label: 'Product manager', remote: { listings: 60, employers: 30, median: 200000 }, onsite: { listings: 150, employers: 70, median: 190000 } },
  ],
  skills: [
    { label: 'Rust', listings: 120, employers: 40, median: 230000 },
    { label: 'Python', listings: 2000, employers: 500, median: 190000 },
  ],
}

describe('editions', () => {
  it('are listed newest first, each with a unique YYYY-MM address, and the permanent page shows the first', () => {
    const slugs = PAY_REPORT_EDITIONS.map((e) => e.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/)
    expect([...slugs].sort().reverse()).toEqual(slugs)
    expect(R.slug).toBe(slugs[0])
    expect(isLatestEdition(R)).toBe(true)
    expect(findEdition('2026-11')).toBe(EDITION_2026_11)
    expect(findEdition('1999-01')).toBeUndefined()
  })

  it('make every edition after the first say whether the method changed, so a trend is read fairly', () => {
    PAY_REPORT_EDITIONS.forEach((e, i) => {
      if (i < PAY_REPORT_EDITIONS.length - 1) expect({ slug: e.slug, said: Boolean(e.sinceLastEdition) }).toEqual({ slug: e.slug, said: true })
    })
    expect(previousEdition(PAY_REPORT_EDITIONS[PAY_REPORT_EDITIONS.length - 1])).toBeUndefined()
  })

  it('has dated addresses under the permanent path, and a CSV beside each', () => {
    expect(editionPath(R)).toBe('/high-paying-jobs-report/2026-11')
    expect(csvPath(R)).toBe('/high-paying-jobs-report/2026-11/data.csv')
  })

  it('counts the listings behind the seniority table from its own rows', () => {
    expect(seniorityListings(R)).toBe(R.seniority.reduce((s, x) => s + x.listings, 0))
    expect(seniorityListings(R)).toBeLessThan(R.headline.allListings)
  })
})

describe('optional findings', () => {
  it('say nothing when the edition lacks the data', () => {
    const text = payReportFindings(R).join('\n')
    expect(text).not.toMatch(/Advertised ranges are wide|Comparing like with like/)
  })

  it('are written from the data when it is there, and only when the data says so', () => {
    const text = payReportFindings(FULL).join('\n')
    expect(text).toContain('28.6%')
    expect(text).toContain(usd(50000))
    expect(text).toContain('17.2%')
    expect(text).toContain('in 1 of the 2 roles') // remote is lower in software engineer only
    const flipped = payReportFindings({ ...FULL, sameRole: FULL.sameRole!.map((p) => ({ ...p, remote: { ...p.remote, median: 999999 } })) }).join('\n')
    expect(flipped).toContain('in 0 of the 2 roles')
  })

  it('reports Staff above Director only when it is true', () => {
    expect(payReportFindings(R).join('\n')).toContain('Staff-level listings advertise a higher median')
    const swapped = { ...R, seniority: R.seniority.map((s) => (s.label === 'Staff' ? { ...s, median: 100000 } : s)) }
    expect(payReportFindings(swapped).join('\n')).not.toContain('Staff-level listings')
  })

  it('keep the same-role floor and a remote and on-site side each', () => {
    for (const p of FULL.sameRole!) {
      expect(p.remote.listings).toBeGreaterThanOrEqual(MIN_SAME_ROLE_LISTINGS)
      expect(p.onsite.listings).toBeGreaterThanOrEqual(MIN_SAME_ROLE_LISTINGS)
    }
  })
})

/** A small CSV reader (quoted cells, doubled quotes) so the test checks the file a spreadsheet would read. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        cell += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += c
    }
  }
  return rows
}

describe('CSV', () => {
  it('has one header, six columns on every row, and a row for every table entry', () => {
    const rows = parseCsv(payReportCsv(R))
    expect(rows[0]).toEqual(['table', 'label', 'listings', 'employers', 'value_usd', 'share_pct'])
    for (const row of rows) expect(row).toHaveLength(6)
    const count = (t: string) => rows.filter((r) => r[0] === t).length
    expect(count('salary_band')).toBe(R.bands.length)
    expect(count('role')).toBe(R.roles.length)
    expect(count('city')).toBe(R.cities.length)
    expect(count('employer')).toBe(R.employers.length)
    expect(count('headline')).toBe(3)
  })

  it('keeps commas inside labels intact, and the figures equal the page tables', () => {
    const rows = parseCsv(payReportCsv(R))
    const band = rows.find((r) => r[0] === 'salary_band' && r[1] === '$100,000 to $149,999')!
    expect(band[2]).toBe(String(R.bands[0].listings))
    expect(band[5]).toBe(String(R.bands[0].pct))
    const top = rows.find((r) => r[0] === 'role')!
    expect(top[1]).toBe(R.roles[0].label)
    expect(top[4]).toBe(String(R.roles[0].median))
    const headline = rows.find((r) => r[1] === 'Median advertised midpoint')!
    expect(headline[4]).toBe(String(R.headline.medianMidpoint))
  })

  it('adds the optional tables only when the edition has them', () => {
    const base = payReportCsv(R)
    expect(base).not.toMatch(/same_role|range_width|\nskill,/)
    const full = parseCsv(payReportCsv(FULL))
    expect(full.filter((r) => r[0] === 'same_role_remote')).toHaveLength(2)
    expect(full.filter((r) => r[0] === 'same_role_onsite')).toHaveLength(2)
    expect(full.filter((r) => r[0] === 'range_width')).toHaveLength(3)
    expect(full.filter((r) => r[0] === 'skill')).toHaveLength(2)
    for (const row of full) expect(row).toHaveLength(6)
  })
})

describe('trend', () => {
  it('is empty without a previous edition, and otherwise compares like with like', () => {
    expect(payReportTrend(R, undefined)).toEqual([])
    const rows = payReportTrend(FULL, R)
    const mid = rows.find((t) => t.label === 'Median advertised midpoint')!
    expect(mid).toMatchObject({ current: 190000, previous: R.headline.medianMidpoint, kind: 'usd' })
    expect(mid.changePct).toBe(diffPct(190000, R.headline.medianMidpoint))
    expect(rows.find((t) => t.label === 'Remote share of listings (%)')!.kind).toBe('pct')
  })

  it('computes a signed percentage change to one decimal, and leaves out a figure that cannot be compared', () => {
    expect(diffPct(110, 100)).toBe(10)
    expect(diffPct(95, 100)).toBe(-5)
    const noRemote = { ...FULL, arrangement: FULL.arrangement.filter((a) => a.label !== 'Remote') }
    expect(payReportTrend(noRemote, R).some((t) => t.label === 'Remote median')).toBe(false)
  })
})

describe('citation and charts', () => {
  it('gives a citation that names the report, the month, the permanent address and the edition address', () => {
    const c = payReportCitation(R)
    expect(c).toContain(PAY_REPORT_HEADING)
    expect(c).toContain(R.month)
    expect(c).toContain('/high-paying-jobs-report.')
    expect(c).toContain('/high-paying-jobs-report/2026-11')
  })

  it('draws bars from the tables, the largest at 100%, with a figure on each', () => {
    for (const name of PAY_REPORT_CHART_NAMES) {
      const chart = payReportChart(R, name)
      expect(chart.bars.length).toBeGreaterThan(2)
      expect(Math.max(...chart.bars.map((b) => b.pct))).toBe(100)
      for (const b of chart.bars) expect(b.valueText).toMatch(/\d/)
    }
    expect(payReportChart(R, 'roles').bars[0].label).toBe(R.roles[0].label)
    expect(payReportChart(R, 'seniority').bars[0].label).toBe(R.seniority[R.seniority.length - 1].label) // highest first
    expect(payReportChart(R, 'bands').bars).toHaveLength(R.bands.length)
    expect(isChartName('roles')).toBe(true)
    expect(isChartName('nope')).toBe(false)
  })

  it('embeds an edition-pinned image that links to the permanent page', () => {
    const html = chartEmbedHtml(R, 'roles', 'https://www.6figjobs.com')
    expect(html).toContain('href="https://www.6figjobs.com/high-paying-jobs-report"')
    expect(html).toContain(`src="https://www.6figjobs.com${chartPath(R, 'roles')}"`)
    expect(html).toContain('/2026-11/chart/roles')
    expect(html).toMatch(/alt="[^"]+\(Six Figure Jobs\)"/)
  })
})

describe('metadata', () => {
  it('points the latest edition, at either address, to the one permanent page', () => {
    expect(payReportMetadata(R).alternates?.canonical).toBe('https://www.6figjobs.com/high-paying-jobs-report')
  })

  it('gives an older edition its own canonical and its own title', () => {
    const older = { ...EDITION_2026_11, slug: '2025-10', month: 'October 2025', monthTag: 'Oct 2025' }
    const meta = payReportMetadata(older)
    expect(meta.alternates?.canonical).toBe('https://www.6figjobs.com/high-paying-jobs-report/2025-10')
    expect(String(meta.title)).toContain('Oct 2025')
  })
})
