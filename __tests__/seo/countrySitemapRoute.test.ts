import { GET } from '../../app/sitemap-country.xml/route'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      aggregate: jest.fn(),
    },
  },
}))

const aggregateMock = (prisma.job.aggregate as unknown) as jest.Mock

describe('country sitemap route filters', () => {
  beforeEach(() => {
    aggregateMock.mockReset()
  })

  it('omits countries below robots threshold and keeps indexable countries', async () => {
    // GB clears the unified MIN_COUNTRY_INDEXABLE_JOBS=5 gate; US is below it.
    aggregateMock.mockImplementation(async ({ where }: any) => {
      if (where?.countryCode === 'US') {
        return { _count: { _all: 2 }, _max: { updatedAt: new Date('2026-02-14T00:00:00.000Z') } }
      }
      if (where?.countryCode === 'GB') {
        return { _count: { _all: 6 }, _max: { updatedAt: new Date('2026-02-14T01:00:00.000Z') } }
      }
      return { _count: { _all: 0 }, _max: { updatedAt: null } }
    })

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('/jobs/location/united-kingdom')
    expect(xml).not.toContain('/jobs/location/united-states')
  })
})
