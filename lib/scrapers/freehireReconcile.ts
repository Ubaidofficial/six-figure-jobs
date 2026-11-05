// Expire freehire jobs that freehire no longer lists as open.
//
// freehire's search returns only open postings (closed ones carry `closed_at` and drop out of the results), and the
// daily sync only looks at the newest ~36 hours, so a job that closes after we imported it used to stay live until it
// went 7 days without an update. This pass re-collects everything freehire still lists for the last WINDOW_DAYS and
// expires our active freehire jobs, posted within JUDGE_DAYS, that are missing from that set.
//
// It deliberately refuses to act when the picture could be incomplete: a market that failed or hit the paging cap
// (`complete` is false), or a result that would expire an implausible share of what it judged.

import { prisma } from '../prisma'
import { expireJobsByIds } from '../jobs/expiry'
import { makeBoardSource } from '../ingest/sourcePriority'
import { collectFreehireJobs, type FreehireCollected } from './freehire'

const DAY_MS = 24 * 60 * 60 * 1000
export const WINDOW_DAYS = 8
/** Only jobs posted this recently are judged; the extra day of window is a margin for posted_at jitter. */
export const JUDGE_DAYS = 7
export const MAX_EXPIRE_FRACTION = 0.4

export type ActiveJob = { id: string; title: string; externalId: string | null; postedAt: Date | null }

/** Active jobs inside the judged window whose external id is not in the open set. Pure, so it can be tested. */
export function selectClosedJobs(active: ActiveJob[], openIds: Set<string>, judgeFrom: Date): ActiveJob[] {
  return active.filter(
    (job) => job.externalId && job.postedAt && job.postedAt >= judgeFrom && !openIds.has(job.externalId),
  )
}

export function judgedCount(active: ActiveJob[], judgeFrom: Date): number {
  return active.filter((job) => job.externalId && job.postedAt && job.postedAt >= judgeFrom).length
}

export type ReconcileOptions = {
  dryRun?: boolean
  now?: Date
  maxExpireFraction?: number
  /** Injected in tests. */
  collect?: (since: Date) => Promise<FreehireCollected>
}

export type ReconcileResult = {
  status: 'ok' | 'skipped' | 'aborted'
  reason?: string
  judged: number
  openInWindow: number
  closed: ActiveJob[]
  expired: number
}

export async function reconcileClosedFreehireJobs(options: ReconcileOptions = {}): Promise<ReconcileResult> {
  const now = options.now ?? new Date()
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY_MS)
  const judgeFrom = new Date(now.getTime() - JUDGE_DAYS * DAY_MS)
  const base = { judged: 0, openInWindow: 0, closed: [] as ActiveJob[], expired: 0 }

  const collected = await (options.collect ?? ((s) => collectFreehireJobs({ since: s })))(since)

  if (collected.errors.length > 0) {
    return { ...base, status: 'skipped', reason: `a market failed: ${collected.errors.join('; ')}` }
  }
  const incomplete = collected.markets.filter((m) => !m.complete).map((m) => m.currency)
  if (incomplete.length > 0) {
    return {
      ...base,
      status: 'skipped',
      reason: `${incomplete.join(', ')} did not reach the end of the ${WINDOW_DAYS}-day window (paging cap or page limit)`,
    }
  }
  if (collected.inputs.length === 0) {
    return { ...base, status: 'skipped', reason: 'freehire returned no open jobs at all; refusing to treat that as "everything closed"' }
  }

  const openIds = new Set(collected.inputs.map((i) => i.externalId))
  const active: ActiveJob[] = await prisma.job.findMany({
    where: { source: makeBoardSource('freehire'), isExpired: false },
    select: { id: true, title: true, externalId: true, postedAt: true },
  })

  const judged = judgedCount(active, judgeFrom)
  const closed = selectClosedJobs(active, openIds, judgeFrom)
  const result = { ...base, judged, openInWindow: openIds.size, closed }

  const maxFraction = options.maxExpireFraction ?? MAX_EXPIRE_FRACTION
  if (judged > 0 && closed.length / judged > maxFraction) {
    return {
      ...result,
      status: 'aborted',
      reason: `would expire ${closed.length} of ${judged} judged jobs (${Math.round((closed.length / judged) * 100)}%), above the ${Math.round(maxFraction * 100)}% safety limit`,
    }
  }

  if (options.dryRun || closed.length === 0) return { ...result, status: 'ok' }
  const { expired } = await expireJobsByIds(closed.map((j) => j.id))
  return { ...result, status: 'ok', expired }
}
