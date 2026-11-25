// The admin review queue: live jobs that likely show something wrong. Two kinds, each a rule the site already has or
// a pattern seen live:
//  - pay over $600k a year: the import sets `needsReview` when a validated range is between $600k and $2M a year in
//    USD (lib/ingest/index.ts processSalary); nothing else reads the flag, so these jobs are live and unchecked;
//  - odd titles: a title with "---" separators or pay written into it (live example, 2026-11-24:
//    "Attorney---Commercial Real Estate---Charlotte---$120…"), or longer than 110 characters.
// Only jobs whose page is up: not expired AND posted within the display window (lib/jobs/detailAvailability.ts). A job
// posted longer ago answers 410 Gone and is in no listing, so there is nothing to fix on it (2026-11-25: the pay tab
// listed jobs posted 2024-08-01 and 2026-02-12, whose pages were already gone).
// Reported jobs are handled in Feedback (lib/admin/jobReports.ts).
import type { Prisma } from '@prisma/client'

import { memoAsync } from '../cache/memo'
import { MAX_DISPLAY_AGE_DAYS, getDateThreshold } from '../ingest/jobAgeFilter'
import { buildFreshJobWhere } from '../jobs/freshness'
import { prisma } from '../prisma'

export const MAX_TITLE_LENGTH = 110
// A dollar amount, or a range of thousands ("150K-200K"). A lone "401k" or "12k users" is not pay.
const PAY_IN_TITLE = /\$\s?\d|\b\d{2,3}\s?[kK]\s?[-–]\s?\$?\d{2,3}\s?[kK]\b/

/** Why a title looks wrong, in plain words; empty when it looks fine. */
export function titleProblems(title: string): string[] {
  const out: string[] = []
  if (title.includes('---')) out.push('“---” separators')
  if (PAY_IN_TITLE.test(title)) out.push('pay in the title')
  if (title.length > MAX_TITLE_LENGTH) out.push(`${title.length} characters long`)
  return out
}

function payWhere(now: Date): Prisma.JobWhereInput {
  return { isExpired: false, needsReview: true, ...buildFreshJobWhere(MAX_DISPLAY_AGE_DAYS, now) }
}

// The same rules in SQL, so the database finds the rows (titleProblems says why for each one shown). $1 is the
// freshness cutoff, the same as buildFreshJobWhere's.
const ODD_TITLE_SQL = `"isExpired" = false AND ("postedAt" >= $1 OR ("postedAt" IS NULL AND "createdAt" >= $1)) AND ("title" LIKE '%---%' OR "title" ~ '\\$\\s?[0-9]' OR "title" ~ '\\y[0-9]{2,3}\\s?[kK]\\s?[-–]\\s?\\$?[0-9]{2,3}\\s?[kK]\\y' OR length("title") > ${MAX_TITLE_LENGTH})`

export type ReviewKind = 'pay' | 'titles'

async function countNow(): Promise<Record<ReviewKind, number>> {
  const now = new Date()
  const [pay, titles] = await Promise.all([
    prisma.job.count({ where: payWhere(now) }),
    prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM "Job" WHERE ${ODD_TITLE_SQL}`,
      getDateThreshold(MAX_DISPLAY_AGE_DAYS, now),
    ),
  ])
  return { pay, titles: Number(titles[0]?.n ?? 0) }
}

/** `cached`: kept a minute, for the badge on every admin page (the title rule scans the live jobs). */
export async function countReviewQueue({ cached = false }: { cached?: boolean } = {}): Promise<Record<ReviewKind, number>> {
  return cached ? memoAsync('admin:review-counts', 60_000, countNow) : countNow()
}

export async function loadReviewIds(kind: ReviewKind, limit: number, now: Date = new Date()): Promise<string[]> {
  if (kind === 'pay') {
    const rows = await prisma.job.findMany({
      where: payWhere(now),
      orderBy: { maxAnnual: 'desc' },
      take: limit,
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "Job" WHERE ${ODD_TITLE_SQL} ORDER BY "createdAt" DESC LIMIT ${Math.max(1, Math.min(500, Math.floor(limit)))}`,
    getDateThreshold(MAX_DISPLAY_AGE_DAYS, now),
  )
  return rows.map((r) => r.id)
}
