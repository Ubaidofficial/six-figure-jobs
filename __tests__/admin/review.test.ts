/**
 * @jest-environment node
 */
// Job reports read back from Feedback (lib/admin/jobReports.ts), the review queue's title rules (lib/admin/reviewQueue.ts),
// and the two admin API actions they use.
import { reportedJobId, JOB_REPORT_TYPES } from '../../lib/admin/jobReports'
import { countReviewQueue, loadReviewIds, titleProblems } from '../../lib/admin/reviewQueue'
import { getDateThreshold, MAX_DISPLAY_AGE_DAYS } from '../../lib/ingest/jobAgeFilter'
import { buildStaleJobWhere } from '../../lib/jobs/freshness'
import { buildReportMessage } from '../../lib/jobs/jobReport'

const feedbackUpdateMany = jest.fn(async (_a: unknown) => ({ count: 2 }))
const jobUpdate = jest.fn(async (_a: unknown) => ({}))
const jobFindUnique = jest.fn(async (_a: unknown) => ({ title: 'Staff Engineer', minAnnual: BigInt(900_000), maxAnnual: BigInt(1_200_000), currency: 'USD' }))
const jobFindMany = jest.fn(async (_a: unknown) => [{ id: 'board:a:1' }])
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
    },
    $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a),
  },
}))
jest.mock('../../lib/admin/auth', () => ({ getAdminSession: async () => true }))
jest.mock('../../lib/jobs/expiry', () => ({ expireJobsByIds: jest.fn() }))

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
})
