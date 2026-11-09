// lib/indexing/queueSelection.ts
//
// Which queued URLs the Google Indexing API worker sends in one run.
//
// Google allows a limited number of notifications a day (the worker caps itself at INDEXING_API_DAILY_LIMIT, 180 by
// default). The queue used to be read oldest first whatever the type, so the removal notices (URL_DELETED) that pile up
// every day as jobs expire sat ahead of every new or updated job page, and on 2026-11-09 all 99 notifications sent were
// removals while 180 new job pages waited. Now new and updated pages (URL_UPDATED) go first, newest first, and removals
// get a reserved share of the day so they are still sent, oldest first. Quota the new pages do not need goes to removals.

export type QueueCandidate = { id: string; type: string; createdAt: Date }

/** Share of the daily limit set aside for removal notices (INDEXING_API_DELETE_SHARE overrides it). */
export const DEFAULT_DELETE_SHARE = 0.2

/** A share between 0 and 1 from an env value; anything missing or not a number gives the default. */
export function parseDeleteShare(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') return DEFAULT_DELETE_SHARE
  const n = Number(raw)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_DELETE_SHARE
}

const byId = (a: QueueCandidate, b: QueueCandidate) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * Ids to process this run, in the order to process them (new and updated pages first).
 * `batchLimit` is what the quota allows right now; `deleteBudget` is how many removals may still be sent today under the
 * reserved share. Removals beyond the budget are taken only to fill quota the other pages leave unused.
 */
export function selectIndexingBatch(
  candidates: QueueCandidate[],
  opts: { batchLimit: number; deleteBudget: number },
): string[] {
  const batchLimit = Math.max(0, Math.floor(opts.batchLimit))
  if (batchLimit === 0) return []
  const deleteBudget = Math.max(0, Math.floor(opts.deleteBudget))

  // Anything that is not a removal (URL_UPDATED, or a type the worker will skip) competes for the main share.
  const pages = candidates
    .filter((c) => c.type !== 'URL_DELETED')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || byId(a, b))
  const removals = candidates
    .filter((c) => c.type === 'URL_DELETED')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || byId(a, b))

  const reserved = removals.slice(0, Math.min(deleteBudget, batchLimit))
  const picked = pages.slice(0, batchLimit - reserved.length)
  const spare = batchLimit - reserved.length - picked.length
  const extra = removals.slice(reserved.length, reserved.length + spare)

  return [...picked, ...reserved, ...extra].map((c) => c.id)
}
