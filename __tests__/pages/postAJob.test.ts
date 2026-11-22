import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

jest.mock('@/lib/jobs/publicStats', () => ({ loadPublicSiteStats: jest.fn() }))
jest.mock('@/lib/jobs/siteCounts', () => ({ loadSiteCounts: jest.fn() }))
jest.mock('../../app/post-a-job/page.module.css', () => new Proxy({}, { get: (_t, key) => String(key) }))
jest.mock('@/components/ui/Link', () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
    createElement('a', { href, className }, children as never),
}))

import PostAJobPage, { metadata } from '../../app/post-a-job/page'
import { loadPublicSiteStats } from '@/lib/jobs/publicStats'
import { loadSiteCounts } from '@/lib/jobs/siteCounts'
import { SPONSOR_SLOT_COUNT } from '@/lib/sponsors/slots'

const render = async () => renderToStaticMarkup(await PostAJobPage())

describe('advertise page', () => {
  beforeEach(() => {
    ;(loadPublicSiteStats as jest.Mock).mockResolvedValue({ totalJobs: 13272, totalCompaniesHiring: 3178 })
    ;(loadSiteCounts as jest.Mock).mockResolvedValue({ byCountry: new Array(24).fill({ code: 'US', count: 1 }) })
  })

  it('is indexable (first sitemap wave) and keeps its canonical', () => {
    expect(metadata.robots).toEqual({ index: true, follow: true })
    expect(String((metadata.alternates as { canonical: string }).canonical)).toMatch(/\/post-a-job$/)
  })

  it('shows the live numbers it is given', async () => {
    const html = await render()
    expect(html).toContain('13,272')
    expect(html).toContain('3,178')
    expect(html).toContain('>24<')
  })

  it('leaves the numbers out, and still renders, when the database cannot be read', async () => {
    ;(loadPublicSiteStats as jest.Mock).mockRejectedValue(new Error('db down'))
    const html = await render()
    expect(html).not.toContain('The site today')
    expect(html).toContain('Request rates and availability')
  })

  it('asks for rates by email with a prefilled subject, and states no price', async () => {
    const html = await render()
    expect(html).toContain('href="mailto:support@6figjobs.com?subject=Sponsored%20placement')
    expect(html).not.toMatch(/\$\s?\d{2,}[\d,]*\s*(\/|per)\s*(mo|month|week)/i)
  })

  it('states the real rules: limited slots, always labelled, no effect on job order', async () => {
    const html = await render()
    expect(html).toContain(`Only ${SPONSOR_SLOT_COUNT} placements at a time`)
    expect(html).toContain('Sponsored')
    expect(html).toContain('does not change how jobs are ordered')
  })

  it('does not claim visitor or traffic numbers it cannot back', async () => {
    const html = await render()
    expect(html).not.toMatch(/monthly (active )?(users|visitors)|page views|impressions/i)
  })
})
