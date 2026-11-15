// scripts/research-30d-stats.ts
//
// A read-only salary and hiring report for the jobs we collected in the last 30 days, to base a published research page on:
// which roles, seniority levels, countries and companies advertise the most, how pay splits across remote and on-site, and
// whether the window itself can be trusted.
//
// Method (keep it identical on the published page). A job counts for pay when its salary is validated with confidence >= 80
// (the gate the /salary pages use), is in USD (no currency conversion, so no exchange-rate guess), and its annual figure is
// BELOW 600,000 (a value at exactly the ingest cap is a clamp, not a real figure). The annual figure is the midpoint of the
// advertised minimum and maximum when both exist, else whichever one exists, so it describes advertised ranges, not what
// people are paid; the median of the minimums is shown beside it as the conservative figure.
//
// Which window? `createdAt` is the day we stored a job, which jumps when a source is added or a backfill runs; `postedAt`
// is the employer's own date but is not always set. The diagnostics at the top show both and which sources caused any jump;
// RESEARCH_BASIS picks the window the pay tables use: created (default), posted, or posted_or_created.
//
// Read-only twice over, like scripts/audit-db-coverage.ts: every statement is one SELECT and the run is one READ ONLY
// transaction. Output is counts, medians and public company / job titles: no emails, names of people or secrets.
//
//   npm run research:30d                       # window = createdAt
//   RESEARCH_BASIS=posted_or_created npm run research:30d
import { appendFileSync } from 'node:fs'

import { AGGREGATOR_PATTERNS, BAY_AREA_CITIES, MIN_CONFIDENCE, MIN_SAME_ROLE_EMPLOYERS, MIN_SKILL_EMPLOYERS, USD_CAP } from '../lib/research/method'
import { toMarkdown, type Audit } from './audit-db-coverage'

export type Basis = 'created' | 'posted' | 'posted_or_created'
export type Research = Audit & { /** true when the query reports pay and so must carry the pay gate */ pay?: boolean }


const THIRTY = `interval '30 days'`
const REMOTE = `("remote" = true OR "remoteMode" = 'remote')`
const ANNUAL = `(CASE WHEN "minAnnual" IS NOT NULL AND "maxAnnual" IS NOT NULL THEN ("minAnnual" + "maxAnnual") / 2 ELSE COALESCE("maxAnnual", "minAnnual") END)`
const MIN_PAY = `COALESCE("minAnnual", "maxAnnual")`
const PAY_OK = `"salaryValidated" AND "salaryConfidence" >= ${MIN_CONFIDENCE} AND "currency" = 'USD' AND COALESCE("maxAnnual", "minAnnual") IS NOT NULL AND COALESCE("maxAnnual", "minAnnual") < ${USD_CAP}`
// Job boards and aggregators list other employers' jobs under their own name; they are not employers.
const NOT_AGGREGATOR = `"company" NOT ILIKE ALL (ARRAY[${AGGREGATOR_PATTERNS.map((x) => `'${x}'`).join(',')}])`

const ARRANGEMENT = `coalesce("remoteMode", CASE WHEN "remote" THEN 'remote' END, "workArrangement")`
// Skills compared on the pay report. A listing's skills are a JSON array of strings, so each is matched as a quoted token (the
// same way the job search does), never as a bare substring ("Java" must not match "JavaScript").
const REPORT_SKILLS = [
  'Python', 'Java', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'C++', 'Kotlin', 'Swift', 'Scala', 'Ruby', 'React', 'Node.js',
  'Kubernetes', 'Docker', 'AWS', 'GCP', 'Azure', 'Terraform', 'SQL', 'Spark', 'Kafka', 'PyTorch', 'TensorFlow', 'Snowflake', 'Salesforce',
]

/** The SQL condition for "in the last 30 days" under one definition (pure). */
export function windowFor(basis: Basis): string {
  if (basis === 'posted') return `"postedAt" > now() - ${THIRTY}`
  if (basis === 'posted_or_created') return `COALESCE("postedAt", "createdAt") > now() - ${THIRTY}`
  return `"createdAt" > now() - ${THIRTY}`
}

const medianOf = (expr: string, where: string) => `round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${expr}::float8) FILTER (WHERE ${where}))::bigint`

