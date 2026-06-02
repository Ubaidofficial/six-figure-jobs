import { GET } from '../../app/sitemap-jobs/[page]/route'
import { prisma } from '../../lib/prisma'
import { getShortStableIdForJobId } from '../../lib/jobs/jobSlug'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('next/cache', () => ({
  unstable_cache: (cb: any) => cb,
}))

const findManyMock = prisma.job.findMany as jest.MockedFunction<typeof prisma.job.findMany>

describe('sitemap-jobs/[page] route', () => {
  beforeEach(() => {
    findManyMock.mockReset()
  })

  it('excludes jobs that are marked expired or fail quality gates', async () => {
    const validShortId = getShortStableIdForJobId('job1')
    findManyMock.mockResolvedValueOnce([
      {
        id: 'job1',
        shortId: validShortId,
        title: 'Valid Job',
        isExpired: false,
        postedAt: new Date(),
        updatedAt: new Date(),
        salaryValidated: true,
        salaryConfidence: 100,
        currency: 'USD',
        minAnnual: 150000,
        company: 'Company',
        descriptionHtml: '<p>Valid desc '.repeat(20) + '</p>',
        remote: true,
      },
      {
        id: 'job2',
        shortId: getShortStableIdForJobId('job2'),
        title: 'Expired Job',
        isExpired: true, // Should fail
        postedAt: new Date(),
        updatedAt: new Date(),
        salaryValidated: true,
        salaryConfidence: 100,
        currency: 'USD',
        minAnnual: 150000,
        company: 'Company',
        descriptionHtml: '<p>Valid desc '.repeat(20) + '</p>',
        remote: true,
      },
      {
        id: 'job3',
        shortId: getShortStableIdForJobId('job3'),
        title: 'No Company Job',
        isExpired: false,
        postedAt: new Date(),
        updatedAt: new Date(),
        company: null, // Fails gate
        salaryValidated: true,
        salaryConfidence: 100,
        currency: 'USD',
        minAnnual: 150000,
        descriptionHtml: '<p>Valid desc '.repeat(20) + '</p>',
        remote: true,
      }
    ] as any)

    const response = await GET({} as any, { params: Promise.resolve({ page: '1' }) })
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain(validShortId)
    expect(xml).not.toContain(getShortStableIdForJobId('job2'))
    expect(xml).not.toContain(getShortStableIdForJobId('job3'))
  })
})
