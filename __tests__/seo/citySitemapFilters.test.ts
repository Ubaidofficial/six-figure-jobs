import { CITY_TARGETS } from '../../lib/seo/pseoTargets'
import { getCitySitemapUrls } from '../../lib/seo/citySitemap'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      aggregate: jest.fn(),
    },
  },
}))

const aggregateMock = (prisma.job.aggregate as unknown) as jest.Mock

describe('city sitemap filters', () => {
  beforeEach(() => {
    aggregateMock.mockReset()
  })

  it('excludes cities below robots threshold and includes cities that meet it', async () => {
    // London clears the unified MIN_CITY_INDEXABLE_JOBS=5 gate; New York is
    // below it. Counts bumped after the 1 → 5 threshold change in WIP.
    aggregateMock.mockImplementation(async ({ where }: any) => {
      if (where?.citySlug === 'new-york' && where?.countryCode === 'US') {
        return { _count: { _all: 2 }, _max: { updatedAt: new Date('2026-02-14T00:00:00.000Z') } }
      }
      if (where?.citySlug === 'london' && where?.countryCode === 'GB') {
        return { _count: { _all: 6 }, _max: { updatedAt: new Date('2026-02-14T01:00:00.000Z') } }
      }
      return { _count: { _all: 0 }, _max: { updatedAt: null } }
    })

    const urls = await getCitySitemapUrls()
    const locs = urls.map((row) => row.loc)

    expect(locs.some((loc) => loc.endsWith('/jobs/city/new-york'))).toBe(false)
    expect(locs.some((loc) => loc.endsWith('/jobs/city/london'))).toBe(true)
  })

  it('uses one aggregate query per city target with city+country filters', async () => {
    aggregateMock.mockResolvedValue({ _count: { _all: 0 }, _max: { updatedAt: null } })

    await getCitySitemapUrls()

    expect(aggregateMock).toHaveBeenCalledTimes(CITY_TARGETS.length)
    expect(aggregateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          citySlug: 'london',
          countryCode: 'GB',
        }),
      }),
    )
  })
})
