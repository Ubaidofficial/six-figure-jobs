// The route reads getSiteUrl() once, when it is imported, and getSiteUrl() prefers SITE_URL, which CI sets to
// http://localhost:3000 for its server step. So the URL is pinned before the route is imported, not in a hook that
// runs after it.
const originalSiteUrl = process.env.SITE_URL
let GET: typeof import('../../app/sitemap.xml/route').GET

beforeAll(async () => {
  process.env.SITE_URL = 'https://www.6figjobs.com'
  jest.resetModules()
  ;({ GET } = await import('../../app/sitemap.xml/route'))
})

afterAll(() => {
  if (originalSiteUrl === undefined) delete process.env.SITE_URL
  else process.env.SITE_URL = originalSiteUrl
})

// The jobs / company / slices indexes need a database; stub them with what they return in production.
jest.mock('../../app/sitemap-jobs.xml/route', () => ({
  GET: jest.fn(async () =>
    new Response(
      '<sitemapindex><sitemap><loc>https://www.6figjobs.com/sitemap-jobs/1</loc><lastmod>2026-11-05T10:00:00.000Z</lastmod></sitemap></sitemapindex>',
    ),
  ),
}))
jest.mock('../../app/sitemap-company.xml/route', () => ({
  GET: jest.fn(async () => new Response('<sitemapindex>\n\n<!-- empty --></sitemapindex>')),
}))
jest.mock('../../app/sitemap-slices.xml/route', () => ({
  GET: jest.fn(async () =>
    new Response(
      '<sitemapindex><sitemap><loc>https://www.6figjobs.com/sitemap-slices/priority</loc></sitemap></sitemapindex>',
    ),
  ),
}))

// Whether the country sitemap has any URL needs the database too.
const mockHasCountries = jest.fn()
jest.mock('../../lib/seo/countrySitemap', () => ({ hasCountrySitemapEntries: (...a: unknown[]) => mockHasCountries(...a) }))

describe('sitemap.xml route', () => {
  beforeEach(() => mockHasCountries.mockReset().mockResolvedValue(false))
  afterEach(() => {
    delete process.env.INDEXING_PHASE
    delete process.env.SEO_INDEXATION_PHASE
  })

  it('keeps the root sitemap lightweight in phase 1', async () => {
    process.env.INDEXING_PHASE = '1'
    process.env.SEO_INDEXATION_PHASE = '1'

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('/sitemap-hubs.xml')
    expect(xml).toContain('/sitemap-salary.xml')
    expect(xml).not.toContain('/sitemap-city.xml')
    expect(xml).not.toContain('/sitemap-remote.xml')
    expect(xml).not.toContain('/sitemap-country.xml')
    expect(xml).not.toContain('/sitemap-category.xml')
    expect(xml).not.toContain('/sitemap-level.xml')
    expect(xml).not.toContain('/sitemap-browse.xml')
    expect(xml).not.toContain('/sitemap-slices.xml')
    expect(response.headers.get('x-sitemap-fallback')).toBeNull()
  })

  it('advertises the country sitemap in phase 1 only when it has URLs (the phase-1 countries)', async () => {
    process.env.INDEXING_PHASE = '1'
    process.env.SEO_INDEXATION_PHASE = '1'

    mockHasCountries.mockResolvedValue(true)
    expect(await (await GET()).text()).toContain('/sitemap-country.xml')

    mockHasCountries.mockResolvedValue(false)
    expect(await (await GET()).text()).not.toContain('/sitemap-country.xml')

    mockHasCountries.mockRejectedValue(new Error('database down'))
    const down = await GET()
    expect(down.status).toBe(200)
    expect(await down.text()).not.toContain('/sitemap-country.xml')
  })

  it('advertises all sitemap families once phase 2+ is enabled', async () => {
    mockHasCountries.mockResolvedValue(true)
    process.env.INDEXING_PHASE = '3'
    process.env.SEO_INDEXATION_PHASE = '3'

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('/sitemap-hubs.xml')
    expect(xml).toContain('/sitemap-salary.xml')
    expect(xml).toContain('/sitemap-city.xml')
    expect(xml).toContain('/sitemap-remote.xml')
    expect(xml).toContain('/sitemap-country.xml')
    expect(xml).toContain('/sitemap-category.xml')
    expect(xml).toContain('/sitemap-level.xml')
    expect(xml).toContain('/sitemap-browse.xml')
    expect(xml).toContain('/sitemap-slices/priority')
  })

  it('submits hub pages only in phase 1: no job sitemap (2026-11-11)', async () => {
    process.env.INDEXING_PHASE = '1'
    const xml = await (await GET()).text()
    expect(xml).toContain('/sitemap-hubs.xml')
    expect(xml).not.toContain('sitemap-jobs')
  })

  it('never lists another sitemap index: child indexes are expanded to their urlset files', async () => {
    process.env.INDEXING_PHASE = '2'
    const xml = await (await GET()).text()
    expect(xml).toContain('<loc>https://www.6figjobs.com/sitemap-jobs/1</loc>')
    expect(xml).toContain('<lastmod>2026-11-05T10:00:00.000Z</lastmod>')
    expect(xml).not.toContain('/sitemap-jobs.xml')
    expect(xml).not.toContain('/sitemap-company.xml')
    expect(xml).not.toContain('/sitemap-slices.xml')
  })

  it('drops a child index that has no entries instead of advertising an empty file', async () => {
    process.env.INDEXING_PHASE = '1'
    const xml = await (await GET()).text()
    expect(xml).not.toContain('sitemap-company')
  })
})
