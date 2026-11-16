// lib/history/lifecycle.ts
//
// Records what happens to each job over time in JobLifecycle: first stored, last seen live, seen expired, reopened, and each
// change of its pay. Run daily by scripts/observeJobLifecycle.ts. Set-based SQL, not a loop per job: ~30,000 live jobs would
// take far too long one round trip at a time. Outside the ingest path: nothing here changes how a job is stored.
//
// What it can and cannot say. History starts at the first run (jobs already expired by then are not tracked, because when
// they expired is unknown). "Expired observed" is the first run that saw the job expired, so a day's resolution at best.
// "Days listed" is first stored to expiry observed. It is NOT time to fill: a listing coming down does not say whether
// anyone was hired.
import type { PrismaClient } from '@prisma/client'

export type LifecycleDb = Pick<PrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe' | '$transaction'>

export type LifecycleCounts = {
  /** Live jobs not yet tracked: a row is added. */
  toTrack: number
  /** Tracked jobs that are live now: last-seen is refreshed. */
  stillLive: number
  /** Live jobs whose pay differs from the last observed pay. */
  payChanged: number
  /** Live jobs that were last seen expired: a reopen is counted. */
  reopened: number
  /** Tracked jobs seen expired for the first time. */
  newlyExpired: number
  /** Tracked jobs whose Job row no longer exists (kept as they are). */
  goneFromJobTable: number
  trackedTotal: number
}

const PAY_DIFFERS = `(l."lastMinAnnual" IS DISTINCT FROM j."minAnnual" OR l."lastMaxAnnual" IS DISTINCT FROM j."maxAnnual" OR l."currency" IS DISTINCT FROM j."currency")`

/** The new history after a change: the old entries plus this one, newest 20 kept, in order. */
const NEW_HISTORY = `(SELECT jsonb_agg(q.e ORDER BY q.n) FROM (
    SELECT t.e, t.n FROM jsonb_array_elements(
      COALESCE(l."payHistory", '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', now(), 'min', j."minAnnual", 'max', j."maxAnnual", 'currency', j."currency"))
    ) WITH ORDINALITY AS t(e, n) ORDER BY t.n DESC LIMIT 20
  ) q)`

const INSERT_NEW = `INSERT INTO "JobLifecycle"
    ("jobId", "source", "company", "companyId", "roleSlug", "countryCode", "currency", "firstSeenAt", "postedAt", "lastObservedLiveAt", "lastMinAnnual", "lastMaxAnnual", "updatedAt")
  SELECT j."id", j."source", j."company", j."companyId", j."roleSlug", j."countryCode", j."currency", j."createdAt", j."postedAt", now(), j."minAnnual", j."maxAnnual", now()
  FROM "Job" j
  WHERE NOT j."isExpired" AND NOT EXISTS (SELECT 1 FROM "JobLifecycle" l WHERE l."jobId" = j."id")
  ON CONFLICT ("jobId") DO NOTHING`

// One statement: every right-hand side reads the row as it was before the update, so the pay comparison and the reopen test
// see the old values.
const REFRESH_LIVE = `UPDATE "JobLifecycle" l SET
    "lastObservedLiveAt" = now(),
    "reopenCount" = l."reopenCount" + CASE WHEN l."expiredObservedAt" IS NOT NULL THEN 1 ELSE 0 END,
    "expiredObservedAt" = NULL,
    "payChangeCount" = l."payChangeCount" + CASE WHEN ${PAY_DIFFERS} THEN 1 ELSE 0 END,
    "payHistory" = CASE WHEN ${PAY_DIFFERS} THEN ${NEW_HISTORY} ELSE l."payHistory" END,
    "lastMinAnnual" = j."minAnnual",
    "lastMaxAnnual" = j."maxAnnual",
    "currency" = j."currency",
    "roleSlug" = j."roleSlug",
    "countryCode" = j."countryCode",
    "postedAt" = j."postedAt",
    "updatedAt" = now()
  FROM "Job" j
  WHERE j."id" = l."jobId" AND NOT j."isExpired"`

const MARK_EXPIRED = `UPDATE "JobLifecycle" l SET "expiredObservedAt" = now(), "updatedAt" = now()
  FROM "Job" j
  WHERE j."id" = l."jobId" AND j."isExpired" AND l."expiredObservedAt" IS NULL`

const n = (v: unknown) => Number(v ?? 0)

async function countAll(db: Pick<PrismaClient, '$queryRawUnsafe'>): Promise<LifecycleCounts> {
  const [row] = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT
    (SELECT count(*) FROM "Job" j WHERE NOT j."isExpired" AND NOT EXISTS (SELECT 1 FROM "JobLifecycle" l WHERE l."jobId" = j."id")) AS "toTrack",
    (SELECT count(*) FROM "JobLifecycle" l JOIN "Job" j ON j."id" = l."jobId" WHERE NOT j."isExpired") AS "stillLive",
    (SELECT count(*) FROM "JobLifecycle" l JOIN "Job" j ON j."id" = l."jobId" WHERE NOT j."isExpired" AND ${PAY_DIFFERS}) AS "payChanged",
    (SELECT count(*) FROM "JobLifecycle" l JOIN "Job" j ON j."id" = l."jobId" WHERE NOT j."isExpired" AND l."expiredObservedAt" IS NOT NULL) AS "reopened",
    (SELECT count(*) FROM "JobLifecycle" l JOIN "Job" j ON j."id" = l."jobId" WHERE j."isExpired" AND l."expiredObservedAt" IS NULL) AS "newlyExpired",
    (SELECT count(*) FROM "JobLifecycle" l WHERE NOT EXISTS (SELECT 1 FROM "Job" j WHERE j."id" = l."jobId")) AS "goneFromJobTable",
    (SELECT count(*) FROM "JobLifecycle") AS "trackedTotal"`)
  return {
    toTrack: n(row.toTrack),
    stillLive: n(row.stillLive),
    payChanged: n(row.payChanged),
    reopened: n(row.reopened),
    newlyExpired: n(row.newlyExpired),
    goneFromJobTable: n(row.goneFromJobTable),
    trackedTotal: n(row.trackedTotal),
  }
}

/** What a run would do (counts taken before any write). With apply, does it, in one transaction. */
export async function observeJobLifecycle(db: LifecycleDb, opts: { apply: boolean }): Promise<LifecycleCounts> {
  const counts = await countAll(db)
  if (!opts.apply) return counts
  await db.$transaction(async (tx) => {
    // Order matters: track new jobs first, so they are refreshed (and their pay compared) like the rest from the next run on.
    await tx.$executeRawUnsafe(INSERT_NEW)
    await tx.$executeRawUnsafe(REFRESH_LIVE)
    await tx.$executeRawUnsafe(MARK_EXPIRED)
  })
  return counts
}
