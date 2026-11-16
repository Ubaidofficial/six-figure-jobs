// lib/history/correctionLabels.ts
//
// Visitors' job reports ("the salary is wrong", "the link is dead", ...) are stored in Feedback with no job column; the job is
// named inside the message that lib/jobs/jobReport.ts builds. This reads a report back into a candidate label: which job, which
// field the visitor says is wrong, and what they added. Pure; scripts/exportCorrectionLabels.ts loads the rows.
//
// A report is a CLAIM, not ground truth: visitors are wrong, mistaken or malicious (the report form has a honeypot and a rate
// limit, not a verdict). The export leaves `verdict` empty for a person to fill in; only reviewed examples should become a gold
// set that an extractor's precision is measured on.
import { JOB_REPORT_REASONS, type JobReportReason } from '../jobs/jobReport'

export type CorrectionClaim = {
  field: 'availability' | 'employerType' | 'pay' | 'authenticity' | 'other'
  says: string
}

export type CorrectionCandidate = {
  feedbackId: string
  reportedAt: Date
  reason: JobReportReason
  claim: CorrectionClaim
  jobId: string
  /** What the visitor added, or null. */
  details: string | null
}

const REASON_BY_TYPE = new Map<string, JobReportReason>(
  (Object.entries(JOB_REPORT_REASONS) as Array<[JobReportReason, { type: string }]>).map(([reason, v]) => [v.type, reason]),
)

const CLAIMS: Record<JobReportReason, CorrectionClaim> = {
  dead_link: { field: 'availability', says: 'the job is closed or the link is dead' },
  recruiter: { field: 'employerType', says: 'it is a recruiter or agency posting' },
  wrong_salary: { field: 'pay', says: 'the salary is wrong or missing' },
  fake: { field: 'authenticity', says: 'it looks fake or like a scam' },
  other: { field: 'other', says: 'something else (see details)' },
}

/** The Feedback `type` values that are job reports. */
export const JOB_REPORT_TYPES: string[] = Object.values(JOB_REPORT_REASONS).map((r) => r.type)

/** A candidate label from one Feedback row, or null when it is not a job report or names no job. */
export function parseJobReport(row: { id: string; type: string; message: string; createdAt: Date }): CorrectionCandidate | null {
  const reason = REASON_BY_TYPE.get(row.type)
  if (!reason) return null
  // buildReportMessage writes "Job: <title> at <company> (<id>)"; a title may hold parentheses, the id never holds a space.
  const jobLine = /^Job: .*\(([^()\s]+)\)[ \t]*$/m.exec(row.message)
  if (!jobLine) return null
  const at = row.message.search(/^Details: /m)
  const details = at === -1 ? null : row.message.slice(at + 'Details: '.length).trim() || null
  return { feedbackId: row.id, reportedAt: row.createdAt, reason, claim: CLAIMS[reason], jobId: jobLine[1], details }
}
