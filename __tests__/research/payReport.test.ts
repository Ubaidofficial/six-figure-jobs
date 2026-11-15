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
  payReportQuotes,
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
import { getSiteUrl } from '@/lib/seo/site'
import { METHOD_CHANGELOG, METHOD_PATH, METHOD_VERSION, DATA_DICTIONARY, USD_CAP } from '@/lib/research/method'
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
  collectedISO: '2026-12-01/2026-12-14',
  funnel: [
    { label: 'Jobs stored in the window', listings: 30000 },
    { label: 'With a yearly pay figure', listings: 20000 },
    { label: 'In US dollars', listings: 18000 },
    { label: 'In the report', listings: 15456 },
  ],
  sensitivity: [
    { key: 'all', label: 'All validated USD listings', listings: 15456, employers: 2700, median: 190000 },
    { key: 'top5', label: 'Without the 5 largest employers', listings: 11500, employers: 2695, median: 187000 },
    { key: 'bayarea', label: 'Without the Bay Area', listings: 12000, employers: 2500, median: 184000 },
    { key: 'dedupe', label: 'One listing per employer and job title', listings: 9000, employers: 2700, median: 185000 },
  ],
  highestListings: [
    { company: 'Acme', title: 'Principal engineer', advertised: '$459,000 - $536,000', midpoint: 497500, source: 'greenhouse', captured: '2026-12-14' },
    { company: 'Beta', title: 'Head of data', advertised: '$401,000 - $510,000', midpoint: 455500, captured: '2026-12-14' },
  ],
  spotCheck: { sampled: 100, matched: 96, checkedOn: '2026-12-10', notes: 'The four that differed were hourly ranges.' },
  external: [{ label: 'Software developers', ours: 210000, theirs: 130000, source: 'Official wage survey', sourceUrl: 'https://example.org/wages', note: 'Different year and definition' }],
  reviewedBy: { name: 'A. Reviewer', role: 'Compensation analyst' },
  doi: '10.5281/zenodo.0000000',
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
  it('has one header, eight columns on every row, and a row for every table entry', () => {
    const rows = parseCsv(payReportCsv(R))
    expect(rows[0]).toEqual(['table', 'label', 'listings', 'employers', 'value_usd', 'share_pct', 'p25_usd', 'p75_usd'])
    for (const row of rows) expect(row).toHaveLength(8)
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
    expect(base).not.toMatch(/same_role|range_width|sensitivity|funnel|\nskill,/)
    const full = parseCsv(payReportCsv(FULL))
    expect(full.filter((r) => r[0] === 'same_role_remote')).toHaveLength(2)
    expect(full.filter((r) => r[0] === 'same_role_onsite')).toHaveLength(2)
    expect(full.filter((r) => r[0] === 'range_width')).toHaveLength(3)
    expect(full.filter((r) => r[0] === 'skill')).toHaveLength(2)
    for (const row of full) expect(row).toHaveLength(8)
    expect(full.filter((r) => r[0] === 'sensitivity')).toHaveLength(FULL.sensitivity!.length)
    expect(full.filter((r) => r[0] === 'funnel')).toHaveLength(FULL.funnel!.length)
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
    expect(payReportMetadata(R).alternates?.canonical).toBe(`${getSiteUrl()}/high-paying-jobs-report`)
  })

  it('gives an older edition its own canonical and its own title', () => {
    const older = { ...EDITION_2026_11, slug: '2025-10', month: 'October 2025', monthTag: 'Oct 2025' }
    const meta = payReportMetadata(older)
    expect(meta.alternates?.canonical).toBe(`${getSiteUrl()}/high-paying-jobs-report/2025-10`)
    expect(String(meta.title)).toContain('Oct 2025')
  })
})

