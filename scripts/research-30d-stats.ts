// scripts/research-30d-stats.ts
//
// A read-only salary and hiring report for the jobs we added in the last 30 days, to base a published research page on:
// which roles, seniority levels, countries and companies pay the most, how pay splits across remote and on-site, and
// how the window compares with the 30 days before it.
//
// Method (keep it identical on the published page): a job counts for pay when its salary is validated with confidence
// >= 80 (the gate the /salary pages use), is in USD (no currency conversion, so no exchange-rate guess), and its annual
// figure is at most 600,000 (the ingest cap). The annual figure is the midpoint of the minimum and maximum when both exist,
// else whichever one exists. "Added" means `createdAt`, the day we first stored the job, not the date the employer posted
// it. Counts include jobs that have since expired, because the window is about what the market offered, not what is live now.
//
// Read-only twice over, like scripts/audit-db-coverage.ts: every statement is one SELECT and the run is one READ ONLY
// transaction. Output is counts, medians and public company / job titles: no emails, names of people or secrets.
//
//   npm run research:30d
import { appendFileSync } from 'node:fs'

import { toMarkdown, type Audit } from './audit-db-coverage'

const MIN_CONFIDENCE = 80
const USD_CAP = 600_000
const MIN_GROUP = 5 // a role / country / city needs this many pay-validated jobs before its median is shown

const WINDOW = `"createdAt" > now() - interval '30 days'`
const REMOTE = `("remote" = true OR "remoteMode" = 'remote')`
const ANNUAL = `(CASE WHEN "minAnnual" IS NOT NULL AND "maxAnnual" IS NOT NULL THEN ("minAnnual" + "maxAnnual") / 2 ELSE COALESCE("maxAnnual", "minAnnual") END)`
const PAY_OK = `"salaryValidated" AND "salaryConfidence" >= ${MIN_CONFIDENCE} AND "currency" = 'USD' AND COALESCE("maxAnnual", "minAnnual") IS NOT NULL AND COALESCE("maxAnnual", "minAnnual") <= ${USD_CAP}`
const MEDIAN = `round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${ANNUAL}::float8))::bigint`
const P75 = `round(percentile_cont(0.75) WITHIN GROUP (ORDER BY ${ANNUAL}::float8))::bigint`

/** Median / 75th percentile / top figure for one grouping column (pure). */
function payBy(title: string, column: string, note: string, min = MIN_GROUP, limit = 20): Audit {
  return {
    title,
    note,
    sql: `SELECT ${column} AS "group", count(*) AS jobs, ${MEDIAN} AS median_usd, ${P75} AS p75_usd, max(${ANNUAL})::bigint AS top_usd
    FROM "Job" WHERE ${WINDOW} AND ${PAY_OK} AND ${column} IS NOT NULL AND btrim(${column}::text) <> ''
    GROUP BY 1 HAVING count(*) >= ${min} ORDER BY 3 DESC LIMIT ${limit}`,
  }
}

