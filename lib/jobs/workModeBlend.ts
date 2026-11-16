// lib/jobs/workModeBlend.ts
//
// More remote and hybrid jobs near the top of the pay-ranked lists, without removing a single on-site job (owner's request,
// 2026-11-17: "list more remote and hybrid jobs and less focus on on-site, don't remove it").
//
// The list is still ranked by pay. It is read as two pay-ranked streams, remote-or-hybrid ("flex") and everything else, and
// merged by a fixed pattern: FLEX_PATTERN says which stream each position prefers; a stream that runs out hands its
// positions to the other, so every job still appears exactly once and the total does not change. The merge is a pure
// function of the two stream lengths and the position, so page 2 continues where page 1 stopped.
import type { Prisma } from '@prisma/client'

/** Which stream each position prefers: F = remote or hybrid, O = on-site or not stated. Three of five are flex. */
export const FLEX_PATTERN = ['F', 'F', 'O', 'F', 'O'] as const

/** Remote or hybrid: the job's flag says remote, or its work mode does. */
export const FLEX_WHERE: Prisma.JobWhereInput = { OR: [{ remote: true }, { remoteMode: { in: ['remote', 'hybrid'] } }] }

/**
 * Exactly the jobs FLEX_WHERE leaves out. Written out, not as NOT(FLEX_WHERE): in SQL NOT(NULL) is NULL, so a job with no
 * flag and no mode would belong to neither stream and vanish from the list.
 */
export const OTHER_WHERE: Prisma.JobWhereInput = {
  AND: [
    { OR: [{ remote: null }, { remote: { not: true } }] },
    { OR: [{ remoteMode: null }, { remoteMode: { notIn: ['remote', 'hybrid'] } }] },
  ],
}

export type Pick = 'flex' | 'other'

/**
 * The stream of each position from `from` for `count` positions, given how many jobs each stream holds in all. Pure and
 * deterministic, so any page can be computed without reading the pages before it.
 */
export function blendPicks(from: number, count: number, flexTotal: number, otherTotal: number, pattern: readonly string[] = FLEX_PATTERN): Pick[] {
  const picks: Pick[] = []
  let flexUsed = 0
  let otherUsed = 0
  const end = Math.min(from + count, flexTotal + otherTotal)
  for (let i = 0; i < end; i++) {
    let pick: Pick = pattern[i % pattern.length] === 'F' ? 'flex' : 'other'
    if (pick === 'flex' && flexUsed >= flexTotal) pick = 'other'
    else if (pick === 'other' && otherUsed >= otherTotal) pick = 'flex'
    if (pick === 'flex') flexUsed++
    else otherUsed++
    if (i >= from) picks.push(pick)
  }
  return picks
}

/** How many of the first `skip` positions come from each stream: where to start reading each stream for a page. */
export function blendOffsets(skip: number, flexTotal: number, otherTotal: number, pattern: readonly string[] = FLEX_PATTERN): { flex: number; other: number } {
  const before = blendPicks(0, skip, flexTotal, otherTotal, pattern)
  const flex = before.filter((p) => p === 'flex').length
  return { flex, other: before.length - flex }
}

/** Merges the page's rows from the two streams (each already read from its offset, in pay order) by the picks. */
export function blendMerge<T>(picks: readonly Pick[], flexRows: readonly T[], otherRows: readonly T[]): T[] {
  const out: T[] = []
  let f = 0
  let o = 0
  for (const pick of picks) {
    const row = pick === 'flex' ? flexRows[f++] : otherRows[o++]
    if (row !== undefined) out.push(row)
  }
  return out
}
