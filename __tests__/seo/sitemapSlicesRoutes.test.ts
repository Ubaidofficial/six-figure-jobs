import { GET as getSlicesIndex } from '../../app/sitemap-slices.xml/route'
import { GET as getPrioritySliceSitemap } from '../../app/sitemap-slices/priority/route'
import { buildSliceSitemapEntries } from '../../lib/seo/slicesSitemap'

jest.mock('../../lib/seo/slicesSitemap', () => ({
  buildSliceSitemapEntries: jest.fn(),
}))

const buildEntriesMock = buildSliceSitemapEntries as unknown as jest.Mock

const SAMPLE_LASTMOD = '2026-02-15T00:00:00.000Z'
const SAMPLE_LOC = 'https://www.6figjobs.com/jobs/100k-plus/software-engineer'

describe('slice sitemap index + child routes', () => {
  beforeEach(() => {
    buildEntriesMock.mockReset()
  })

  it('excludes priority from index when priority has zero URLs', async () => {
    buildEntriesMock.mockImplementation(async (shard: 'priority' | 'longtail') => {
      if (shard === 'priority') return []
      return [{ loc: SAMPLE_LOC, lastmod: SAMPLE_LASTMOD }]
    })

    const response = await getSlicesIndex()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).not.toContain('/sitemap-slices/priority')
    expect(xml).toContain('/sitemap-slices/longtail')
    expect(buildEntriesMock).toHaveBeenCalledWith('priority', { limit: 1 })
    expect(buildEntriesMock).toHaveBeenCalledWith('longtail', { limit: 1 })
  })

  it('includes priority in index and emits loc entries when priority has URLs', async () => {
    buildEntriesMock.mockImplementation(async (shard: 'priority' | 'longtail') => {
      if (shard === 'priority') {
        return [{ loc: SAMPLE_LOC, lastmod: SAMPLE_LASTMOD }]
      }
      return []
    })

    const indexResponse = await getSlicesIndex()
    const indexXml = await indexResponse.text()
    expect(indexResponse.status).toBe(200)
    expect(indexXml).toContain('/sitemap-slices/priority')
    expect(indexXml).not.toContain('/sitemap-slices/longtail')

    const childResponse = await getPrioritySliceSitemap()
    const childXml = await childResponse.text()
    expect(childResponse.status).toBe(200)
    expect(childXml).toContain('<urlset')
    expect(childXml).toContain(`<loc>${SAMPLE_LOC}</loc>`)
  })

  it('priority child stays well-formed when empty', async () => {
    buildEntriesMock.mockResolvedValue([])

    const response = await getPrioritySliceSitemap()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('<urlset')
    expect(xml).not.toContain('<loc>')
  })
})
