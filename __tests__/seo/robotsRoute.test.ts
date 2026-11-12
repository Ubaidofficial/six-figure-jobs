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
    // Phase 1 submits hub pages only: sitemap-jobs.xml is declared from phase 2 (2026-11-11).
    expect(body).not.toContain('sitemap-jobs.xml')
    // Child sitemaps are discovered through the index.
    expect(body).not.toContain('sitemap-company.xml')
    expect(body).not.toContain('sitemap-salary.xml')
    expect((body.match(/^Sitemap:/gm) || []).length).toBe(1)
    expect(body).not.toContain('sitemap-blog.xml')
    expect(body).not.toContain('fallback_used=1')
  })

  it('declares sitemap-jobs.xml for Google Jobs discovery from phase 2', async () => {
    process.env.INDEXING_PHASE = '2'
    process.env.SEO_INDEXATION_PHASE = '2'
    const body = await (await GET()).text()
    expect(body).toMatch(/Sitemap: .*\/sitemap-jobs\.xml/)
    expect((body.match(/^Sitemap:/gm) || []).length).toBe(2)
    process.env.INDEXING_PHASE = '1'
    process.env.SEO_INDEXATION_PHASE = '1'
  })

  it('slows SEO-tool crawlers and PerplexityBot, never Googlebot or Bingbot, and keeps their disallows', async () => {
    const body = await (await GET()).text()
    const groups = body.split(/\n\s*\n/)
    const seoTools = groups.find((g) => g.includes('User-agent: AhrefsBot'))!
    for (const bot of ['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'PetalBot']) expect(seoTools).toContain(`User-agent: ${bot}`)
    expect(seoTools).toContain('Crawl-delay: 5')
    const perplexity = groups.find((g) => g.includes('User-agent: PerplexityBot'))!
    expect(perplexity).toContain('Crawl-delay: 2')
    for (const g of [seoTools, perplexity]) {
      for (const rule of ['Disallow: /search', 'Disallow: /api/', 'Disallow: /ubaid93/']) expect(g).toContain(rule)
    }
    expect(body).not.toMatch(/Googlebot|bingbot/i)
    // The default group is unchanged: no delay for everyone else.
    expect(groups[0]).not.toContain('Crawl-delay')
  })

  it('keeps SEO-tool and AI crawlers off the server-drawn preview images, never Google or link-preview bots', async () => {
    const body = await (await GET()).text()
    const groups = body.split(/\n\s*\n/)
    for (const bot of ['AhrefsBot', 'PerplexityBot', 'OAI-SearchBot', 'GPTBot', 'ClaudeBot']) {
      const g = groups.find((x) => x.includes(`User-agent: ${bot}`))!
      expect(g).toContain('Disallow: /*/opengraph-image')
    }
    // The default group (Googlebot, Bingbot, Facebook, X, LinkedIn, Slack) still fetches them.
    expect(groups[0]).not.toContain('opengraph-image')
    const ai = groups.find((x) => x.includes('User-agent: OAI-SearchBot'))!
    expect(ai).toContain('Crawl-delay: 2')
    for (const rule of ['Disallow: /search', 'Disallow: /api/', 'Disallow: /ubaid93/']) expect(ai).toContain(rule)
  })

  it('returns a full disallow on staging', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://staging.6figjobs.com'

    const response = await GET()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toBe('User-agent: *\nDisallow: /')
  })
})
