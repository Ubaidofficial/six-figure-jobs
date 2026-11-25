/**
 * @jest-environment node
 */
// Job reports read back from Feedback (lib/admin/jobReports.ts), the review queue's title rules (lib/admin/reviewQueue.ts),
// and the two admin API actions they use.
import { reportedJobId, JOB_REPORT_TYPES } from '../../lib/admin/jobReports'
import { countReviewQueue, daysUntilGone, loadReviewIds, titleProblems } from '../../lib/admin/reviewQueue'
import { getDateThreshold, MAX_DISPLAY_AGE_DAYS } from '../../lib/ingest/jobAgeFilter'
import { buildStaleJobWhere } from '../../lib/jobs/freshness'
import { buildReportMessage } from '../../lib/jobs/jobReport'

const feedbackUpdateMany = jest.fn(async (_a: unknown) => ({ count: 2 }))
const jobUpdate = jest.fn(async (_a: unknown) => ({}))
const jobFindUnique = jest.fn(async (_a: unknown) => ({ title: 'Staff Engineer', minAnnual: BigInt(900_000), maxAnnual: BigInt(1_200_000), currency: 'USD' }))
const jobFindMany = jest.fn(async (_a: unknown): Promise<unknown[]> => [{ id: 'board:a:1' }])
const jobUpdateMany = jest.fn(async (_a: unknown) => ({ count: 2 }))
const jobFindFirst = jest.fn(async (_a: unknown): Promise<unknown> => null)
const jobCount = jest.fn(async (_a: unknown) => 3)
const queryRawUnsafe = jest.fn(async (..._a: unknown[]) => [{ id: 'board:a:2', n: 4 }])
jest.mock('../../lib/prisma', () => ({
  prisma: {
    feedback: { updateMany: (a: unknown) => feedbackUpdateMany(a), update: jest.fn() },
    job: {
      update: (a: unknown) => jobUpdate(a),
      findUnique: (a: unknown) => jobFindUnique(a),
      findMany: (a: unknown) => jobFindMany(a),
      count: (a: unknown) => jobCount(a),
      updateMany: (a: unknown) => jobUpdateMany(a),
      findFirst: (a: unknown) => jobFindFirst(a),
    },
    $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a),
  },
}))
jest.mock('../../lib/admin/auth', () => ({ getAdminSession: async () => true }))
const expireJobsByIds = jest.fn(async (_ids: string[]) => ({ expired: 2 }))
jest.mock('../../lib/jobs/expiry', () => ({ expireJobsByIds: (ids: string[]) => expireJobsByIds(ids) }))
const markAdminExpired = jest.fn(async (_id: string | string[]) => undefined)
jest.mock('../../lib/admin/adminExpired', () => ({ markAdminExpired: (id: string | string[]) => markAdminExpired(id), unmarkAdminExpired: jest.fn() }))

describe('job reports', () => {
  it('reads the job id back from the message the report form saves', () => {
    const message = buildReportMessage(
      { jobId: 'board:freehire:abc-123', reason: 'wrong_salary', details: 'Says $172K, posting says $150K (base)', path: '', website: '' },
      { id: 'board:freehire:abc-123', title: 'Technical Lead (hybrid) - 2025652', company: 'Cisco' },
    )
    expect(reportedJobId('wrong-salary', message)).toBe('board:freehire:abc-123')
  })
  it('ignores other feedback and messages without a job line', () => {
    expect(reportedJobId('bug', 'Job: X (board:a:1)')).toBeNull()
    expect(reportedJobId('fake-job', 'no job line here')).toBeNull()
    expect(JOB_REPORT_TYPES).toEqual(['broken-link', 'recruiter-posting', 'wrong-salary', 'fake-job', 'job-other'])
  })
})

describe('odd titles', () => {
  it('names each problem', () => {
    expect(titleProblems('Attorney---Commercial Real Estate---Charlotte---$120k-$180k')).toEqual(['“---” separators', 'pay in the title'])
    expect(titleProblems('Staff Engineer - Payments (150K-200K)')).toEqual(['pay in the title'])
    expect(titleProblems('x'.repeat(111))).toEqual(['111 characters long'])
  })
  it('leaves normal titles alone, including ones with a number and a k', () => {
    for (const t of ['Senior Software Engineer', 'Senior Engineer, 401k plan', 'Manager (Team of 12k users)', 'Director, Product Sales - 2025652'])
      expect(titleProblems(t)).toEqual([])
  })
})

