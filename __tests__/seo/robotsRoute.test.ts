import { GET } from '../../app/robots.txt/route'
import { getCitySitemapUrls } from '../../lib/seo/citySitemap'
import { hasCountrySitemapEntries } from '../../lib/seo/countrySitemap'
import { hasRemoteRoleSitemapEntries } from '../../lib/seo/remoteSitemap'
import { hasSliceSitemapEntries } from '../../lib/seo/slicesSitemap'

jest.mock('../../lib/seo/citySitemap', () => ({
  getCitySitemapUrls: jest.fn(),
}))

jest.mock('../../lib/seo/countrySitemap', () => ({
  hasCountrySitemapEntries: jest.fn(),
}))

jest.mock('../../lib/seo/remoteSitemap', () => ({
  hasRemoteRoleSitemapEntries: jest.fn(),
}))

jest.mock('../../lib/seo/slicesSitemap', () => ({
  hasSliceSitemapEntries: jest.fn(),
}))

const getCitySitemapUrlsMock = getCitySitemapUrls as jest.MockedFunction<
  typeof getCitySitemapUrls
>
const hasCountrySitemapEntriesMock = hasCountrySitemapEntries as jest.MockedFunction<
  typeof hasCountrySitemapEntries
>
const hasRemoteRoleSitemapEntriesMock =
  hasRemoteRoleSitemapEntries as jest.MockedFunction<typeof hasRemoteRoleSitemapEntries>
const hasSliceSitemapEntriesMock = hasSliceSitemapEntries as jest.MockedFunction<
  typeof hasSliceSitemapEntries
>

describe('robots route sitemap declarations', () => {
  const originalSiteEnv = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.6figjobs.com'
    getCitySitemapUrlsMock.mockReset()
    hasCountrySitemapEntriesMock.mockReset()
    hasRemoteRoleSitemapEntriesMock.mockReset()
    hasSliceSitemapEntriesMock.mockReset()
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteEnv
  })

  it('does not advertise empty city/country/remote/slices families', async () => {
    getCitySitemapUrlsMock.mockResolvedValue([])
    hasCountrySitemapEntriesMock.mockResolvedValue(false)
    hasRemoteRoleSitemapEntriesMock.mockResolvedValue(false)
    hasSliceSitemapEntriesMock.mockResolvedValue(false)

    const response = await GET()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/)
    expect(body).not.toContain('sitemap-city.xml')
    expect(body).not.toContain('sitemap-country.xml')
    expect(body).not.toContain('sitemap-remote.xml')
    expect(body).not.toContain('sitemap-slices.xml')
  })

  it('advertises city/country/remote/slices families when they have URLs', async () => {
    getCitySitemapUrlsMock.mockResolvedValue([
      {
        loc: 'https://www.6figjobs.com/jobs/city/new-york',
        lastmod: '2026-03-01T00:00:00.000Z',
        changefreq: 'daily',
        priority: 0.8,
      },
    ])
    hasCountrySitemapEntriesMock.mockResolvedValue(true)
    hasRemoteRoleSitemapEntriesMock.mockResolvedValue(true)
    hasSliceSitemapEntriesMock.mockResolvedValue(true)

    const response = await GET()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toMatch(/Sitemap: .*\/sitemap-city\.xml/)
    expect(body).toMatch(/Sitemap: .*\/sitemap-country\.xml/)
    expect(body).toMatch(/Sitemap: .*\/sitemap-remote\.xml/)
    expect(body).toMatch(/Sitemap: .*\/sitemap-slices\.xml/)
  })
})