describe('evidence blocks', () => {
  it('has a funnel that only narrows, starting from every stored job', () => {
    const steps = FULL.funnel!
    expect(steps.length).toBeGreaterThan(2)
    steps.forEach((step, i) => {
      if (i > 0) expect({ step: step.label, ok: step.listings <= steps[i - 1].listings }).toEqual({ step: step.label, ok: true })
    })
    expect(steps[steps.length - 1].listings).toBe(FULL.headline.allListings)
  })

  it('starts the sensitivity check from the baseline, with one row per key', () => {
    const keys = FULL.sensitivity!.map((x) => x.key)
    expect(keys[0]).toBe('all')
    expect(new Set(keys).size).toBe(keys.length)
    for (const x of FULL.sensitivity!) {
      expect(x.listings).toBeLessThanOrEqual(FULL.sensitivity![0].listings)
      expect(x.median).toBeGreaterThan(100000)
    }
  })

  it('writes the robustness sentence from the rows it has, signed against the baseline', () => {
    const text = payReportFindings(FULL).join('\n')
    expect(text).toContain('The headline is not set by a few employers or one region')
    expect(text).toContain('leaving out the five largest employers gives $187,000 (-1.6%)')
    expect(text).toContain('leaving out the Bay Area gives $184,000 (-3.2%)')
    const onlyAll = payReportFindings({ ...FULL, sensitivity: [FULL.sensitivity![0]] }).join('\n')
    expect(onlyAll).not.toContain('The headline is not set')
  })

  it('reports a spot-check only when one is recorded, and never more matches than listings', () => {
    expect(payReportFindings(R).join('\n')).not.toContain('manual check')
    const text = payReportFindings(FULL).join('\n')
    expect(text).toContain('96 (96%)')
    expect(FULL.spotCheck!.matched).toBeLessThanOrEqual(FULL.spotCheck!.sampled)
  })

  it('keeps the highest ranges real: quoted text, below the cap, highest first, with a read date', () => {
    const rows = FULL.highestListings!
    expect(descending(rows.map((x) => x.midpoint))).toBe(true)
    for (const x of rows) {
      expect(x.midpoint).toBeLessThan(USD_CAP)
      expect(x.advertised).toMatch(/\d/)
      expect(x.captured).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('keeps the middle half around the median when an edition gives it', () => {
    const withSpread = { ...R, roles: R.roles.map((x) => ({ ...x, p25: x.median - 20000, p75: x.median + 25000 })) }
    for (const x of withSpread.roles) expect(x.p25! <= x.median && x.median <= x.p75!).toBe(true)
    const csv = parseCsv(payReportCsv(withSpread))
    const role = csv.find((r) => r[0] === 'role')!
    expect(role[6]).toBe(String(R.roles[0].median - 20000))
    expect(role[7]).toBe(String(R.roles[0].median + 25000))
  })

  it('gives the collection window as an ISO interval for the dataset record', () => {
    expect(R.collectedISO).toMatch(/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/)
    const [from, to] = R.collectedISO!.split('/')
    expect(from <= to).toBe(true)
  })
})

describe('quotable sentences and the DOI', () => {
  it('writes sentences from the data, each with its attribution', () => {
    const quotes = payReportQuotes(R)
    expect(quotes.length).toBeGreaterThanOrEqual(3)
    for (const q of quotes) expect(q).toContain('(Six Figure Jobs, Six-Figure Job Pay Report, November 2026)')
    expect(quotes.join('\n')).toContain(usd(R.headline.medianMidpoint))
    expect(quotes.join('\n')).toContain(usd(R.roles[0].median))
  })

  it('adds the DOI to the citation only when the edition has one', () => {
    expect(payReportCitation(R)).not.toContain('doi.org')
    expect(payReportCitation(FULL)).toContain('DOI: https://doi.org/10.5281/zenodo.0000000')
  })
})

describe('method file', () => {
  it('names the current version first in its history, and has a registered page', () => {
    expect(METHOD_CHANGELOG[0].version).toBe(METHOD_VERSION)
    const dates = METHOD_CHANGELOG.map((c) => c.date)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect(METHOD_PATH).toBe('/high-paying-jobs-report/method')
    expect(ALWAYS_INDEXABLE_HUBS.has(METHOD_PATH)).toBe(true)
  })

  it('explains every CSV column and every table name, once each', () => {
    const terms = DATA_DICTIONARY.map((d) => d.term)
    expect(new Set(terms).size).toBe(terms.length)
    const text = DATA_DICTIONARY.map((d) => `${d.term} ${d.meaning}`).join('\n')
    for (const column of ['listings', 'value_usd', 'share_pct']) expect(text).toContain(column)
    for (const table of ['headline', 'salary_band', 'role', 'sensitivity', 'funnel']) expect(text).toContain(table)
    for (const d of DATA_DICTIONARY) expect(d.meaning.length).toBeGreaterThan(20)
  })
})
