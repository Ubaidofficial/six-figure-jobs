import { GET } from '../../app/sitemap-country.xml/route'
import { prisma } from '../../lib/prisma'
import { __resetIndexingPhaseCacheForTests } from '../../lib/seo/indexingPhase'

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
        return { _count: { _all: 2 }, _max: { createdAt: new Date('2026-02-14T00:00:00.000Z') } }
      }
      if (where?.countryCode === 'GB') {
        return { _count: { _all: 6 }, _max: { createdAt: new Date('2026-02-14T01:00:00.000Z') } }
      }
      return { _count: { _all: 0 }, _max: { createdAt: null } }
    })

    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('/jobs/location/united-kingdom')
    expect(xml).not.toContain('/jobs/location/united-states')
  })
})

describe('country sitemap in phase 1', () => {
  const original = process.env.INDEXING_PHASE
  afterEach(() => {
    if (original === undefined) delete process.env.INDEXING_PHASE
    else process.env.INDEXING_PHASE = original
    __resetIndexingPhaseCacheForTests()
  })

  it('only queries and lists the allowlisted countries', async () => {
    process.env.INDEXING_PHASE = '1'
    __resetIndexingPhaseCacheForTests()
    aggregateMock.mockReset()
    aggregateMock.mockImplementation(async () => ({ _count: { _all: 50 }, _max: { createdAt: new Date('2026-03-01T00:00:00.000Z') } }))

    const xml = await (await GET()).text()
    const queried = aggregateMock.mock.calls.map(([arg]: any) => arg.where?.countryCode).sort()

    expect(queried).toEqual(['AU', 'CA', 'DE', 'GB', 'US'])
    expect(xml).toContain('/jobs/location/united-states')
    expect(xml).not.toContain('/jobs/location/netherlands')
    expect(xml).not.toContain('/jobs/location/france')
  })
})