type PayBy = {
  title: string
  column: string
  note: string
  window: string
  minJobs?: number
  minCompanies?: number
  limit?: number
  extraWhere?: string
  orderBy?: 'median_usd' | 'jobs'
}

/** Median / 75th percentile / top figure for one grouping column; a group needs enough jobs AND enough employers (pure). */
function payBy(o: PayBy): Research {
  const minJobs = o.minJobs ?? 5
  const minCompanies = o.minCompanies ?? 3
  return {
    title: o.title,
    note: o.note,
    pay: true,
    sql: `SELECT ${o.column} AS "group", count(*) AS jobs, count(DISTINCT company) AS companies,
      round(percentile_cont(0.25) WITHIN GROUP (ORDER BY ${ANNUAL}::float8))::bigint AS p25_usd,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${ANNUAL}::float8))::bigint AS median_usd,
      round(percentile_cont(0.75) WITHIN GROUP (ORDER BY ${ANNUAL}::float8))::bigint AS p75_usd,
      max(${ANNUAL})::bigint AS top_usd
    FROM "Job" WHERE ${o.window} AND ${PAY_OK} AND ${o.column} IS NOT NULL AND btrim(${o.column}::text) <> '' ${o.extraWhere ?? ''}
    GROUP BY 1 HAVING count(*) >= ${minJobs} AND count(DISTINCT company) >= ${minCompanies}
    ORDER BY ${o.orderBy ?? 'median_usd'} DESC LIMIT ${o.limit ?? 20}`,
  }
}

function overviewRow(label: string, where: string): string {
  return `SELECT '${label}' AS definition, count(*) AS jobs, count(DISTINCT company) AS companies, count(*) FILTER (WHERE ${PAY_OK}) AS pay_jobs,
      ${medianOf(ANNUAL, PAY_OK)} AS median_midpoint_usd, ${medianOf(MIN_PAY, PAY_OK)} AS median_minimum_usd
    FROM "Job" WHERE ${where}`
}

