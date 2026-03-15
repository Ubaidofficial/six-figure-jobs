import { GET } from '../../app/sitemap-salary.xml/route'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}))

const countMock = prisma.job.count as jest.MockedFunction<typeof prisma.job.count>
const aggregateMock = prisma.job.aggregate as jest.MockedFunction<typeof prisma.job.aggregate>

describe('sitemap-salary.xml route', () => {
  beforeEach(() => {
    countMock.mockReset()
    aggregateMock.mockReset()
  })

  it('omits empty salary tiers from the sitemap', async () => {
    countMock
      .mockResolvedValueOnce(42)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(3)

    aggregateMock
      .mockResolvedValueOnce({ _max: { updatedAt: new Date('2026-03-10T00:00:00.000Z') } } as any)
      .mockResolvedValueOnce({ _max: { updatedAt: null } } as any)
      .mockResolvedValueOnce({ _max: { updatedAt: new Date('2026-03-11T00:00:00.000Z') } } as any)
      .mockResolvedValueOnce({ _max: { updatedAt: new Date('2026-03-12T00:00:00.000Z') } } as any)

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('/jobs/100k-plus')
    expect(xml).not.toContain('/jobs/200k-plus')
    expect(xml).toContain('/jobs/300k-plus')
    expect(xml).toContain('/jobs/400k-plus')
  })
})