describe('review queue: only jobs whose page is up', () => {
  // A job posted before the display window answers 410 like an expired one (lib/jobs/detailAvailability.ts), so the
  // queue must not offer it (2026-11-25: the pay tab listed jobs posted 2024-08-01 and 2026-02-12).
  const now = new Date('2026-11-25T12:00:00Z')
  const cutoff = getDateThreshold(MAX_DISPLAY_AGE_DAYS, now)
  const freshOr = { OR: [{ postedAt: { gte: cutoff } }, { postedAt: null, createdAt: { gte: cutoff } }] }

  it('pay tab: not expired, flagged, and posted within the window', async () => {
    jobFindMany.mockClear()
    await loadReviewIds('pay', 100, now)
    expect(jobFindMany.mock.calls[0][0]).toMatchObject({ where: { isExpired: false, needsReview: true, ...freshOr } })
  })
  it('titles tab: the SQL checks the posting date against the same cutoff', async () => {
    queryRawUnsafe.mockClear()
    expect(await loadReviewIds('titles', 100, now)).toEqual(['board:a:2'])
    const [sql, param] = queryRawUnsafe.mock.calls[0] as [string, Date]
    expect(sql).toContain('"isExpired" = false AND ("postedAt" >= $1 OR ("postedAt" IS NULL AND "createdAt" >= $1))')
    expect(param).toEqual(cutoff)
  })
  it('the counts in the navigation use the same rules', async () => {
    jobCount.mockClear()
    queryRawUnsafe.mockClear()
    expect(await countReviewQueue()).toEqual({ pay: 3, titles: 4 })
    expect(jobCount.mock.calls[0][0]).toMatchObject({ where: { isExpired: false, needsReview: true, OR: expect.any(Array) } })
    expect(String(queryRawUnsafe.mock.calls[0][0])).toContain('"postedAt" >= $1')
    expect(queryRawUnsafe.mock.calls[0][1]).toBeInstanceOf(Date)
  })
  it('"too old" is written out, so a job with no posting date and an old stored date is still found', () => {
    expect(buildStaleJobWhere(MAX_DISPLAY_AGE_DAYS, now)).toEqual({
      OR: [{ postedAt: { lt: cutoff } }, { postedAt: null, createdAt: { lt: cutoff } }],
    })
  })
})

describe('review queue: order and time left', () => {
  it('pay tab: highest in US dollars first, whatever the currency', async () => {
    jobFindMany.mockResolvedValueOnce([
      { id: 'aud', minAnnual: BigInt(962_000), maxAnnual: BigInt(1_400_000), currency: 'AUD' }, // about US$921k
      { id: 'usd', minAnnual: BigInt(500_000), maxAnnual: BigInt(1_000_000), currency: 'USD' },
      { id: 'cad', minAnnual: null, maxAnnual: BigInt(1_000_000), currency: 'CAD' }, // about US$735k
      { id: 'unknown', minAnnual: null, maxAnnual: BigInt(2_000_000), currency: 'XYZ' },
    ])
    expect(await loadReviewIds('pay', 3)).toEqual(['usd', 'aud', 'cad'])
  })
  it('days until the page goes away, from the posting date', () => {
    const now = new Date('2026-11-25T12:00:00Z')
    expect(daysUntilGone({ postedAt: new Date('2026-11-24T12:00:00Z') }, now)).toBe(MAX_DISPLAY_AGE_DAYS - 1)
    expect(daysUntilGone({ postedAt: null, createdAt: new Date('2026-11-25T11:00:00Z') }, now)).toBe(MAX_DISPLAY_AGE_DAYS - 1)
    expect(daysUntilGone({ postedAt: new Date('2026-11-11T13:00:00Z') }, now)).toBe(0)
    expect(daysUntilGone({}, now)).toBeNull()
  })
})

