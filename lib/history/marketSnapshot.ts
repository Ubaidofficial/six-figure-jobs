// lib/history/marketSnapshot.ts
//
// A weekly record of pay by cell (role, country, role x country, level, arrangement, and overall), one row per
// (date, dimension, key, currency) in MarketSnapshot. A later report can then compare a cell with the same cell weeks or a
// year earlier, which is how Indeed's Wage Tracker avoids mix effects (growth is measured within a job-title x region cell
// and the cells' growth rates are summarised). Pay rules are lib/research/method.ts's, so these figures and the published
// pay report cannot disagree; METHOD_VERSION is stored with each row.
//
// Population: live (not expired) jobs of any age at the time of the run, validated pay, aggregators left out. That is not the
// "last 30 days" population of the research report, and it describes advertised ranges of six-figure listings only: the gate
// keeps nothing below the floor, so no cell here says anything about pay in general. Pay is never converted between currencies.
import type { PrismaClient } from '@prisma/client'

import { AGGREGATOR_PATTERNS, METHOD_VERSION, MIN_CONFIDENCE, USD_CAP } from '../research/method'

export const SNAPSHOT_MIN_JOBS = 3
export const SNAPSHOT_DIMENSIONS = ['all', 'role', 'country', 'role_country', 'level', 'arrangement'] as const
export type SnapshotDimension = (typeof SNAPSHOT_DIMENSIONS)[number]

const ANNUAL = `(CASE WHEN "minAnnual" IS NOT NULL AND "maxAnnual" IS NOT NULL THEN ("minAnnual" + "maxAnnual") / 2 ELSE COALESCE("maxAnnual", "minAnnual") END)`
// The research method reads USD only, with a clamp at USD_CAP. Other currencies are kept here (cells are per currency) and the
// clamp, which is a USD ingest rule, is applied to USD only.
const PAY_OK = `"salaryValidated" AND "salaryConfidence" >= ${MIN_CONFIDENCE} AND "currency" IS NOT NULL AND COALESCE("maxAnnual", "minAnnual") IS NOT NULL AND ("currency" <> 'USD' OR COALESCE("maxAnnual", "minAnnual") < ${USD_CAP})`
const NOT_AGGREGATOR = `"company" NOT ILIKE ALL (ARRAY[${AGGREGATOR_PATTERNS.map((x) => `'${x}'`).join(',')}])`

const KEY: Record<SnapshotDimension, string> = {
  all: `''`,
  role: `"roleSlug"`,
  country: `"countryCode"`,
  role_country: `("roleSlug" || '|' || "countryCode")`,
  // experienceLevel defaults to 'mid' for every job whose level is unknown, so 'mid' cannot be told from "not stated".
  level: `NULLIF("experienceLevel", 'mid')`,
  arrangement: `COALESCE("remoteMode", CASE WHEN "remote" THEN 'remote' END, "workArrangement")`,
}

/** The cells of one dimension: one row per (key, currency) with at least SNAPSHOT_MIN_JOBS jobs. */
export function cellsSelect(dim: SnapshotDimension): string {
  const key = KEY[dim]
  return `SELECT '${dim}' AS "dimension", ${key} AS "key", "currency",
      count(*)::int AS "jobs", count(DISTINCT "company")::int AS "companies",
      round(percentile_cont(0.25) WITHIN GROUP (ORDER BY ${ANNUAL}::float8))::int AS "p25",
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${ANNUAL}::float8))::int AS "median",
      round(percentile_cont(0.75) WITHIN GROUP (ORDER BY ${ANNUAL}::float8))::int AS "p75",
      count(*) FILTER (WHERE "createdAt" > now() - interval '7 days')::int AS "newJobs7d"
    FROM "Job"
    WHERE NOT "isExpired" AND ${PAY_OK} AND ${NOT_AGGREGATOR} AND ${key} IS NOT NULL AND ${dim === 'all' ? 'true' : `btrim(${key}::text) <> ''`}
    GROUP BY ${dim === 'all' ? '' : `${key}, `}"currency"
    HAVING count(*) >= ${SNAPSHOT_MIN_JOBS}`
}

const INSERT = (select: string) => `INSERT INTO "MarketSnapshot"
    ("id", "snapshotDate", "dimension", "key", "currency", "jobs", "companies", "p25", "median", "p75", "newJobs7d", "methodVersion")
  SELECT md5(random()::text || clock_timestamp()::text || c."key"), CURRENT_DATE, c."dimension", c."key", c."currency", c."jobs", c."companies", c."p25", c."median", c."p75", c."newJobs7d", '${METHOD_VERSION}'
  FROM (${select}) c
  ON CONFLICT ("snapshotDate", "dimension", "key", "currency") DO UPDATE SET
    "jobs" = EXCLUDED."jobs", "companies" = EXCLUDED."companies", "p25" = EXCLUDED."p25", "median" = EXCLUDED."median",
    "p75" = EXCLUDED."p75", "newJobs7d" = EXCLUDED."newJobs7d", "methodVersion" = EXCLUDED."methodVersion"`

export type SnapshotResult = {
  /** Cells per dimension (rows written with apply, rows that would be written without). */
  cells: Record<SnapshotDimension, number>
  /** The overall cell per currency, for a one-glance check. */
  overall: Array<{ currency: string; jobs: number; median: number }>
}

/** Today's snapshot. Running it twice on the same date replaces that date's rows, so a re-run never duplicates. */
export async function snapshotMarket(
  db: Pick<PrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe'>,
  opts: { apply: boolean },
): Promise<SnapshotResult> {
  const cells = {} as Record<SnapshotDimension, number>
  for (const dim of SNAPSHOT_DIMENSIONS) {
    if (opts.apply) cells[dim] = await db.$executeRawUnsafe(INSERT(cellsSelect(dim)))
    else cells[dim] = Number((await db.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM (${cellsSelect(dim)}) c`))[0].n)
  }
  const overall = await db.$queryRawUnsafe<Array<{ currency: string; jobs: number; median: number }>>(
    `SELECT "currency", "jobs", "median" FROM (${cellsSelect('all')}) c ORDER BY "jobs" DESC`,
  )
  return { cells, overall }
}
