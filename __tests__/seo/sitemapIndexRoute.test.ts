import { GET } from '../../app/sitemap.xml/route'

describe('sitemap.xml route', () => {
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
    expect(xml).toContain('/sitemap-jobs.xml')
    expect(xml).toContain('/sitemap-company.xml')
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

  it('advertises all sitemap families once phase 2+ is enabled', async () => {
    process.env.INDEXING_PHASE = '3'
    process.env.SEO_INDEXATION_PHASE = '3'

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('/sitemap-hubs.xml')
    expect(xml).toContain('/sitemap-jobs.xml')
    expect(xml).toContain('/sitemap-company.xml')
    expect(xml).toContain('/sitemap-salary.xml')
    expect(xml).toContain('/sitemap-city.xml')
    expect(xml).toContain('/sitemap-remote.xml')
    expect(xml).toContain('/sitemap-country.xml')
    expect(xml).toContain('/sitemap-category.xml')
    expect(xml).toContain('/sitemap-level.xml')
    expect(xml).toContain('/sitemap-browse.xml')
    expect(xml).toContain('/sitemap-slices.xml')
  })
})
