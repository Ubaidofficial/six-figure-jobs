// Visitor job reports ("Report this job" on a job page) are stored as Feedback rows whose message names the job:
// "Job: <title> at <company> (<job id>)" (buildReportMessage in lib/jobs/jobReport.ts). This reads the id back, so the
// admin console can show the job next to the report and act on it, without a new column.
import { JOB_REPORT_REASONS } from '../jobs/jobReport'

/** The Feedback types a job report is saved under. */
export const JOB_REPORT_TYPES: string[] = Object.values(JOB_REPORT_REASONS).map((r) => r.type)

/** The reported job's id, from the message's "Job: … (id)" line; null for other feedback. The id is the last brackets. */
export function reportedJobId(type: string, message: string): string | null {
  if (!JOB_REPORT_TYPES.includes(type)) return null
  const m = /^Job: .*\(([^()\s]{1,80})\)\s*$/m.exec(message)
  return m ? m[1] : null
}

/** The text that marks a report as being about `jobId`, for a "contains" match in the database. */
export const reportMarker = (jobId: string) => `(${jobId})`
