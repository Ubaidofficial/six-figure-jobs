// Visitor reports about a job listing ("this link is dead", "recruiter posting"…). Stored in the existing Feedback
// table (type = the report kind), so no schema change; they show up in the admin Feedback list.

export const JOB_REPORT_REASONS = {
  dead_link: { type: 'broken-link', label: 'The job is closed or the link is dead' },
  recruiter: { type: 'recruiter-posting', label: 'It is a recruiter or agency posting' },
  wrong_salary: { type: 'wrong-salary', label: 'The salary is wrong or missing' },
  fake: { type: 'fake-job', label: 'It looks fake or like a scam' },
  other: { type: 'job-other', label: 'Something else' },
} as const

export type JobReportReason = keyof typeof JOB_REPORT_REASONS

export type JobReportInput = {
  jobId: string
  reason: JobReportReason
  details: string
  path: string
  /** Honeypot: real visitors never fill this in. */
  website: string
}

export type ValidatedReport =
  | { ok: true; report: JobReportInput; honeypot: false }
  | { ok: true; honeypot: true }
  | { ok: false; error: string }

const MAX_DETAILS = 500

export function validateJobReport(body: unknown): ValidatedReport {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request' }
  const b = body as Record<string, unknown>

  // A filled honeypot is a bot. Pretend success so it gets no signal, and store nothing.
  if (typeof b.website === 'string' && b.website.trim() !== '') return { ok: true, honeypot: true }

  const jobId = typeof b.jobId === 'string' ? b.jobId.trim() : ''
  if (!jobId || jobId.length > 80) return { ok: false, error: 'Missing job' }

  const reason = typeof b.reason === 'string' ? b.reason : ''
  if (!Object.prototype.hasOwnProperty.call(JOB_REPORT_REASONS, reason)) return { ok: false, error: 'Choose a reason' }

  const details = typeof b.details === 'string' ? b.details.trim().slice(0, MAX_DETAILS) : ''
  if (reason === 'other' && details.length < 3) return { ok: false, error: 'Please add a few words of detail' }

  // Only an on-site job path is accepted, so the admin list can never be made to link elsewhere.
  const rawPath = typeof b.path === 'string' ? b.path : ''
  const path = /^\/job\/[A-Za-z0-9._~%-]{1,200}$/.test(rawPath) ? rawPath : ''

  return { ok: true, honeypot: false, report: { jobId, reason: reason as JobReportReason, details, path, website: '' } }
}

export function buildReportMessage(report: JobReportInput, job: { id: string; title: string; company?: string | null }) {
  const lines = [
    `Reason: ${JOB_REPORT_REASONS[report.reason].label}`,
    `Job: ${job.title}${job.company ? ` at ${job.company}` : ''} (${job.id})`,
  ]
  if (report.details) lines.push(`Details: ${report.details}`)
  return lines.join('\n')
}

/** Sliding-window limiter held in memory. Keys are hashed, so no IP address is stored anywhere. */
export function createRateLimiter() {
  const hits = new Map<string, number[]>()
  return {
    /** Returns true if the action is allowed (and records it), false if the key is over its limit. */
    allow(key: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
      if (recent.length >= limit) {
        hits.set(key, recent)
        return false
      }
      recent.push(now)
      hits.set(key, recent)
      if (hits.size > 5000) {
        for (const [k, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(k)
      }
      return true
    },
  }
}
