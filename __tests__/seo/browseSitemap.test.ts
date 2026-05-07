import { buildBrowseSitemapReport } from '../../lib/seo/browseSitemap'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

const countMock = prisma.job.count as jest.MockedFunction<typeof prisma.job.count>
const groupByMock = prisma.job.groupBy as jest.MockedFunction<typeof prisma.job.groupBy>
const findManyMock = prisma.job.findMany as jest.MockedFunction<typeof prisma.job.findMany>

describe('browse sitemap ownership', () => {
  beforeEach(() => {
    countMock.mockReset()
    groupByMock.mockReset()
    findManyMock.mockReset()
  })

  it('omits URLs owned by dedicated city and remote sitemap families', async () => {
    countMock.mockResolvedValue(0)
    groupByMock
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([
        { citySlug: 'new-york', countryCode: 'US', _count: { _all: 10 } },
      ] as any)
      .mockResolvedValueOnce([{ roleSlug: 'software-engineer', _count: { _all: 12 } }] as any)
      .mockResolvedValueOnce([
        { roleSlug: 'software-engineer', _count: { _all: 8 } },
      ] as any)
      .mockResolvedValueOnce([
        { roleSlug: 'software-engineer', citySlug: 'new-york', _count: { _all: 6 } },
      ] as any)
    findManyMock.mockResolvedValue([] as any)

    const report = await buildBrowseSitemapReport(3)
    const includedPaths = report.included.map((row) => row.path)

    expect(includedPaths).toContain('/jobs/software-engineer')
    expect(includedPaths).toContain('/jobs/software-engineer/city/new-york')
    expect(includedPaths).not.toContain('/jobs/city/new-york')
    expect(includedPaths).not.toContain('/remote/software-engineer')
  })
})