export function buildResearch(basis: Basis = 'created'): Research[] {
  const W = windowFor(basis)
  return [
    // ---- Can the window be trusted? (not tied to the chosen basis) ----
    {
      title: 'Diagnostic 1: the window under three definitions',
      note: 'Same 30 days, counted by when we stored a job, by the employer\'s posted date, and by posted date falling back to stored date. pay_jobs = validated USD salary under the method above.',
      sql: [
        overviewRow('stored in the last 30 days (createdAt)', `"createdAt" > now() - ${THIRTY}`),
        overviewRow('posted in the last 30 days (postedAt, when set)', `"postedAt" > now() - ${THIRTY}`),
        overviewRow('posted, else stored, in the last 30 days', `COALESCE("postedAt", "createdAt") > now() - ${THIRTY}`),
        overviewRow('posted 31 to 60 days ago (postedAt, when set)', `"postedAt" <= now() - ${THIRTY} AND "postedAt" > now() - interval '60 days'`),
      ].join('\n    UNION ALL\n    '),
    },
    {
      title: 'Diagnostic 2: jobs stored per day (createdAt)',
      note: 'A spike on one or two days is a backfill or a new source, not hiring.',
      sql: `SELECT "createdAt"::date AS day, count(*) AS stored, count("postedAt") AS with_posted_at, count(*) FILTER (WHERE "isExpired") AS expired_now
    FROM "Job" WHERE "createdAt" > now() - ${THIRTY} GROUP BY 1 ORDER BY 1`,
    },
    {
      title: 'Diagnostic 3: which sources stored the jump',
      note: 'Jobs stored by each source in three periods. A source that is large in the first column and small in the others is new or was backfilled.',
      sql: `SELECT source,
      count(*) FILTER (WHERE "createdAt" > now() - interval '7 days') AS stored_last_7d,
      count(*) FILTER (WHERE "createdAt" <= now() - interval '7 days' AND "createdAt" > now() - ${THIRTY}) AS stored_8_to_30d_ago,
      count(*) FILTER (WHERE "createdAt" <= now() - ${THIRTY}) AS stored_31_to_60d_ago
    FROM "Job" WHERE "createdAt" > now() - interval '60 days' GROUP BY 1 ORDER BY 2 DESC, 3 DESC LIMIT 15`,
    },
    {
      title: 'Diagnostic 4: posted date against stored date',
      note: 'For jobs stored in the last 30 days: how many have an employer posted date, how many were posted before the window, and the median days between posting and storing.',
      sql: `SELECT count(*) AS stored_30d, count("postedAt") AS has_posted_at,
      count(*) FILTER (WHERE "postedAt" > now() - ${THIRTY}) AS posted_in_window,
      count(*) FILTER (WHERE "postedAt" <= now() - ${THIRTY}) AS posted_before_window,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY (extract(epoch FROM ("createdAt" - "postedAt")) / 86400)::float8) FILTER (WHERE "postedAt" IS NOT NULL))::bigint AS median_days_posted_to_stored
    FROM "Job" WHERE "createdAt" > now() - ${THIRTY}`,
    },
    {
      title: 'Diagnostic 5: does the table keep pay under 100,000?',
      note: 'USD jobs with an annual figure, stored in the window. If under_100k is near zero, every pay statistic describes six-figure listings only.',
      sql: `SELECT count(*) AS usd_jobs_with_pay,
      count(*) FILTER (WHERE COALESCE("maxAnnual", "minAnnual") < 100000) AS under_100k_any,
      count(*) FILTER (WHERE COALESCE("maxAnnual", "minAnnual") < 100000 AND "salaryValidated" AND "salaryConfidence" >= ${MIN_CONFIDENCE}) AS under_100k_validated,
      count(*) FILTER (WHERE COALESCE("maxAnnual", "minAnnual") >= 100000) AS at_or_over_100k,
      count(*) FILTER (WHERE COALESCE("maxAnnual", "minAnnual") = ${USD_CAP}) AS exactly_at_cap
    FROM "Job" WHERE ${W} AND "currency" = 'USD' AND COALESCE("maxAnnual", "minAnnual") IS NOT NULL`,
    },
    {
      title: 'Evidence: what was counted and what was left out',
      note: 'The funnel behind the report: every job stored in the window, then those with any annual pay figure, in US dollars, validated with confidence of at least the gate, and below the cap (= the base of the tables). The report shows these steps so a reader can see what was dropped and why. It counts jobs, not pay figures, so it carries no pay gate.',
      sql: `SELECT count(*) AS in_window,
      count(*) FILTER (WHERE COALESCE("maxAnnual", "minAnnual") IS NOT NULL) AS with_annual_pay,
      count(*) FILTER (WHERE COALESCE("maxAnnual", "minAnnual") IS NOT NULL AND "currency" = 'USD') AS usd,
      count(*) FILTER (WHERE COALESCE("maxAnnual", "minAnnual") IS NOT NULL AND "currency" = 'USD' AND "salaryValidated" AND "salaryConfidence" >= ${MIN_CONFIDENCE}) AS usd_validated,
      count(*) FILTER (WHERE ${PAY_OK}) AS in_the_report,
      count(*) FILTER (WHERE COALESCE("maxAnnual", "minAnnual") IS NOT NULL AND "currency" = 'USD' AND COALESCE("maxAnnual", "minAnnual") >= ${USD_CAP}) AS at_or_over_cap,
      count(*) FILTER (WHERE COALESCE("maxAnnual", "minAnnual") IS NOT NULL AND "currency" <> 'USD') AS other_currency
    FROM "Job" WHERE ${W}`,
    },
    // ---- Pay statistics (window = chosen basis) ----
    {
      title: `Pay: headline figures (window: ${basis})`,
      note: 'Median of the midpoints, median of the minimums, and the median of company medians (each company counts once, so a few big employers cannot set the figure).',
      pay: true,
      sql: `SELECT count(*) AS pay_jobs, count(DISTINCT company) AS companies,
      ${medianOf(ANNUAL, 'true')} AS median_midpoint_usd, ${medianOf(MIN_PAY, 'true')} AS median_minimum_usd,
      (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY m))::bigint FROM (
         SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ${ANNUAL}::float8) AS m FROM "Job"
         WHERE ${W} AND ${PAY_OK} AND ${NOT_AGGREGATOR} GROUP BY company HAVING count(*) >= 3) t) AS median_of_company_medians_usd
    FROM "Job" WHERE ${W} AND ${PAY_OK} AND ${NOT_AGGREGATOR}`,
    },
    {
      title: 'Pay: how concentrated are the employers',
      note: 'Share of the pay-validated jobs that come from the largest employers (aggregators excluded).',
      pay: true,
      sql: `SELECT count(*) AS companies, sum(c) AS jobs,
      round(100.0 * max(c) / sum(c), 1) AS top1_pct,
      round(100.0 * sum(c) FILTER (WHERE rn <= 5) / sum(c), 1) AS top5_pct,
      round(100.0 * sum(c) FILTER (WHERE rn <= 20) / sum(c), 1) AS top20_pct
    FROM (SELECT company, count(*) AS c, row_number() OVER (ORDER BY count(*) DESC, company) AS rn
      FROM "Job" WHERE ${W} AND ${PAY_OK} AND ${NOT_AGGREGATOR} GROUP BY company) t`,
    },
    payBy({
      title: 'Pay by role',
      column: `"roleSlug"`,
      note: 'Roles with at least 20 jobs from at least 5 employers. Sorted by median midpoint.',
      window: W,
      minJobs: 20,
      minCompanies: 5,
      limit: 30,
    }),
    payBy({
      title: 'Most-listed roles',
      column: `"roleSlug"`,
      note: 'The same gate, sorted by number of jobs.',
      window: W,
      minJobs: 20,
      minCompanies: 5,
      limit: 15,
      orderBy: 'jobs',
    }),
    payBy({ title: 'Pay by seniority', column: `"experienceLevel"`, note: 'By stored experience level.', window: W }),
    payBy({
      title: 'Pay by work arrangement',
      column: `coalesce("remoteMode", CASE WHEN "remote" THEN 'remote' END, "workArrangement")`,
      note: 'Remote, hybrid and on-site as stored.',
      window: W,
      minCompanies: 3,
    }),
    payBy({
      title: 'Pay by country',
      column: `"countryCode"`,
      note: 'USD-priced jobs only, so it shows pay in the countries that quote USD. At least 10 jobs from 3 employers.',
      window: W,
      minJobs: 10,
    }),
    payBy({
      title: 'Pay by city',
      column: `"city"`,
      note: 'Cities with at least 8 jobs from 3 employers. Labels that are not plain city names (offices, regions, "US - ...") are left out.',
      window: W,
      minJobs: 8,
      limit: 15,
      extraWhere: `AND "city" !~* '(office|\\(|\\)| - |&|,|united states|remote|\\mus\\M)'`,
    }),
    {
      title: 'Pay: where the jobs sit in salary bands',
      note: 'Share of validated USD jobs in each band. Nothing is stored under 100k if Diagnostic 5 says so.',
      pay: true,
      sql: `SELECT CASE WHEN ${ANNUAL} < 100000 THEN '1) under 100k'
        WHEN ${ANNUAL} < 150000 THEN '2) 100k-149k' WHEN ${ANNUAL} < 200000 THEN '3) 150k-199k'
        WHEN ${ANNUAL} < 300000 THEN '4) 200k-299k' ELSE '5) 300k+' END AS band,
      count(*) AS jobs, round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
    FROM "Job" WHERE ${W} AND ${PAY_OK} GROUP BY 1 ORDER BY 1`,
    },
    {
      title: 'Pay: how wide the advertised ranges are',
      note: 'Among validated USD jobs that state both ends of the range: the median gap between maximum and minimum in dollars and as a percentage of the minimum, and the share whose maximum is at least 1.5 times the minimum. of_all is every validated USD job in the window.',
      pay: true,
      sql: `SELECT count(*) AS of_all,
      count(*) FILTER (WHERE "minAnnual" > 0 AND "maxAnnual" > "minAnnual") AS ranged,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY (100.0 * ("maxAnnual" - "minAnnual") / "minAnnual")::float8) FILTER (WHERE "minAnnual" > 0 AND "maxAnnual" > "minAnnual")::numeric, 1) AS median_width_pct,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ("maxAnnual" - "minAnnual")::float8) FILTER (WHERE "minAnnual" > 0 AND "maxAnnual" > "minAnnual"))::bigint AS median_width_usd,
      round(100.0 * count(*) FILTER (WHERE "minAnnual" > 0 AND "maxAnnual" >= 1.5 * "minAnnual") / NULLIF(count(*) FILTER (WHERE "minAnnual" > 0 AND "maxAnnual" > "minAnnual"), 0), 1) AS pct_wider_than_50
    FROM "Job" WHERE ${W} AND ${PAY_OK}`,
    },
    {
      title: 'Pay: the same role, remote against on-site',
      note: 'Roles with at least 20 remote AND 20 on-site validated USD jobs, each side from at least 5 employers. Compares like with like, which the all-jobs remote and on-site medians do not (they mix roles and cities). remote_vs_onsite_pct is negative when remote pays less.',
      pay: true,
      sql: `SELECT r."roleSlug" AS "group", r.jobs AS remote_jobs, r.companies AS remote_companies, round(r.median)::bigint AS remote_median_usd,
      o.jobs AS onsite_jobs, o.companies AS onsite_companies, round(o.median)::bigint AS onsite_median_usd,
      round((100.0 * (r.median - o.median) / o.median)::numeric, 1) AS remote_vs_onsite_pct
    FROM (SELECT "roleSlug", count(*) AS jobs, count(DISTINCT company) AS companies, percentile_cont(0.5) WITHIN GROUP (ORDER BY ${ANNUAL}::float8) AS median
        FROM "Job" WHERE ${W} AND ${PAY_OK} AND "roleSlug" IS NOT NULL AND ${ARRANGEMENT} = 'remote'
        GROUP BY 1 HAVING count(*) >= 20 AND count(DISTINCT company) >= ${MIN_SAME_ROLE_EMPLOYERS}) r
    JOIN (SELECT "roleSlug", count(*) AS jobs, count(DISTINCT company) AS companies, percentile_cont(0.5) WITHIN GROUP (ORDER BY ${ANNUAL}::float8) AS median
        FROM "Job" WHERE ${W} AND ${PAY_OK} AND "roleSlug" IS NOT NULL AND ${ARRANGEMENT} = 'onsite'
        GROUP BY 1 HAVING count(*) >= 20 AND count(DISTINCT company) >= ${MIN_SAME_ROLE_EMPLOYERS}) o ON o."roleSlug" = r."roleSlug"
    ORDER BY (r.jobs + o.jobs) DESC LIMIT 20`,
    },
    {
      title: 'Pay by skill named in the listing',
      note: 'A listing counts once for each listed skill it names, so the rows overlap. At least 50 jobs from at least 10 employers. This is an association, not a cause: skills cluster in senior and specialist roles, so a high median mostly reflects which roles use the skill.',
      pay: true,
      sql: `SELECT s.skill AS "group", count(*) AS jobs, count(DISTINCT j.company) AS companies,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY j.annual::float8))::bigint AS median_usd
    FROM (SELECT company, ${ANNUAL} AS annual, "skillsJson" FROM "Job" WHERE ${W} AND ${PAY_OK} AND "skillsJson" IS NOT NULL) j
    JOIN (VALUES ${REPORT_SKILLS.map((k) => `('${k}')`).join(', ')}) AS s(skill) ON j."skillsJson" ILIKE '%"' || s.skill || '"%'
    GROUP BY 1 HAVING count(*) >= 50 AND count(DISTINCT j.company) >= ${MIN_SKILL_EMPLOYERS}
    ORDER BY median_usd DESC LIMIT 20`,
    },
    {
      title: 'Pay: do a few big employers or one region set the headline?',
      note: 'The headline median (validated USD jobs) five ways: everything; named employers only (aggregators out); without the five largest employers; without the Bay Area cities named in lib/research/method.ts (jobs with no city are kept); one job per employer and title (the same role posted for several places counts once, a floor for duplicates). If the medians barely move, no one group is driving the number.',
      pay: true,
      sql: [
        `SELECT '1) all validated USD jobs' AS variant, count(*) AS jobs, count(DISTINCT company) AS companies, ${medianOf(ANNUAL, 'true')} AS median_usd FROM "Job" WHERE ${W} AND ${PAY_OK}`,
        `SELECT '2) named employers only (aggregators out)', count(*), count(DISTINCT company), ${medianOf(ANNUAL, 'true')} FROM "Job" WHERE ${W} AND ${PAY_OK} AND ${NOT_AGGREGATOR}`,
        `SELECT '3) without the 5 largest employers', count(*), count(DISTINCT company), ${medianOf(ANNUAL, 'true')} FROM "Job" WHERE ${W} AND ${PAY_OK} AND ${NOT_AGGREGATOR}
          AND company NOT IN (SELECT company FROM "Job" WHERE ${W} AND ${PAY_OK} AND ${NOT_AGGREGATOR} GROUP BY company ORDER BY count(*) DESC, company LIMIT 5)`,
        `SELECT '4) without the Bay Area cities', count(*), count(DISTINCT company), ${medianOf(ANNUAL, 'true')} FROM "Job" WHERE ${W} AND ${PAY_OK}
          AND ("city" IS NULL OR "city" NOT IN (${BAY_AREA_CITIES.map((c) => `'${c}'`).join(', ')}))`,
        `SELECT '5) one job per employer and title', count(*), count(DISTINCT company), round(percentile_cont(0.5) WITHIN GROUP (ORDER BY annual::float8))::bigint
          FROM (SELECT DISTINCT ON (company, title) company, ${ANNUAL} AS annual FROM "Job" WHERE ${W} AND ${PAY_OK} ORDER BY company, title, "postedAt" DESC NULLS LAST) t`,
      ].join('\n    UNION ALL\n    '),
    },
    {
      title: 'Audit sample: 100 random validated jobs to check by hand',
      note: 'Open each posting, compare its pay with advertised_text and the stored range, and count the matches. The report states the result only when this check was really done (spotCheck in the edition file). random() makes each run a new sample; save the one you check.',
      pay: true,
      sql: `SELECT title, company, source, left("salaryRaw", 120) AS advertised_text, "minAnnual"::bigint AS min_usd, "maxAnnual"::bigint AS max_usd, "salaryConfidence" AS confidence, COALESCE("applyUrl", "url") AS posting
    FROM "Job" WHERE ${W} AND ${PAY_OK} ORDER BY random() LIMIT 100`,
    },
    {
      title: 'Six-figure jobs: visa sponsorship and remote share',
      note: 'Among validated USD jobs paying 100,000 or more.',
      pay: true,
      sql: `SELECT count(*) AS six_figure_jobs,
      round(100.0 * count(*) FILTER (WHERE "visaSponsorship") / count(*), 1) AS pct_visa_sponsorship,
      round(100.0 * count(*) FILTER (WHERE ${REMOTE}) / count(*), 1) AS pct_remote
    FROM "Job" WHERE ${W} AND ${PAY_OK} AND ${ANNUAL} >= 100000`,
    },
    {
      title: 'Employers with the most six-figure listings',
      note: 'Validated USD jobs paying 100,000 or more. Job boards and aggregators are left out: they list other employers\' jobs.',
      pay: true,
      sql: `SELECT company, count(*) AS six_figure_jobs, ${medianOf(ANNUAL, 'true')} AS median_usd
    FROM "Job" WHERE ${W} AND ${PAY_OK} AND ${ANNUAL} >= 100000 AND ${NOT_AGGREGATOR}
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 20`,
    },
    {
      title: 'Highest advertised salaries',
      note: 'Top validated USD figures below the cap (midpoint), with the advertised text so each can be checked against the posting before it is quoted.',
      pay: true,
      sql: `SELECT title, company, source, "countryCode" AS country, left("salaryRaw", 120) AS advertised_text, ${ANNUAL}::bigint AS midpoint_usd, "postedAt"::date AS posted, now()::date AS captured
    FROM "Job" WHERE ${W} AND ${PAY_OK} AND ${NOT_AGGREGATOR} ORDER BY 6 DESC LIMIT 12`,
    },
  ]
}

export const RESEARCH: Research[] = buildResearch('created')

type Row = Record<string, unknown>

function readBasis(): Basis {
  const raw = (process.env.RESEARCH_BASIS || 'created').trim()
  if (raw === 'created' || raw === 'posted' || raw === 'posted_or_created') return raw
  throw new Error(`RESEARCH_BASIS must be created, posted or posted_or_created, got "${raw}"`)
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const basis = readBasis()
  const { prisma } = await import('../lib/prisma')
  const parts: string[] = [
    '## 30-day salary and hiring research',
    '',
    `Run at ${new Date().toISOString()}. Read-only. Window basis: ${basis}. Pay = validated USD salary, confidence >= ${MIN_CONFIDENCE}, annual below ${USD_CAP}.`,
    '',
  ]
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY') // must be the first statement in the transaction
        for (const audit of buildResearch(basis)) {
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
