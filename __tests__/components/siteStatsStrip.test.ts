import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/home/SiteStatsStrip.module.css', () => mockClassNames())
jest.mock('@/components/ui/AnimatedNumber.module.css', () => mockClassNames())

import { SiteStatsStrip, screenRatio } from '@/components/home/SiteStatsStrip'
import { DIRECT_EMPLOYERS } from '@/lib/constants/directEmployers'

const base = { jobs: 14597, companies: 2140, newThisWeek: 8656, countries: 23, medianUsd: 200000 }
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
const catalog = { jobs: 4871976, companies: 697981, sources: 438, atsPlatforms: 179 }

describe('SiteStatsStrip', () => {
  it('shows what we screen next to what is listed, with the ratio between them', () => {
    const html = renderToStaticMarkup(createElement(SiteStatsStrip, { ...base, catalog }))
    const t = text(html)
    expect(t).toContain('We screen')
    expect(t).toContain('4,871,976')
    expect(t).toContain('697,981 companies')
    expect(t).toContain('438 sources and 179 hiring platforms')
    expect(t).toContain(`plus ${DIRECT_EMPLOYERS.length} careers sites we read directly`)
    expect(t).toContain('You see')
    expect(t).toContain('14,597')
    expect(t).toContain('$100k+ jobs with published pay')
    expect(t).toContain('2,140 companies')
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
