import { GET } from '../../app/sitemap-jobs/[page]/route'
import { prisma } from '../../lib/prisma'
import { getShortStableIdForJobId } from '../../lib/jobs/jobSlug'
import { MAX_INDEXABLE_JOB_AGE_DAYS } from '../../lib/jobs/freshness'

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
  afterEach(() => {
    delete process.env.SEO_CORE_JOB_URLS_PER_SHARD
  })

  const listable = (n: number) => ({
    id: `job${n}`,
    shortId: getShortStableIdForJobId(`job${n}`),
    title: `Valid Job ${n}`,
    isExpired: false,
    postedAt: new Date(),
    updatedAt: new Date(Date.now() - n * 1000),
    salaryValidated: true,
    salaryConfidence: 100,
    currency: 'USD',
    minAnnual: 150000,
    company: `Company ${n}`,
    descriptionHtml: `<p>Valid description for job ${n} </p>`.repeat(20),
    remote: true,
  })
  const urlCount = (xml: string) => (xml.match(/<url>/g) ?? []).length

  it('lists at most SEO_CORE_JOB_URLS_PER_SHARD jobs, keeping the newest', async () => {
    process.env.SEO_CORE_JOB_URLS_PER_SHARD = '3'
    findManyMock.mockResolvedValueOnce(Array.from({ length: 4 }, (_, i) => listable(i + 1)) as any)
    const xml = await (await GET({} as any, { params: Promise.resolve({ page: '1' }) })).text()
    expect(urlCount(xml)).toBe(3)
    expect(xml).toContain(getShortStableIdForJobId('job1'))
    expect(xml).not.toContain(getShortStableIdForJobId('job4'))
  })

  it('reads only as many rows as the cap can use, plus room for rows the checks drop, never more than 20,000', async () => {
    findManyMock.mockResolvedValue([] as any)
    process.env.SEO_CORE_JOB_URLS_PER_SHARD = '5000'
    await GET({} as any, { params: Promise.resolve({ page: '1' }) })
    expect(findManyMock.mock.calls[0][0]).toMatchObject({ take: 7500 })

    findManyMock.mockClear()
    process.env.SEO_CORE_JOB_URLS_PER_SHARD = '20000'
    await GET({} as any, { params: Promise.resolve({ page: '1' }) })
    expect(findManyMock.mock.calls[0][0]).toMatchObject({ take: 20000 })

    findManyMock.mockClear()
    delete process.env.SEO_CORE_JOB_URLS_PER_SHARD
    await GET({} as any, { params: Promise.resolve({ page: '1' }) })
    expect(findManyMock.mock.calls[0][0]).toMatchObject({ take: 20000 })
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
    expect(xml).not.toContain(getShortStableIdForJobId('job3'))
  })

  it('applies the stability buffer (MAX_INDEXABLE_JOB_AGE_DAYS - 2) to the query', async () => {
    findManyMock.mockResolvedValueOnce([])
    await GET({} as any, { params: Promise.resolve({ page: '1' }) })
    
    expect(findManyMock).toHaveBeenCalledTimes(1)
    const callArgs = findManyMock.mock.calls[0][0]
    
    // Search the AND array for the freshness query block
    const andClauses = callArgs?.where?.AND || []
    const freshnessClause = andClauses.find((c: any) => c.OR && c.OR.some((orClause: any) => orClause.lastSeenAt?.gte))
    
    expect(freshnessClause).toBeDefined()
    
    const expectedDaysAgo = MAX_INDEXABLE_JOB_AGE_DAYS - 2
    // getDateThreshold uses baseDate.setDate(baseDate.getDate() - days), which uses calendar days rather than exact ms
    const expectedDate = new Date()
    expectedDate.setDate(expectedDate.getDate() - expectedDaysAgo)
    const expectedDateMs = expectedDate.getTime()
    
    // Allow 1 minute of slack
    const gteDate = freshnessClause.OR[0].lastSeenAt.gte
    const actualDateMs = gteDate.getTime()
    expect(Math.abs(actualDateMs - expectedDateMs)).toBeLessThan(60 * 1000)
  })
})
