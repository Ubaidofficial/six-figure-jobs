import { buildSliceSitemapEntries } from '../../lib/seo/slicesSitemap'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    jobSlice: {
      findMany: jest.fn(),
    },
    job: {
      count: jest.fn(),
    },
  },
}))

const findManyMock = prisma.jobSlice.findMany as jest.MockedFunction<typeof prisma.jobSlice.findMany>
const countMock = prisma.job.count as jest.MockedFunction<typeof prisma.job.count>

const now = new Date('2026-02-15T00:00:00.000Z')

function slice(slug: string, filters: unknown) {
  return {
    slug,
    updatedAt: now,
    jobCount: 12,
    filtersJson: JSON.stringify(filters),
  }
}

describe('slice sitemap builder', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    countMock.mockReset()
  })

  it('keeps longtail from duplicating priority-owned canonical URLs', async () => {
    findManyMock.mockImplementation(async (args: any) => {
      if (args?.where?.type === 'role-salary') {
        return [
          slice('software-engineer-100k-plus', {
            roleSlugs: ['software-engineer'],
            minAnnual: 100_000,
          }),
        ] as any
      }

      return [
        slice('software-engineer-united-states-100k-plus', {
          roleSlugs: ['software-engineer'],
          countryCode: 'US',
          minAnnual: 100_000,
        }),
        slice('backend-engineer-united-states-100k-plus', {
          roleSlugs: ['backend-engineer'],
          countryCode: 'US',
          minAnnual: 100_000,
        }),
      ] as any
    })
    countMock.mockResolvedValue(12)

    const entries = await buildSliceSitemapEntries('longtail')
    const locs = entries.map((entry) => entry.loc)

    expect(locs).not.toContain('https://www.6figjobs.com/jobs/software-engineer/100k-plus')
    expect(locs).toContain('https://www.6figjobs.com/jobs/backend-engineer/100k-plus')
  })
})
