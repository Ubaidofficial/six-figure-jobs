import { JOB_REPORT_REASONS, buildReportMessage, type JobReportInput, type JobReportReason } from '../../lib/jobs/jobReport'
import { JOB_REPORT_TYPES, parseJobReport } from '../../lib/history/correctionLabels'

const at = new Date('2026-11-16T00:00:00Z')
const report = (reason: JobReportReason, details = ''): JobReportInput => ({ jobId: 'x', reason, details, path: '/job/x', website: '' })
/** A Feedback row built the way app/api/report-job/route.ts builds it, with the real message builder. */
const row = (reason: JobReportReason, job: { id: string; title: string; company?: string | null }, details = '') => ({
  id: `fb-${reason}`,
  type: JOB_REPORT_REASONS[reason].type,
  message: buildReportMessage(report(reason, details), job),
  createdAt: at,
})

describe('parseJobReport', () => {
  it('reads every kind of report back: the job, the claim and the details, from the message the app really writes', () => {
    for (const reason of Object.keys(JOB_REPORT_REASONS) as JobReportReason[]) {
      const parsed = parseJobReport(row(reason, { id: 'cmabc123', title: 'Staff Engineer', company: 'Acme' }, 'Pay is $90k not $190k'))
      expect(parsed).toMatchObject({ feedbackId: `fb-${reason}`, reportedAt: at, reason, jobId: 'cmabc123', details: 'Pay is $90k not $190k' })
    }
  })

  it('maps reasons to the field the visitor is disputing', () => {
    const field = (reason: JobReportReason) => parseJobReport(row(reason, { id: 'j', title: 't' }))?.claim.field
    expect(field('wrong_salary')).toBe('pay')
    expect(field('dead_link')).toBe('availability')
    expect(field('recruiter')).toBe('employerType')
    expect(field('fake')).toBe('authenticity')
    expect(field('other')).toBe('other')
  })

  it('finds the id when the title or company holds parentheses, and when the company is missing', () => {
    expect(parseJobReport(row('wrong_salary', { id: 'id9', title: 'Engineer (Remote) (US)', company: 'Acme (UK) Ltd' }))?.jobId).toBe('id9')
    expect(parseJobReport(row('dead_link', { id: 'id8', title: 'Designer', company: null }))?.jobId).toBe('id8')
  })

  it('has no details when the visitor added none, and keeps a multi-line note whole', () => {
    expect(parseJobReport(row('dead_link', { id: 'j', title: 't' }))?.details).toBeNull()
    expect(parseJobReport(row('other', { id: 'j', title: 't' }, 'line one\nline two'))?.details).toBe('line one\nline two')
  })

  it('ignores feedback that is not a job report, and a report whose message names no job', () => {
    expect(parseJobReport({ id: 'f', type: 'bug', message: 'Job: A (id)', createdAt: at })).toBeNull()
    expect(parseJobReport({ id: 'f', type: 'wrong-salary', message: 'Reason: x', createdAt: at })).toBeNull()
  })

  it('lists the Feedback types that are job reports', () => {
    expect(JOB_REPORT_TYPES.sort()).toEqual(['broken-link', 'fake-job', 'job-other', 'recruiter-posting', 'wrong-salary'])
  })
})
