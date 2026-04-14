import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('../../lib/seo/fallbackSitemap', () => ({
  buildFallbackUrlsetResponse: jest.fn(() => new Response('<urlset />', { status: 200 })),
}))

const findManyMock = prisma.job.findMany as jest.MockedFunction<typeof prisma.job.findMany>

describe('sitemap-jobs.xml route', () => {
  beforeEach(() => {
    findManyMock.mockReset()
  })

  it('does not emit /sitemap-jobs/1 when there are zero eligible jobs', async () => {
    findManyMock.mockResolvedValueOnce([])
    const { GET } = await import('../../app/sitemap-jobs.xml/route')

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('<sitemapindex')
    expect(xml).not.toContain('/sitemap-jobs/1')
  })
})
