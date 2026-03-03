// lib/ingest/jobAgeFilter.ts
// Filter out jobs older than a threshold

export const MAX_INGEST_AGE_DAYS = 30  // Don't ingest jobs older than 30 days
export const MAX_DISPLAY_AGE_DAYS = 45 // Only show jobs up to 45 days old

export function isJobTooOld(postedAt: Date | string | null | undefined, maxDays: number = MAX_INGEST_AGE_DAYS): boolean {
  if (!postedAt) return false
  
  const posted = new Date(postedAt)
  if (isNaN(posted.getTime())) return false
  
  const now = new Date()
  const ageMs = now.getTime() - posted.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  
  return ageDays > maxDays
}

export function getDateThreshold(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}
