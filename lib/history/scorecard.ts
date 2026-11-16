// lib/history/scorecard.ts
//
// A data-quality scorecard: how much of each field we hold, counted the same way every week and stored (DataScorecard), so
// "are we improving" has an answer: this week against last week. Read-only SELECTs for the counts; the comparison and the
// text are pure functions, tested without a database.
//
// Counts, not judgements. A field's fill rate says how often it is present, not how often it is right: precision needs
// labelled examples (see scripts/exportCorrectionLabels.ts). Defaults are not fills: experienceLevel is "mid" and
// visaSponsorship false when unknown, so neither is counted as a fill; visa flags are reported as a count of flagged jobs.
import type { PrismaClient } from '@prisma/client'

import { MAX_DISPLAY_AGE_DAYS } from '../ingest/jobAgeFilter'
import { JOB_REPORT_REASONS } from '../jobs/jobReport'

export const SCORECARD_VERSION = 1

export type ScorecardMetrics = {
  version: number
  jobs: Record<string, number>
  companies: Record<string, number>
  evidence: Record<string, number>
  reports: Record<string, number>
  clicks: Record<string, number>
  history: Record<string, number>
  /** Latest dates of the append-only tables, as YYYY-MM-DD (not compared). */
  latest: Record<string, string | null>
}

type Db = Pick<PrismaClient, '$queryRawUnsafe'>
const n = (v: unknown) => Number(v ?? 0)
const present = (col: string) => `(${col} IS NOT NULL AND btrim(${col}::text) NOT IN ('', '[]'))`

async function one(db: Db, query: string): Promise<Record<string, number>> {
  const [row] = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(query)
  return Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, n(v)]))
}

