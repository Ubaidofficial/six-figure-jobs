// lib/ingest/jobAgeFilter.ts
// Filter out jobs older than a threshold

export const MAX_INGEST_AGE_DAYS = 30  // Don't ingest jobs older than 30 days
// A job is shown only while it was POSTED within this many days (postedAt, else the day we first stored it), however
// recently we last saw it still open. JOB_MAX_AGE_DAYS (7-90) changes it without a code change; restart to apply.
const configuredAge = Number(process.env.JOB_MAX_AGE_DAYS)
export const MAX_DISPLAY_AGE_DAYS = Number.isInteger(configuredAge) && configuredAge >= 7 && configuredAge <= 90 ? configuredAge : 14

export function isJobTooOld(postedAt: Date | string | null | undefined, maxDays: number = MAX_INGEST_AGE_DAYS): boolean {
  if (!postedAt) return false
  
  const posted = new Date(postedAt)
  if (isNaN(posted.getTime())) return false
  
  const now = new Date()
  const ageMs = now.getTime() - posted.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  
  return ageDays > maxDays
}

export function getDateThreshold(days: number, baseDate: Date = new Date()): Date {
  const date = new Date(baseDate)
  date.setDate(date.getDate() - days)
  return date
}
