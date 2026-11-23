/**
 * @jest-environment node
 */
// Job reports read back from Feedback (lib/admin/jobReports.ts), the review queue's title rules (lib/admin/reviewQueue.ts),
// and the two admin API actions they use.
import { reportedJobId, JOB_REPORT_TYPES } from '../../lib/admin/jobReports'
import { titleProblems } from '../../lib/admin/reviewQueue'
import { buildReportMessage } from '../../lib/jobs/jobReport'

const feedbackUpdateMany = jest.fn(async (_a: unknown) => ({ count: 2 }))
const jobUpdate = jest.fn(async (_a: unknown) => ({}))
jest.mock('../../lib/prisma', () => ({
  prisma: {
    feedback: { updateMany: (a: unknown) => feedbackUpdateMany(a), update: jest.fn() },
    job: { update: (a: unknown) => jobUpdate(a) },
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
})