export async function collectScorecard(db: Db): Promise<ScorecardMetrics> {
  const jobs = await one(db, `SELECT
      count(*) AS "live",
      count(*) FILTER (WHERE "salaryValidated") AS "salaryValidated",
      count(*) FILTER (WHERE "postedAt" IS NOT NULL) AS "withPostedAt",
      count(*) FILTER (WHERE "remote" OR "remoteMode" = 'remote') AS "remote",
      count(*) FILTER (WHERE ("remote" OR "remoteMode" = 'remote') AND ${present('"countryCode"')}) AS "remoteWithCountry",
      count(*) FILTER (WHERE ${present('"benefitsJson"')}) AS "withBenefits",
      count(*) FILTER (WHERE ${present('"techStack"')}) AS "withTechStack",
      count(*) FILTER (WHERE ${present('"aiOneLiner"')}) AS "withAiOneLiner",
      count(*) FILTER (WHERE "expiresAt" IS NOT NULL) AS "withExpiresAt",
      count(*) FILTER (WHERE "visaSponsorship") AS "visaFlagged",
      count(*) FILTER (WHERE COALESCE("postedAt", "createdAt") < now() - interval '${MAX_DISPLAY_AGE_DAYS} days') AS "hiddenByAge",
      count(*) FILTER (WHERE "lastSeenAt" > now() - interval '7 days' AND "postedAt" < now() - interval '21 days') AS "keptAliveOld"
    FROM "Job" WHERE NOT "isExpired"`)

  const companies = await one(db, `SELECT
      count(*) AS "total",
      count(*) FILTER (WHERE ${present('"website"')}) AS "website",
      count(*) FILTER (WHERE ${present('"logoUrl"')}) AS "logo",
      count(*) FILTER (WHERE ${present('"description"')}) AS "description",
      count(*) FILTER (WHERE ${present('"industry"')}) AS "industry",
      count(*) FILTER (WHERE "employeeCount" IS NOT NULL) AS "employeeCount",
      count(*) FILTER (WHERE ${present('"fundingStage"')}) AS "fundingStage",
      count(*) FILTER (WHERE ${present('"headquarters"')}) AS "headquarters",
      count(*) FILTER (WHERE "foundedYear" IS NOT NULL) AS "foundedYear",
      count(*) FILTER (WHERE ${present('"sizeBucket"')}) AS "sizeBucket",
      count(*) FILTER (WHERE ${present('"countryCode"')}) AS "country",
      count(*) FILTER (WHERE ${present('"linkedinUrl"')}) AS "linkedin"
    FROM "Company"`)

  const evidenceRows = await db.$queryRawUnsafe<Array<{ field: string; rows: unknown }>>(
    `SELECT "field", count(*) AS "rows" FROM "JobEvidence" GROUP BY "field"`,
  )
  const evidence: Record<string, number> = { rows: evidenceRows.reduce((s, r) => s + n(r.rows), 0) }
  for (const r of evidenceRows) evidence[r.field] = n(r.rows)

  const reportTypes = Object.values(JOB_REPORT_REASONS).map((r) => `'${r.type}'`).join(',')
  const reportRows = await db.$queryRawUnsafe<Array<{ type: string; last7d: unknown; last30d: unknown }>>(
    `SELECT "type", count(*) FILTER (WHERE "createdAt" > now() - interval '7 days') AS "last7d", count(*) FILTER (WHERE "createdAt" > now() - interval '30 days') AS "last30d"
     FROM "Feedback" WHERE "type" IN (${reportTypes}) GROUP BY "type"`,
  )
  const reports: Record<string, number> = { last7d: 0, last30d: 0 }
  for (const r of reportRows) {
    reports[`${r.type}.last7d`] = n(r.last7d)
    reports[`${r.type}.last30d`] = n(r.last30d)
    reports.last7d += n(r.last7d)
    reports.last30d += n(r.last30d)
  }

  const clicks = await one(db, `SELECT
      count(*) FILTER (WHERE "createdAt" > now() - interval '7 days') AS "last7d",
      count(*) AS "last30d",
      count(DISTINCT "jobId") AS "distinctJobs30d"
    FROM "ApplyClick" WHERE "createdAt" > now() - interval '30 days'`)

  const history = await one(db, `SELECT
      (SELECT count(*) FROM "JobLifecycle") AS "lifecycleTracked",
      (SELECT count(*) FROM "JobLifecycle" WHERE "expiredObservedAt" IS NOT NULL) AS "lifecycleExpiredObserved",
      (SELECT count(*) FROM "JobLifecycle" WHERE "reopenCount" > 0) AS "lifecycleReopened",
      (SELECT count(*) FROM "JobLifecycle" WHERE "payChangeCount" > 0) AS "lifecyclePayChanged",
      (SELECT count(*) FROM "MarketSnapshot") AS "marketSnapshotRows"`)

  const [latest] = await db.$queryRawUnsafe<Array<{ snapshot: string | null; clicks: string | null }>>(
    `SELECT (SELECT max("snapshotDate")::text FROM "MarketSnapshot") AS "snapshot", (SELECT max("weekStart")::text FROM "ApplyClickWeekly") AS "clicks"`,
  )

  return {
    version: SCORECARD_VERSION,
    jobs,
    companies,
    evidence,
    reports,
    clicks,
    history,
    latest: { marketSnapshot: latest?.snapshot ?? null, clickRollup: latest?.clicks ?? null },
  }
}

// ---- Comparison and text (pure) ---------------------------------------------------------------------------------------

/** A fill rate: how many of a population have a field. `of` is the population's key in the same group. */
type FillRow = { label: string; group: 'jobs' | 'companies'; field: string; of: string }
const FILL_ROWS: FillRow[] = [
  { label: 'Pay validated', group: 'jobs', field: 'salaryValidated', of: 'live' },
  { label: 'Has an employer posting date', group: 'jobs', field: 'withPostedAt', of: 'live' },
  { label: 'Remote jobs with a country', group: 'jobs', field: 'remoteWithCountry', of: 'remote' },
  { label: 'Has benefits listed', group: 'jobs', field: 'withBenefits', of: 'live' },
  { label: 'Has a tech stack', group: 'jobs', field: 'withTechStack', of: 'live' },
  { label: 'Has an AI one-liner', group: 'jobs', field: 'withAiOneLiner', of: 'live' },
  { label: 'Has a real expiry date from the source', group: 'jobs', field: 'withExpiresAt', of: 'live' },
  { label: 'Live but hidden by the age rule (posted too long ago)', group: 'jobs', field: 'hiddenByAge', of: 'live' },
  { label: 'Seen this week but posted over 21 days ago', group: 'jobs', field: 'keptAliveOld', of: 'live' },
  ...(['website', 'logo', 'description', 'industry', 'employeeCount', 'fundingStage', 'headquarters', 'foundedYear', 'sizeBucket', 'country', 'linkedin'] as const).map(
    (field): FillRow => ({ label: `Company ${field}`, group: 'companies', field, of: 'total' }),
  ),
]

