import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/home/SiteStatsStrip.module.css', () => mockClassNames())
jest.mock('@/components/ui/AnimatedNumber.module.css', () => mockClassNames())

import { SiteStatsStrip } from '@/components/home/SiteStatsStrip'
import { DIRECT_EMPLOYERS } from '@/lib/constants/directEmployers'

const base = { jobs: 14597, companies: 1200, newThisWeek: 900, countries: 30, medianUsd: 165000 }
const text = (html: string) => html.replace(/<[^>]+>/g, '')

describe('SiteStatsStrip catalogue line', () => {
  it("shows freehire's live numbers as big stats of what we screen, links its page, and counts our direct employers", () => {
    const html = renderToStaticMarkup(
      createElement(SiteStatsStrip, {
        ...base,
        catalog: { jobs: 4871976, companies: 697981, sources: 438, atsPlatforms: 179 },
      }),
    )
    const t = text(html)
    for (const [value, label] of [
      ['4,871,976', 'open jobs screened'],
      ['697,981', 'companies'],
      ['438', 'sources'],
      ['179', 'ATS platforms'],
    ]) {
      expect(t).toContain(label)
      expect(t).toContain(value)
    }
    expect(t).toContain('The catalogue we screen')
    expect(t).toContain(`plus ${DIRECT_EMPLOYERS.length} employers`)
    expect(t).toContain('We list only the jobs whose published pay clears our six-figure line')
    expect(html).toContain('href="https://freehire.me/open"')
  })

  it('leaves the line out when the numbers could not be read', () => {
    const html = renderToStaticMarkup(createElement(SiteStatsStrip, { ...base, catalog: null }))
    expect(html).not.toContain('freehire')
    expect(html).toContain('Counted from our own job database')
  })
})