describe('admin API actions', () => {
  const patch = (body: unknown) =>
    new Request('https://x.test/api', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  it('resolves every report about one job', async () => {
    const { PATCH } = await import('../../app/api/ubaid93/feedback/route')
    const res = await PATCH(patch({ jobId: 'board:freehire:abc-123', status: 'resolved' }))
    expect(await res.json()).toEqual({ ok: true, updated: 2 })
    expect(feedbackUpdateMany.mock.calls[0][0]).toEqual({
      where: { type: { in: JOB_REPORT_TYPES }, message: { contains: '(board:freehire:abc-123)' }, status: { not: 'resolved' } },
      data: { status: 'resolved' },
    })
  })
  it('refuses an unknown status', async () => {
    const { PATCH } = await import('../../app/api/ubaid93/feedback/route')
    expect((await PATCH(patch({ jobId: 'a', status: 'deleted' }))).status).toBe(400)
  })
  it('"Pay is right" clears only the review flag', async () => {
    const { PATCH } = await import('../../app/api/ubaid93/jobs/route')
    await PATCH(patch({ id: 'board:a:1', needsReview: false }))
    expect(jobUpdate).toHaveBeenCalledWith({ where: { id: 'board:a:1' }, data: { needsReview: false } })
  })
  it('runs a new yearly range through the pay rules, so the listings follow it', async () => {
    const { PATCH } = await import('../../app/api/ubaid93/jobs/route')
    jobUpdate.mockClear()
    await PATCH(patch({ id: 'board:a:1', minAnnual: 150_000, maxAnnual: 180_000, needsReview: false }))
    expect(jobUpdate.mock.calls[0][0]).toMatchObject({
      data: { minAnnual: BigInt(150_000), maxAnnual: BigInt(180_000), isHighSalary: true, salaryValidated: true, salaryRejectedReason: null },
    })
    jobUpdate.mockClear()
    await PATCH(patch({ id: 'board:a:1', minAnnual: 60_000, maxAnnual: 80_000 }))
    expect(jobUpdate.mock.calls[0][0]).toMatchObject({ data: { isHighSalary: false, salaryValidated: false } })
  })

  it('bulk Expire goes through the same expiry path and remembers every id', async () => {
    const { PATCH } = await import('../../app/api/ubaid93/jobs/route')
    const res = await PATCH(patch({ ids: ['board:a:1', 'board:a:2'], isExpired: true }))
    expect(await res.json()).toEqual({ ok: true, updated: 2 })
    expect(expireJobsByIds).toHaveBeenCalledWith(['board:a:1', 'board:a:2'])
    expect(markAdminExpired).toHaveBeenCalledWith(['board:a:1', 'board:a:2'])
  })
  it('bulk "Pay is right" clears only the review flag', async () => {
    const { PATCH } = await import('../../app/api/ubaid93/jobs/route')
    await PATCH(patch({ ids: ['board:a:1'], needsReview: false }))
    expect(jobUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ['board:a:1'] } }, data: { needsReview: false } })
  })
  it('bulk refuses anything else, an empty list, or too many', async () => {
    const { PATCH } = await import('../../app/api/ubaid93/jobs/route')
    expect((await PATCH(patch({ ids: ['a'], title: 'x' }))).status).toBe(400)
    expect((await PATCH(patch({ ids: ['a'], isExpired: true, title: 'x' }))).status).toBe(400)
    expect((await PATCH(patch({ ids: [], isExpired: true }))).status).toBe(400)
    expect((await PATCH(patch({ ids: Array.from({ length: 201 }, (_, i) => `j${i}`), isExpired: true }))).status).toBe(400)
  })
  it('"Use cleaned title" writes the cleaner\'s title with its dedupe key', async () => {
    const { PATCH } = await import('../../app/api/ubaid93/jobs/route')
    jobUpdate.mockClear()
    jobFindUnique.mockResolvedValueOnce({ id: 'j1', title: 'Attorney---Commercial Real Estate---Charlotte---$120k-$180k', companyId: 'c1', locationRaw: 'Charlotte, NC' } as never)
    const res = await PATCH(patch({ id: 'j1', cleanTitle: true }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.title).toBe('Attorney - Commercial Real Estate')
    expect(jobUpdate.mock.calls[0][0]).toMatchObject({ where: { id: 'j1' }, data: { title: 'Attorney - Commercial Real Estate', dedupeKey: expect.any(String) } })
  })
  it('"Use cleaned title" refuses when another job of the company already has that title', async () => {
    const { PATCH } = await import('../../app/api/ubaid93/jobs/route')
    jobUpdate.mockClear()
    jobFindUnique.mockResolvedValueOnce({ id: 'j1', title: 'Staff Engineer ($200k-$250k)', companyId: 'c1', locationRaw: null } as never)
    jobFindFirst.mockResolvedValueOnce({ id: 'other' })
    expect((await PATCH(patch({ id: 'j1', cleanTitle: true }))).status).toBe(409)
    expect(jobUpdate).not.toHaveBeenCalled()
  })
})
