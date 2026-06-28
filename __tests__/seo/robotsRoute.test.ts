import { GET } from '../../app/robots.txt/route'

describe('robots route sitemap declarations', () => {
  const originalSiteEnv = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.6figjobs.com'
  })

  afterEach(() => {
    delete process.env.INDEXING_PHASE
    delete process.env.SEO_INDEXATION_PHASE
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteEnv
  })

  it('keeps production robots deterministic in phase 1', async () => {
    process.env.INDEXING_PHASE = '1'
    process.env.SEO_INDEXATION_PHASE = '1'

    const response = await GET()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/)
    expect(body).toMatch(/Sitemap: .*\/sitemap-jobs\.xml/)
    expect(body).toMatch(/Sitemap: .*\/sitemap-company\.xml/)
    expect(body).toMatch(/Sitemap: .*\/sitemap-salary\.xml/)
    expect(body).not.toContain('sitemap-blog.xml')
    expect(body).not.toContain('fallback_used=1')
  })

  it('returns a full disallow on staging', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://staging.6figjobs.com'

    const response = await GET()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toBe('User-agent: *\nDisallow: /')
  })
})
