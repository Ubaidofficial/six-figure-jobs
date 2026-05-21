const JOB_VALID_THROUGH_DAYS = 45

function coerceDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function addJobValidThroughWindow(datePosted: Date | string): Date {
  const date = new Date(datePosted)
  date.setDate(date.getDate() + JOB_VALID_THROUGH_DAYS)
  return date
}

export function buildJobValidThroughDate(
  datePosted: Date | string | null | undefined,
  now: Date = new Date(),
): Date {
  const posted = coerceDate(datePosted) ?? now
  const validThrough = addJobValidThroughWindow(posted)

  if (validThrough.getTime() > now.getTime()) {
    return validThrough
  }

  return addJobValidThroughWindow(now)
}

