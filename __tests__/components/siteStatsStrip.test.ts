import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/home/SiteStatsStrip.module.css', () => mockClassNames())
jest.mock('@/components/ui/AnimatedNumber.module.css', () => mockClassNames())

import { SiteStatsStrip, formatRefreshedAt, screenRatio } from '@/components/home/SiteStatsStrip'
import { DIRECT_EMPLOYERS } from '@/lib/constants/directEmployers'

const base = { jobs: 14597, companies: 2140, newThisWeek: 8656, countries: 23 }
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const catalog = { jobs: 4871976, companies: 697981, sources: 438, atsPlatforms: 179 }

describe('SiteStatsStrip', () => {
  it('shows what we screen next to what is listed, with the ratio between them', () => {
    const html = renderToStaticMarkup(createElement(SiteStatsStrip, { ...base, catalog }))
    const t = text(html)
    expect(t).toContain('We screen')
    expect(t).toContain('4,871,976')
    expect(t).toContain(`open jobs from 438 sources, 179 hiring platforms and ${DIRECT_EMPLOYERS.length} careers sites`)
    expect(t).toContain('You see')
    expect(t).toContain('14,597')
    expect(t).toContain('$100k+ jobs with published pay')
    expect(t).toContain('2,140 companies hiring')
    expect(t).toContain('8,656 new this week')
    expect(t).toContain('23 countries')
    expect(t).toContain('about 1 in 334 makes the list')
    // No data source is named or linked on the site.
    expect(html.toLowerCase()).not.toContain('freehire')
    expect(t).toContain('Screened jobs counted across the sources and hiring platforms we read')
    // The screened panel comes first in the HTML, as it reads.
    expect(t.indexOf('We screen')).toBeLessThan(t.indexOf('You see'))
  })

  it('shows only our own panel when the catalogue could not be read', () => {
    const html = renderToStaticMarkup(createElement(SiteStatsStrip, { ...base, catalog: null }))
    expect(html).not.toContain('freehire')
    expect(text(html)).not.toContain('We screen')
    expect(text(html)).toContain('Counted from our own job database')
  })

  it('leaves out missing numbers and renders nothing without jobs', () => {
    const t = text(renderToStaticMarkup(createElement(SiteStatsStrip, { ...base, countries: null, medianUsd: null, catalog: null })))
    expect(t).not.toContain('countries')
    expect(t).not.toContain('typical salary')
    expect(renderToStaticMarkup(createElement(SiteStatsStrip, { ...base, jobs: 0, catalog }))).toBe('')
  })
})

describe('screenRatio', () => {
  it('rounds screened per listed job, and gives up when it would not make sense', () => {
    expect(screenRatio(4871976, 14597)).toBe(334)
    expect(screenRatio(100, 100)).toBeNull()
    expect(screenRatio(0, 10)).toBeNull()
    expect(screenRatio(100, 0)).toBeNull()
  })
})

describe('SiteStatsStrip refresh time', () => {
  const refreshedAt = new Date('2026-11-13T08:10:00Z')

  it('shows when the list was last refreshed, as an absolute UTC time, and links to how it works', () => {
    const html = renderToStaticMarkup(createElement(SiteStatsStrip, { ...base, catalog: null, refreshedAt }))
    expect(text(html)).toContain('Job list last refreshed Nov 13, 2026, 08:10 UTC')
    expect(html).toContain('dateTime="2026-11-13T08:10:00.000Z"')
    expect(html).toContain('href="/method"')
  })

  it('leaves the line out when the time could not be read', () => {
    for (const value of [null, undefined, new Date('nope')]) {
      const t = text(renderToStaticMarkup(createElement(SiteStatsStrip, { ...base, catalog: null, refreshedAt: value })))
      expect(t).not.toContain('last refreshed')
    }
  })
})

describe('formatRefreshedAt', () => {
  it('formats in UTC whatever the server time zone is, and rejects bad dates', () => {
    expect(formatRefreshedAt(new Date('2026-11-13T23:05:00Z'))).toBe('Nov 13, 2026, 23:05 UTC')
    expect(formatRefreshedAt(new Date('2026-01-02T00:00:00Z'))).toBe('Jan 2, 2026, 00:00 UTC')
    expect(formatRefreshedAt(null)).toBeNull()
    expect(formatRefreshedAt(new Date('nope'))).toBeNull()
  })
})
