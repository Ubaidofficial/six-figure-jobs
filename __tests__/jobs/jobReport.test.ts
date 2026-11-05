import { JOB_REPORT_REASONS, buildReportMessage, createRateLimiter, validateJobReport } from '../../lib/jobs/jobReport'

const base = { jobId: 'job_123', reason: 'dead_link', details: '', path: '/job/some-job-j-abc123', website: '' }

describe('validateJobReport', () => {
  it('accepts a valid report', () => {
    const r = validateJobReport(base)
    expect(r.ok && !r.honeypot && r.report.reason).toBe('dead_link')
  })

  it('rejects unknown reasons, including prototype keys', () => {
    for (const reason of ['nope', '', '__proto__', 'constructor', 'toString']) {
      expect(validateJobReport({ ...base, reason }).ok).toBe(false)
    }
  })

  it('requires a job id and rejects absurd ones', () => {
    expect(validateJobReport({ ...base, jobId: '' }).ok).toBe(false)
    expect(validateJobReport({ ...base, jobId: 'x'.repeat(81) }).ok).toBe(false)
    expect(validateJobReport(null).ok).toBe(false)
  })

  it('treats a filled honeypot as a silent no-op', () => {
    const r = validateJobReport({ ...base, website: 'http://spam.example' })
    expect(r).toEqual({ ok: true, honeypot: true })
  })

  it('requires some detail for "other"', () => {
    expect(validateJobReport({ ...base, reason: 'other', details: '' }).ok).toBe(false)
    expect(validateJobReport({ ...base, reason: 'other', details: 'wrong city' }).ok).toBe(true)
  })

  it('truncates details and only keeps on-site /job/ paths', () => {
    const long = validateJobReport({ ...base, details: 'a'.repeat(900) })
    expect(long.ok && !long.honeypot && long.report.details.length).toBe(500)
    for (const path of ['https://evil.example/job/x', '//evil.example', '/admin', '/job/', '/job/a b']) {
      const r = validateJobReport({ ...base, path })
      expect(r.ok && !r.honeypot && r.report.path).toBe('')
    }
  })
})

describe('buildReportMessage', () => {
  it('names the reason, job and details', () => {
    const v = validateJobReport({ ...base, reason: 'recruiter', details: 'agency repost' })
    if (!v.ok || v.honeypot) throw new Error('unexpected')
    const msg = buildReportMessage(v.report, { id: 'job_123', title: 'Staff Engineer', company: 'Acme' })
    expect(msg).toContain(JOB_REPORT_REASONS.recruiter.label)
    expect(msg).toContain('Staff Engineer at Acme (job_123)')
    expect(msg).toContain('Details: agency repost')
  })
})

describe('createRateLimiter', () => {
  it('allows up to the limit inside the window, then blocks, then recovers', () => {
    const l = createRateLimiter()
    const H = 3_600_000
    expect(l.allow('k', 2, H, 0)).toBe(true)
    expect(l.allow('k', 2, H, 1000)).toBe(true)
    expect(l.allow('k', 2, H, 2000)).toBe(false)
    expect(l.allow('other', 2, H, 2000)).toBe(true)
    expect(l.allow('k', 2, H, H + 1500)).toBe(true) // first two have aged out
  })
})
