import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/research/PayReport.module.css', () => mockClassNames())
jest.mock('../../components/research/PayReport.module.css', () => mockClassNames())
jest.mock('@/components/ui/Link', () => ({ __esModule: true, default: (props: any) => createElement('a', props) }))
jest.mock('@/components/listing/ListingParts', () => ({
  ListingPage: ({ children }: any) => createElement('main', null, children),
  ListingHeader: ({ title, summary }: any) => createElement('header', null, createElement('h1', null, title), createElement('p', null, summary)),
  Faq: ({ items }: any) => createElement('dl', null, items.map((i: any) => createElement('dt', { key: i.question }, i.question))),
}))

import { PayReportView } from '@/components/research/PayReportView'
import { EDITION_2026_11 } from '@/lib/research/editions/2026-11'
import { PAY_REPORT_EDITIONS, type PayReportData } from '@/lib/research/payReport'

const html = (report: PayReportData) => renderToStaticMarkup(createElement(PayReportView, { report }))

function jsonLd(markup: string): Array<Record<string, any>> {
  return [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#x27;/g, "'")))
}

const NEXT: PayReportData = {
  ...EDITION_2026_11,
  slug: '2026-12',
  month: 'December 2026',
  monthTag: 'Dec 2026',
  publishedAt: '2026-12-15',
  updatedAt: '2026-12-15',
  collectedISO: '2026-12-01/2026-12-14',
  sinceLastEdition: 'The method and sources are unchanged since November 2026.',
  funnel: [
    { label: 'Jobs stored in the window', listings: 30000 },
    { label: 'In the report', listings: 15456 },
  ],
  sensitivity: [
    { key: 'all', label: 'All validated USD listings', listings: 15456, employers: 2700, median: 190000 },
    { key: 'top5', label: 'Without the 5 largest employers', listings: 11500, employers: 2695, median: 187000 },
  ],
  highestListings: [{ company: 'Acme', title: 'Principal engineer', advertised: '$459,000 - $536,000', midpoint: 497500, source: 'greenhouse', captured: '2026-12-14' }],
  spotCheck: { sampled: 100, matched: 96, checkedOn: '2026-12-10' },
  external: [{ label: 'Software developers', ours: 210000, theirs: 130000, source: 'Official wage survey', sourceUrl: 'https://example.org/wages', note: 'Different year and definition' }],
  reviewedBy: { name: 'A. Reviewer', role: 'Compensation analyst' },
  doi: '10.5281/zenodo.0000000',
}

describe('the report page, with only what the November edition has', () => {
  const markup = html(EDITION_2026_11)

  it('shows the core sections, the download and the cite block', () => {
    for (const id of ['findings', 'bands', 'seniority', 'roles', 'arrangement', 'cities', 'employers', 'highest', 'method', 'cite', 'about', 'faq']) {
      expect(markup).toContain(`id="${id}"`)
    }
    expect(markup).toContain('href="/high-paying-jobs-report/2026-11/data.csv"')
    expect(markup).toContain('Download the data (CSV)')
    expect(markup).toContain('For journalists')
  })

  it('leaves out every evidence section that has no numbers, instead of showing an empty one', () => {
    for (const id of ['funnel', 'sensitivity', 'audit', 'context', 'trend', 'ranges', 'skills']) expect(markup).not.toContain(`id="${id}"`)
    expect(markup).not.toContain('Method reviewed by')
    expect(markup).not.toContain('Dataset DOI')
  })

  it('credits the site, not a person, until an author is named, and says no corrections so far', () => {
    expect(markup).toContain('Analysis by <strong>Six Figure Jobs</strong>')
    expect(markup).toContain('No corrections have been made to this edition so far.')
  })

  it('has Article, Dataset, FAQPage and BreadcrumbList data, with the CSV as the dataset download and no licence it was not given', () => {
    const blocks = jsonLd(markup)
    expect(blocks.map((b) => b['@type'])).toEqual(['Article', 'Dataset', 'FAQPage', 'BreadcrumbList'])
    const [article, dataset] = blocks
    expect(article.author['@type']).toBe('Organization')
    expect(dataset.temporalCoverage).toBe('2026-11-05/2026-11-15')
    expect(dataset.distribution[0].contentUrl).toContain('/high-paying-jobs-report/2026-11/data.csv')
    expect(dataset.distribution[0].encodingFormat).toBe('text/csv')
    expect(dataset.isAccessibleForFree).toBe(true)
    expect(dataset).not.toHaveProperty('license')
    expect(dataset).not.toHaveProperty('identifier')
    expect(dataset.variableMeasured.length).toBeGreaterThan(1)
  })

  it('says it is an older edition when it is not the latest', () => {
    const old = html({ ...EDITION_2026_11, slug: '2025-10' })
    expect(old).toContain('kept as published')
  })
})

describe('the report page, once an edition carries the evidence', () => {
  let markup = ''
  beforeAll(() => {
    PAY_REPORT_EDITIONS.unshift(NEXT) // make it the latest, with November as its previous edition
    markup = html(NEXT)
  })
  afterAll(() => {
    PAY_REPORT_EDITIONS.shift()
  })

  it('shows each evidence section and puts it in the contents list', () => {
    for (const id of ['funnel', 'sensitivity', 'audit', 'context', 'trend']) {
      expect(markup).toContain(`id="${id}"`)
      expect(markup).toContain(`href="#${id}"`)
    }
    expect(markup).toContain('Is the number robust?')
    expect(markup).toContain('baseline')
    expect(markup).toContain('-1.6%')
  })

  it('quotes the highest ranges as the postings wrote them, with source and date', () => {
    expect(markup).toContain('$459,000 - $536,000')
    expect(markup).toContain('greenhouse')
    expect(markup).toContain('14 December 2026')
  })

  it('states the spot-check and names the reviewer and the DOI only because the edition has them', () => {
    expect(markup).toContain('96 of 100 (96%)')
    expect(markup).toContain('Method reviewed by')
    expect(markup).toContain('A. Reviewer')
    expect(markup).toContain('href="https://doi.org/10.5281/zenodo.0000000"')
    expect(jsonLd(markup)[1].identifier).toBe('https://doi.org/10.5281/zenodo.0000000')
  })

  it('gives the official comparison as context, with a link to its source', () => {
    expect(markup).toContain('For context only')
    expect(markup).toContain('href="https://example.org/wages"')
  })
})

describe('row links in the report tables', () => {
  const rowLinks = (markup: string) => [...markup.matchAll(/<a class="rowLink" href="([^"]*)"/g)].map((m) => m[1])

  it('links roles, the two cities and the levels that have pages, and no others', () => {
    const links = rowLinks(html(EDITION_2026_11))
    expect(links).toContain('/jobs/principal-software-engineer')
    expect(links).toContain('/jobs/city/san-francisco')
    expect(links).toContain('/jobs/city/san-jose')
    expect(links).toContain('/jobs/level/senior')
    expect(links).toContain('/jobs/level/lead')
    expect(links).not.toContain('/jobs/city/san-mateo')
    expect(links.some((l) => l.startsWith('/company/'))).toBe(false) // no employer slugs in the November data, so no guessed links
  })

  it('stays bounded and clean: one link per destination, no query strings, a handful per table', () => {
    const links = rowLinks(html(EDITION_2026_11))
    expect(new Set(links).size).toBe(links.length)
    for (const href of links) expect(href).not.toMatch(/[?#]/)
    expect(links).toHaveLength(16) // 12 roles + 2 cities + 2 levels
  })

  it('links an employer only when its slug is in the data', () => {
    const withSlug = {
      ...EDITION_2026_11,
      employers: EDITION_2026_11.employers.map((e) => (e.label === 'NVIDIA' ? { ...e, slug: 'nvidia' } : e)),
    }
    const links = rowLinks(html(withSlug))
    expect(links).toContain('/company/nvidia')
    expect(links.filter((l) => l.startsWith('/company/'))).toHaveLength(1)
  })

  it('leaves the work-arrangement rows unlinked, since the sentence under that table already links the remote page', () => {
    expect(rowLinks(html(EDITION_2026_11))).not.toContain('/remote')
  })
})