export function flattenMetrics(m: ScorecardMetrics): Record<string, number> {
  const out: Record<string, number> = {}
  for (const group of ['jobs', 'companies', 'evidence', 'reports', 'clicks', 'history'] as const) {
    for (const [k, v] of Object.entries(m[group] ?? {})) out[`${group}.${k}`] = v
  }
  return out
}

/** Current minus previous for every number both scorecards have. */
export function diffMetrics(prev: ScorecardMetrics, curr: ScorecardMetrics): Record<string, number> {
  const a = flattenMetrics(prev)
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(flattenMetrics(curr))) if (k in a) out[k] = v - a[k]
  return out
}

const pct = (num: number, den: number) => (den > 0 ? (100 * num) / den : null)
const fmt = (v: number) => v.toLocaleString('en-US')
const signed = (v: number, suffix = '') => (v === 0 ? `0${suffix}` : `${v > 0 ? '+' : ''}${Number.isInteger(v) ? fmt(v) : v.toFixed(1)}${suffix}`)

/** Markdown for the run summary: each fill rate with its change in percentage points since the previous scorecard. */
export function renderScorecard(curr: ScorecardMetrics, prev: ScorecardMetrics | null, date: string): string {
  const lines = [`## Data scorecard, ${date}`, '']
  lines.push(prev ? 'Change is in percentage points against the previous scorecard.' : 'First scorecard: no earlier one to compare with.', '')
  lines.push('| Field | Have | Of | Share | Change |', '| --- | ---: | ---: | ---: | ---: |')
  for (const r of FILL_ROWS) {
    const num = curr[r.group][r.field]
    const den = curr[r.group][r.of]
    if (num === undefined || den === undefined) continue
    const share = pct(num, den)
    const before = prev && prev[r.group][r.field] !== undefined ? pct(prev[r.group][r.field], prev[r.group][r.of]) : null
    const change = share !== null && before !== null ? signed(Math.round((share - before) * 10) / 10, ' pp') : '-'
    lines.push(`| ${r.label} | ${fmt(num)} | ${fmt(den)} | ${share === null ? '-' : `${share.toFixed(1)}%`} | ${change} |`)
  }
  const d = prev ? diffMetrics(prev, curr) : {}
  const countRow = (label: string, key: string) => {
    const v = flattenMetrics(curr)[key]
    return v === undefined ? null : `| ${label} | ${fmt(v)} | ${key in d ? signed(d[key]) : '-'} |`
  }
  lines.push('', '| Count | Now | Change |', '| --- | ---: | ---: |')
  for (const row of [
    countRow('Live jobs', 'jobs.live'),
    countRow('Remote jobs', 'jobs.remote'),
    countRow('Jobs flagged for visa sponsorship', 'jobs.visaFlagged'),
    countRow('Companies', 'companies.total'),
    countRow('Quote-backed fields stored', 'evidence.rows'),
    countRow('Job reports, last 7 days', 'reports.last7d'),
    countRow('Apply clicks, last 7 days', 'clicks.last7d'),
    countRow('Apply clicks, last 30 days', 'clicks.last30d'),
    countRow('Jobs with lifecycle history', 'history.lifecycleTracked'),
    countRow('Expiries observed', 'history.lifecycleExpiredObserved'),
    countRow('Pay changes observed (jobs)', 'history.lifecyclePayChanged'),
    countRow('Market snapshot rows', 'history.marketSnapshotRows'),
  ]) if (row) lines.push(row)
  return lines.join('\n') + '\n'
}
