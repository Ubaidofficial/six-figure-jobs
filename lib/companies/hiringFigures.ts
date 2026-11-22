// lib/companies/hiringFigures.ts
//
// The two figures at the top of a company page that lib/jobs/companyHiringStats.ts (new this week, median pay) does not give:
// how many of the open jobs are remote, and how long ago the newest was posted. Pure functions over the jobs the page already
// loaded, so they add no query.
//
// "Newest posting" reads the employer's posting date only. A job with no posting date has only the day we stored it, and for a
// company whose board we just began reading that day is today for every job (see companyHiringStats.ts), so it would always say
// "Today".

export type HiringFigureJob = {
  remote?: boolean | null
  remoteMode?: string | null
  postedAt?: Date | null
}

const DAY_MS = 86_400_000

export function companyRemoteAndNewest(
  jobs: readonly HiringFigureJob[],
  now: Date = new Date(),
): { remote: number; newestDaysAgo: number | null } {
  let remote = 0
  let newest: number | null = null
  for (const job of jobs) {
    if (job.remote === true || job.remoteMode === 'remote') remote += 1
    const t = job.postedAt?.getTime()
    if (t != null && Number.isFinite(t) && (newest == null || t > newest)) newest = t
  }
  return { remote, newestDaysAgo: newest == null ? null : Math.max(0, Math.floor((now.getTime() - newest) / DAY_MS)) }
}

/** "Today", "Yesterday", "3 days ago". */
export function daysAgoLabel(days: number): string {
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}
