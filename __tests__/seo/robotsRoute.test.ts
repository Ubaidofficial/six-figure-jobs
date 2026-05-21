import { GET } from '../../app/robots.txt/route'
import { resolveCoreSitemapFamilies } from '../../lib/seo/coreSitemapFamilies'
import { getCitySitemapUrls } from '../../lib/seo/citySitemap'
import { hasCountrySitemapEntries } from '../../lib/seo/countrySitemap'
import { hasRemoteRoleSitemapEntries } from '../../lib/seo/remoteSitemap'
import { hasSliceSitemapEntries } from '../../lib/seo/slicesSitemap'

jest.mock('../../lib/seo/coreSitemapFamilies', () => ({
  resolveCoreSitemapFamilies: jest.fn(),
}))

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
const resolveCoreSitemapFamiliesMock = resolveCoreSitemapFamilies as jest.MockedFunction<
  typeof resolveCoreSitemapFamilies
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
    resolveCoreSitemapFamiliesMock.mockReset()
    hasCountrySitemapEntriesMock.mockReset()
    hasRemoteRoleSitemapEntriesMock.mockReset()
    hasSliceSitemapEntriesMock.mockReset()
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteEnv
  })

  it('advertises the sitemap index and blog sitemap when jobs are empty', async () => {
    getCitySitemapUrlsMock.mockResolvedValue([])
    resolveCoreSitemapFamiliesMock.mockResolvedValue({
      hasJobUrls: false,
      hasCompanyUrls: false,
      hasSalaryUrls: false,
      hasCategoryUrls: false,
      hasLevelUrls: false,
      hasBrowseUrls: false,
      failedFamilies: [],
    })
    hasCountrySitemapEntriesMock.mockResolvedValue(false)
    hasRemoteRoleSitemapEntriesMock.mockResolvedValue(false)
    hasSliceSitemapEntriesMock.mockResolvedValue(false)

    const response = await GET()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/)
    expect(body).toMatch(/Sitemap: .*\/sitemap-blog\.xml/)
    expect(body).not.toContain('sitemap-jobs.xml')
    expect(body).not.toContain('sitemap-company.xml')
    expect(body).not.toContain('sitemap-salary.xml')
    expect(body).not.toContain('sitemap-category.xml')
    expect(body).not.toContain('sitemap-level.xml')
    expect(body).not.toContain('sitemap-browse.xml')
    expect(body).not.toContain('sitemap-city.xml')
    expect(body).not.toContain('sitemap-country.xml')
    expect(body).not.toContain('sitemap-remote.xml')
    expect(body).not.toContain('sitemap-slices.xml')
  })

  it('advertises the sitemap index, jobs sitemap, and blog sitemap when available', async () => {
    getCitySitemapUrlsMock.mockResolvedValue([
      {
        loc: 'https://www.6figjobs.com/jobs/city/new-york',
        lastmod: '2026-03-01T00:00:00.000Z',
      },
    ])
    resolveCoreSitemapFamiliesMock.mockResolvedValue({
      hasJobUrls: true,
      hasCompanyUrls: true,
      hasSalaryUrls: true,
      hasCategoryUrls: true,
      hasLevelUrls: true,
      hasBrowseUrls: true,
      failedFamilies: [],
    })
    hasCountrySitemapEntriesMock.mockResolvedValue(true)
    hasRemoteRoleSitemapEntriesMock.mockResolvedValue(true)
    hasSliceSitemapEntriesMock.mockResolvedValue(true)

    const response = await GET()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/)
    expect(body).toMatch(/Sitemap: .*\/sitemap-jobs\.xml/)
    expect(body).toMatch(/Sitemap: .*\/sitemap-blog\.xml/)
    expect(body).not.toContain('sitemap-company.xml')
    expect(body).not.toContain('sitemap-salary.xml')
    expect(body).not.toContain('sitemap-category.xml')
    expect(body).not.toContain('sitemap-level.xml')
    expect(body).not.toContain('sitemap-browse.xml')
    expect(body).not.toContain('sitemap-city.xml')
    expect(body).not.toContain('sitemap-country.xml')
    expect(body).not.toContain('sitemap-remote.xml')
    expect(body).not.toContain('sitemap-slices.xml')
  })

  it('falls back to core sitemap lines when an optional family query errors', async () => {
    getCitySitemapUrlsMock.mockRejectedValue(new Error('city query failed'))
    resolveCoreSitemapFamiliesMock.mockResolvedValue({
      hasJobUrls: true,
      hasCompanyUrls: true,
      hasSalaryUrls: false,
      hasCategoryUrls: false,
      hasLevelUrls: false,
      hasBrowseUrls: false,
      failedFamilies: [],
    })
    hasCountrySitemapEntriesMock.mockResolvedValue(false)
    hasRemoteRoleSitemapEntriesMock.mockResolvedValue(false)
    hasSliceSitemapEntriesMock.mockResolvedValue(false)

    const response = await GET()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('x-robots-fallback')).toBe('1')
    expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/)
    expect(body).toMatch(/Sitemap: .*\/sitemap-jobs\.xml/)
    expect(body).toMatch(/Sitemap: .*\/sitemap-blog\.xml/)
    expect(body).not.toContain('sitemap-company.xml')
    expect(body).not.toContain('sitemap-city.xml')
    expect(body).toContain('# fallback_used=1 optional_families=city')
  })
})
