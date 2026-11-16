// lib/history/clickRollup.ts
//
// Apply clicks per week by company, role, country and source (and overall), into ApplyClickWeekly. Clicks are the one signal in
// the database of what visitors actually act on, so they say which companies and roles to enrich first and how demand moves.
// The raw rows stay in ApplyClick; this keeps the weekly counts if they are ever pruned and spares reports a scan of that table.
//
// Privacy: ApplyClick stores no IP address, user agent or visitor id (see lib/analytics/applyClick.ts), and this adds only counts.
// A week is Monday to Sunday in UTC, and only COMPLETED weeks are rolled up; a rerun replaces a week's rows, so it is safe to
// repeat and to widen `weeks` to fill in older weeks from the raw table.
import type { PrismaClient } from '@prisma/client'

export const CLICK_DIMENSIONS = ['all', 'company', 'role', 'country', 'source'] as const
export type ClickDimension = (typeof CLICK_DIMENSIONS)[number]

const KEY: Record<ClickDimension, string> = {
  all: `''`,
  company: `COALESCE(j."company", '(unknown)')`,
  role: `COALESCE(j."roleSlug", '(unknown)')`,
  country: `COALESCE(j."countryCode", '(unknown)')`,
  source: `COALESCE(j."source", '(unknown)')`,
}

/** Monday (UTC) of the week that ended `weeksAgo` weeks before the current, unfinished week: 1 is last week. */
const weekStart = (weeksAgo: number) => `((date_trunc('week', now() AT TIME ZONE 'UTC'))::date - ${Math.max(1, Math.floor(weeksAgo)) * 7})`

/** One week's rolled-up rows for one dimension. */
export function rollupSelect(dim: ClickDimension, weeksAgo: number): string {
  const week = weekStart(weeksAgo)
  return `SELECT ${week} AS "weekStart", '${dim}' AS "dimension", ${KEY[dim]} AS "key",
      count(*)::int AS "clicks", count(DISTINCT c."jobId")::int AS "jobs", count(*) FILTER (WHERE c."device" = 'mobile')::int AS "mobile"
    FROM "ApplyClick" c LEFT JOIN "Job" j ON j."id" = c."jobId"
    WHERE c."createdAt" >= ${week} AND c."createdAt" < ${week} + 7
    GROUP BY ${dim === 'all' ? '1' : KEY[dim]}`
}

const INSERT = (select: string) => `INSERT INTO "ApplyClickWeekly" ("id", "weekStart", "dimension", "key", "clicks", "jobs", "mobile")
  SELECT md5(random()::text || clock_timestamp()::text || r."key"), r."weekStart", r."dimension", r."key", r."clicks", r."jobs", r."mobile" FROM (${select}) r
  ON CONFLICT ("weekStart", "dimension", "key") DO UPDATE SET "clicks" = EXCLUDED."clicks", "jobs" = EXCLUDED."jobs", "mobile" = EXCLUDED."mobile"`

export type RollupResult = Array<{ weeksAgo: number; weekStart: string; clicks: number; rows: number }>

/** Roll up the last `weeks` completed weeks. Without apply, only counts what would be written. */
export async function rollupApplyClicks(
  db: Pick<PrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe'>,
  opts: { apply: boolean; weeks?: number },
): Promise<RollupResult> {
  const weeks = Math.min(Math.max(opts.weeks ?? 4, 1), 104)
  const out: RollupResult = []
  for (let weeksAgo = 1; weeksAgo <= weeks; weeksAgo++) {
    let rows = 0
    for (const dim of CLICK_DIMENSIONS) {
      if (opts.apply) rows += await db.$executeRawUnsafe(INSERT(rollupSelect(dim, weeksAgo)))
      else rows += Number((await db.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM (${rollupSelect(dim, weeksAgo)}) r`))[0].n)
    }
    const [total] = await db.$queryRawUnsafe<Array<{ week: string; clicks: bigint }>>(
      `SELECT ${weekStart(weeksAgo)}::text AS "week", (SELECT count(*) FROM "ApplyClick" c WHERE c."createdAt" >= ${weekStart(weeksAgo)} AND c."createdAt" < ${weekStart(weeksAgo)} + 7) AS "clicks"`,
    )
    out.push({ weeksAgo, weekStart: total.week, clicks: Number(total.clicks), rows })
  }
  return out
}
