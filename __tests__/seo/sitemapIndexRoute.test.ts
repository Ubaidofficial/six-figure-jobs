import { GET } from '../../app/sitemap.xml/route'
import { resolveCoreSitemapFamilies } from '../../lib/seo/coreSitemapFamilies'
import { getCitySitemapUrls } from '../../lib/seo/citySitemap'
import { hasCountrySitemapEntries } from '../../lib/seo/countrySitemap'
import { hasRemoteRoleSitemapEntries } from '../../lib/seo/remoteSitemap'
import { hasSliceSitemapEntries } from '../../lib/seo/slicesSitemap'

jest.mock('next/cache', () => ({
  unstable_cache: (cb: any) => cb,
}))

// The route under test makes two direct prisma calls (hasSkillPages,
// getLastmod) that aren't routed through any of the mocked sitemap helpers.
// Without a mock here they hang the test waiting on a DB that isn't there
// in jest, which surfaces as a 5s test timeout in CI.
jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _max: { updatedAt: null } }),
    },
  },
}))

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

describe('sitemap.xml route conditional sitemap inclusion', () => {
  beforeAll(() => {
    process.env.SEO_INDEXATION_PHASE = '3'
  })

  afterAll(() => {
    delete process.env.SEO_INDEXATION_PHASE
  })

  beforeEach(() => {
    getCitySitemapUrlsMock.mockReset()
    resolveCoreSitemapFamiliesMock.mockReset()
    hasCountrySitemapEntriesMock.mockReset()
    hasRemoteRoleSitemapEntriesMock.mockReset()
    hasSliceSitemapEntriesMock.mockReset()
  })

  it('omits empty optional and core sitemap families', async () => {
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
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).not.toContain('/sitemap-jobs.xml')
    expect(xml).not.toContain('/sitemap-company.xml')
    expect(xml).not.toContain('/sitemap-salary.xml')
    expect(xml).not.toContain('/sitemap-category.xml')
    expect(xml).not.toContain('/sitemap-level.xml')
    expect(xml).not.toContain('/sitemap-browse.xml')
    expect(xml).not.toContain('/sitemap-city.xml')
    expect(xml).not.toContain('/sitemap-country.xml')
    expect(xml).not.toContain('/sitemap-remote.xml')
    expect(xml).not.toContain('/sitemap-slices.xml')
  })

  it('includes optional and core sitemap families when data-backed', async () => {
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
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('/sitemap-jobs.xml')
    expect(xml).toContain('/sitemap-company.xml')
    expect(xml).toContain('/sitemap-salary.xml')
    expect(xml).toContain('/sitemap-category.xml')
    expect(xml).toContain('/sitemap-level.xml')
    expect(xml).toContain('/sitemap-browse.xml')
    expect(xml).toContain('/sitemap-city.xml')
    expect(xml).toContain('/sitemap-country.xml')
    expect(xml).toContain('/sitemap-remote.xml')
    expect(xml).toContain('/sitemap-slices.xml')
  })

  it('falls back to core sitemap families when an optional family query errors', async () => {
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
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('x-sitemap-fallback')).toBe('1')
    expect(xml).toContain('/sitemap-jobs.xml')
    expect(xml).toContain('/sitemap-company.xml')
    expect(xml).not.toContain('/sitemap-city.xml')
    expect(xml).toContain('fallback_used=1 optional_families=city')
  })
})