export const RESEARCH: Audit[] = [
  {
    title: 'The window: last 30 days vs the 30 days before',
    note: 'pay_jobs = jobs with a validated USD salary under the method above; six_figure = those at 100,000 or more.',
    sql: `SELECT CASE WHEN ${WINDOW} THEN 'last 30 days' ELSE 'previous 30 days' END AS period,
      count(*) AS jobs_added, count(DISTINCT company) AS companies, count(DISTINCT "countryCode") AS countries,
      count(*) FILTER (WHERE ${REMOTE}) AS remote_jobs,
      count(*) FILTER (WHERE ${PAY_OK}) AS pay_jobs,
      count(*) FILTER (WHERE ${PAY_OK} AND ${ANNUAL} >= 100000) AS six_figure,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${ANNUAL}::float8) FILTER (WHERE ${PAY_OK}))::bigint AS median_usd
    FROM "Job" WHERE "createdAt" > now() - interval '60 days'
    GROUP BY 1 ORDER BY 1`,
  },
  payBy('Pay by role', `"roleSlug"`, `USD, validated salaries, roles with at least ${MIN_GROUP} jobs. Sorted by median.`, MIN_GROUP, 25),
  payBy('Pay by seniority', `"experienceLevel"`, 'USD, validated salaries, by stored experience level.'),
  payBy('Pay by work arrangement', `coalesce("remoteMode", CASE WHEN "remote" THEN 'remote' END, "workArrangement")`, 'USD, validated salaries.', 3),
  payBy('Pay by country', `"countryCode"`, `USD-priced jobs only, so it shows pay in the countries that quote USD. At least 10 jobs.`, 10),
  payBy('Pay by US state', `"stateCode"`, 'USD, validated salaries, at least 8 jobs.', 8),
  payBy('Pay by city', `"city"`, 'USD, validated salaries, at least 8 jobs.', 8, 15),
  payBy('Pay by industry', `"industry"`, 'USD, validated salaries, at least 8 jobs.', 8),
  {
    title: 'Where the jobs sit in salary bands',
    note: 'Share of validated USD jobs in each band.',
    sql: `SELECT CASE WHEN ${ANNUAL} < 100000 THEN '1) under 100k'
        WHEN ${ANNUAL} < 150000 THEN '2) 100k-149k' WHEN ${ANNUAL} < 200000 THEN '3) 150k-199k'
        WHEN ${ANNUAL} < 300000 THEN '4) 200k-299k' ELSE '5) 300k+' END AS band,
      count(*) AS jobs, round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
    FROM "Job" WHERE ${WINDOW} AND ${PAY_OK} GROUP BY 1 ORDER BY 1`,
  },
  {
    title: 'What six-figure jobs say about degrees, visas and remote work',
    note: 'Among validated USD jobs paying 100,000 or more. noDegreeMention is the stored flag for a posting that says no degree is needed.',
    sql: `SELECT count(*) AS six_figure_jobs,
      round(100.0 * count(*) FILTER (WHERE "noDegreeMention") / count(*), 1) AS pct_no_degree_mentioned,
      round(100.0 * count(*) FILTER (WHERE "visaSponsorship") / count(*), 1) AS pct_visa_sponsorship,
      round(100.0 * count(*) FILTER (WHERE ${REMOTE}) / count(*), 1) AS pct_remote
    FROM "Job" WHERE ${WINDOW} AND ${PAY_OK} AND ${ANNUAL} >= 100000`,
  },
  {
    title: 'Companies with the most six-figure listings',
    note: 'Validated USD jobs paying 100,000 or more, added in the window. Public company names.',
    sql: `SELECT company, count(*) AS six_figure_jobs, ${MEDIAN} AS median_usd
    FROM "Job" WHERE ${WINDOW} AND ${PAY_OK} AND ${ANNUAL} >= 100000
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 20`,
  },
  {
    title: 'Roles hiring faster than the 30 days before',
    note: 'Validated USD six-figure jobs added per role in the last 30 days against the 30 days before. Roles with at least 5 jobs in the last 30 days.',
    sql: `SELECT "roleSlug" AS role,
      count(*) FILTER (WHERE ${WINDOW}) AS last_30d,
      count(*) FILTER (WHERE NOT (${WINDOW})) AS previous_30d,
      round(100.0 * (count(*) FILTER (WHERE ${WINDOW}) - count(*) FILTER (WHERE NOT (${WINDOW}))) / nullif(count(*) FILTER (WHERE NOT (${WINDOW})), 0), 0) AS change_pct
    FROM "Job" WHERE "createdAt" > now() - interval '60 days' AND ${PAY_OK} AND ${ANNUAL} >= 100000 AND "roleSlug" IS NOT NULL
    GROUP BY 1 HAVING count(*) FILTER (WHERE ${WINDOW}) >= 5 ORDER BY 4 DESC NULLS LAST LIMIT 15`,
  },
  {
    title: 'Jobs added per week',
    note: 'Weeks start on Monday; the first and last weeks may be partial.',
    sql: `SELECT date_trunc('week', "createdAt")::date AS week_start, count(*) AS jobs_added,
      count(*) FILTER (WHERE ${PAY_OK}) AS pay_jobs, count(*) FILTER (WHERE ${PAY_OK} AND ${ANNUAL} >= 100000) AS six_figure
    FROM "Job" WHERE ${WINDOW} GROUP BY 1 ORDER BY 1`,
  },
  {
    title: 'Highest advertised salaries',
    note: 'Top validated USD figures in the window (midpoint). Check each one before quoting it: an outlier can still pass the gate.',
    sql: `SELECT title, company, "countryCode" AS country, ${ANNUAL}::bigint AS annual_usd
    FROM "Job" WHERE ${WINDOW} AND ${PAY_OK} ORDER BY 4 DESC LIMIT 10`,
  },
]

type Row = Record<string, unknown>

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const parts: string[] = [
    '## 30-day salary and hiring research',
    '',
    `Run at ${new Date().toISOString()}. Read-only. Pay = validated USD salary, confidence >= ${MIN_CONFIDENCE}, annual <= ${USD_CAP}.`,
    '',
  ]
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY') // must be the first statement in the transaction
        for (const audit of RESEARCH) {
          const rows = (await tx.$queryRawUnsafe(audit.sql)) as Row[]
          parts.push(toMarkdown(audit, rows))
        }
      },
      { timeout: 120_000, maxWait: 30_000 },
    )
  } finally {
    await prisma.$disconnect()
  }
  const report = parts.join('\n')
  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
