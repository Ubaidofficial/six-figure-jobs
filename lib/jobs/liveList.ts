// lib/jobs/liveList.ts
//
// The rules behind the live, scroll-to-load job list on /jobs and the role pages (components in
// app/jobs/_components/InfiniteJobsList.tsx), kept pure so they can be tested without a browser.

/** Jobs shown at first, and added each time the reader scrolls to the end of what is shown. */
export const REVEAL_STEP = 5

/** How many rows to show after one more reveal: `step` more, never more than there are. */
export function revealMore(visible: number, total: number, step: number = REVEAL_STEP): number {
  return Math.min(Math.max(total, 0), Math.max(visible, 0) + step)
}

type Timed = { createdAt?: string | Date | null; postedAt?: string | Date | null }

/** The time a job is ranked by on the "recent" order: the employer's posting date, else when we added it. */
export function rankTime(job: Timed): number {
  const t = Date.parse(String(job.postedAt ?? job.createdAt ?? ''))
  return Number.isFinite(t) ? t : 0
}

/** Most new jobs put into a list at once; a bigger burst waits for the next visit. */
export const MAX_ARRIVALS = 10

/**
 * Jobs in a fresh first page that the list does not have yet, in the order the page returned them (newest first). A job
 * counts only if it ranks at or above the list's first job (`topRank`, from rankTime): that is where a reload would put it,
 * and it keeps jobs that merely fell off the list's end from reading as new (the live answer can be a few minutes old).
 */
export function newArrivals<T extends Timed & { id: string }>(fetched: ReadonlyArray<T>, known: ReadonlySet<string>, topRank = 0): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const job of fetched) {
    if (!job?.id || known.has(job.id) || seen.has(job.id) || rankTime(job) < topRank) continue
    seen.add(job.id)
    out.push(job)
    if (out.length >= MAX_ARRIVALS) break
  }
  return out
}

/** ISO time we added the most recently added job in the list, or null. Used for "Latest job added 40 sec ago". */
export function newestAddedIso(jobs: ReadonlyArray<Timed>): string | null {
  let best = 0
  for (const job of jobs) {
    const t = Date.parse(String(job.createdAt ?? job.postedAt ?? ''))
    if (Number.isFinite(t) && t > best) best = t
  }
  return best ? new Date(best).toISOString() : null
}

/**
 * Whether new jobs should be put into the list straight away: only when nobody is using it (pointer or keyboard focus in
 * the list) and the reader is at the top of it, so a row never moves under a thumb or while someone reads further down.
 */
export function shouldInsertNow(opts: { holding: boolean; paused: boolean; scrolledPastTop: boolean }): boolean {
  return !opts.holding && !opts.paused && !opts.scrolledPastTop
}
