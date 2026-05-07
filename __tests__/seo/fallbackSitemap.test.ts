jest.mock('../../lib/runtime/fallback', () => ({
  logRuntimeFallback: jest.fn(),
}))

import { buildFallbackUrlsetResponse } from '../../lib/seo/fallbackSitemap'

describe('buildFallbackUrlsetResponse', () => {
  it('returns an empty valid sitemap when no fallback paths are supplied', async () => {
    const response = buildFallbackUrlsetResponse('sitemap-jobs', [], new Error('db down'))
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('x-sitemap-fallback')).toBe('1')
    expect(xml).toContain('<urlset')
    expect(xml).toContain('fallback_used=1')
    expect(xml).not.toContain('<loc>')
  })
})
