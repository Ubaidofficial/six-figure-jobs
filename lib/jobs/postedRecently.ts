// lib/jobs/postedRecently.ts
//
// "New this week" must mean posted this week. The daily sync touches lastSeenAt and updatedAt on every live job, so
// those say nothing about when a job appeared. The posting date is postedAt (the employer's date) and, when the
// source gave none, createdAt (the day we first saw the job).

export const NEW_THIS_WEEK_DAYS = 7

/** A job carries the "New" tag on rows and cards for this long after its posting date (postedAt, else createdAt). */
export const NEW_TAG_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

/** Prisma filter: the job was posted (or, with no posting date, first seen) at or after `since`. */
export function postedSinceClause(since: Date) {
  return {
    OR: [
      { postedAt: { gte: since } },
      { postedAt: null, createdAt: { gte: since } },
    ],
  }
}

/** The filter for the last seven days, counted back from `now`. */
export function newThisWeekClause(now: Date = new Date()) {
  const since = new Date(now)
  since.setDate(since.getDate() - NEW_THIS_WEEK_DAYS)
  return postedSinceClause(since)
}
