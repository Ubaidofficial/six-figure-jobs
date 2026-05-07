import { GET } from '../../app/sitemap-city.xml/route'
import { getCitySitemapUrls } from '../../lib/seo/citySitemap'

jest.mock('../../lib/seo/citySitemap', () => ({
  getCitySitemapUrls: jest.fn(),
}))

const mockedGetCitySitemapUrls = getCitySitemapUrls as jest.MockedFunction<
  typeof getCitySitemapUrls
>

function assertWellFormedUrlset(xml: string) {
  const trimmed = xml.trim()
  expect(trimmed.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
  expect(trimmed).toContain('<urlset')
  expect(trimmed).toContain('</urlset>')
}

describe('sitemap-city route', () => {
  beforeEach(() => {
    mockedGetCitySitemapUrls.mockReset()
  })

  it('returns non-empty urlset under normal data conditions', async () => {
    mockedGetCitySitemapUrls.mockResolvedValue([
      {
        loc: 'https://www.6figjobs.com/jobs/city/new-york',
        lastmod: '2026-02-14T00:00:00.000Z',
      },
    ])

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    assertWellFormedUrlset(xml)
    expect(xml).toContain('<url>')
    expect(xml).toContain('<loc>https://www.6figjobs.com/jobs/city/new-york</loc>')
  })

  it('returns explicit fallback marker when sitemap builder throws', async () => {
    mockedGetCitySitemapUrls.mockRejectedValue(new Error('db unavailable'))

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('x-sitemap-fallback')).toBe('1')
    assertWellFormedUrlset(xml)
    expect(xml).toContain('fallback_used=1')
  })
})
