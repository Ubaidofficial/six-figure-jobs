// The admin review queue: live jobs that likely show something wrong. Two kinds, each a rule the site already has or
// a pattern seen live:
//  - pay over $600k a year: the import sets `needsReview` when a validated range is between $600k and $2M a year in
//    USD (lib/ingest/index.ts processSalary); nothing else reads the flag, so these jobs are live and unchecked;
//  - odd titles: a title with "---" separators or pay written into it (live example, 2026-11-24:
//    "Attorney---Commercial Real Estate---Charlotte---$120…"), or longer than 110 characters.
// Reported jobs are handled in Feedback (lib/admin/jobReports.ts).
import { memoAsync } from '../cache/memo'
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

// The same rules in SQL, so the database finds the rows (titleProblems says why for each one shown).
const ODD_TITLE_SQL = `"isExpired" = false AND ("title" LIKE '%---%' OR "title" ~ '\\$\\s?[0-9]' OR "title" ~ '\\y[0-9]{2,3}\\s?[kK]\\s?[-–]\\s?\\$?[0-9]{2,3}\\s?[kK]\\y' OR length("title") > ${MAX_TITLE_LENGTH})`

export type ReviewKind = 'pay' | 'titles'

async function countNow(): Promise<Record<ReviewKind, number>> {
  const [pay, titles] = await Promise.all([
    prisma.job.count({ where: { isExpired: false, needsReview: true } }),
    prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM "Job" WHERE ${ODD_TITLE_SQL}`),
  ])
  return { pay, titles: Number(titles[0]?.n ?? 0) }
}

/** `cached`: kept a minute, for the badge on every admin page (the title rule scans the live jobs). */
export async function countReviewQueue({ cached = false }: { cached?: boolean } = {}): Promise<Record<ReviewKind, number>> {
  return cached ? memoAsync('admin:review-counts', 60_000, countNow) : countNow()
}

export async function loadReviewIds(kind: ReviewKind, limit: number): Promise<string[]> {
  if (kind === 'pay') {
    const rows = await prisma.job.findMany({
      where: { isExpired: false, needsReview: true },
      orderBy: { maxAnnual: 'desc' },
      take: limit,
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "Job" WHERE ${ODD_TITLE_SQL} ORDER BY "createdAt" DESC LIMIT ${Math.max(1, Math.min(500, Math.floor(limit)))}`,
  )
  return rows.map((r) => r.id)
}
