import { GET } from '../../app/sitemap.xml/route'
import { getCitySitemapUrls } from '../../lib/seo/citySitemap'
import { hasRemoteRoleSitemapEntries } from '../../lib/seo/remoteSitemap'
import { hasSliceSitemapEntries } from '../../lib/seo/slicesSitemap'

jest.mock('../../lib/seo/citySitemap', () => ({
  getCitySitemapUrls: jest.fn(),
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
const hasRemoteRoleSitemapEntriesMock =
  hasRemoteRoleSitemapEntries as jest.MockedFunction<typeof hasRemoteRoleSitemapEntries>
const hasSliceSitemapEntriesMock = hasSliceSitemapEntries as jest.MockedFunction<
  typeof hasSliceSitemapEntries
>

describe('sitemap.xml route conditional sitemap inclusion', () => {
  beforeEach(() => {
    getCitySitemapUrlsMock.mockReset()
    hasRemoteRoleSitemapEntriesMock.mockReset()
    hasSliceSitemapEntriesMock.mockReset()
  })

  it('omits empty city/remote/slices sitemap families', async () => {
    getCitySitemapUrlsMock.mockResolvedValue([])
    hasRemoteRoleSitemapEntriesMock.mockResolvedValue(false)
    hasSliceSitemapEntriesMock.mockResolvedValue(false)

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('/sitemap-jobs.xml')
    expect(xml).toContain('/sitemap-company.xml')
    expect(xml).not.toContain('/sitemap-city.xml')
    expect(xml).not.toContain('/sitemap-remote.xml')
    expect(xml).not.toContain('/sitemap-slices.xml')
  })

  it('includes city/remote/slices sitemap families when data-backed', async () => {
    getCitySitemapUrlsMock.mockResolvedValue([
      {
        loc: 'https://www.6figjobs.com/jobs/city/new-york',
        lastmod: '2026-03-01T00:00:00.000Z',
        changefreq: 'daily',
        priority: 0.8,
      },
    ])
    hasRemoteRoleSitemapEntriesMock.mockResolvedValue(true)
    hasSliceSitemapEntriesMock.mockResolvedValue(true)

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('/sitemap-city.xml')
    expect(xml).toContain('/sitemap-remote.xml')
    expect(xml).toContain('/sitemap-slices.xml')
  })
})
