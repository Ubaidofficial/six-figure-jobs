// scripts/audit-db-coverage.ts
//
// A read-only report on what the live Job and Company tables hold, for deciding what to store and publish next: how many
// jobs are live and new, how complete company profiles are, which currencies the six-figure jobs use, how remote jobs
// name where they can be worked from, and how many jobs carry a real expiry date from their source.
//
// Read-only twice over: every statement is a SELECT, and the whole run is one transaction set to READ ONLY, so the
// database refuses a write even if one were added by mistake. Output is counts and the most common location texts (public
// job data): no emails, names of people or secrets. Run from the "database audit" workflow, or locally with DATABASE_URL.
//
//   npm run audit:db-coverage
import { appendFileSync } from 'node:fs'

export type Audit = { title: string; note?: string; sql: string }

// "Live" here is `isExpired = false`; the public site also applies a freshness window and quality gates (buildWhere), so
// these counts are an upper bound on what visitors see.
const LIVE = `"isExpired" = false`
const REMOTE = `(remote = true OR "remoteMode" = 'remote')`

export const AUDITS: Audit[] = [
  {
    title: 'Live jobs',
    sql: `SELECT count(*) AS live,
      count(*) FILTER (WHERE "salaryValidated") AS salary_validated,
      count(*) FILTER (WHERE "postedAt" IS NOT NULL) AS has_posted_at,
      count(*) FILTER (WHERE "createdAt" > now() - interval '7 days') AS created_last_7d,
      count(*) FILTER (WHERE "createdAt" BETWEEN now() - interval '14 days' AND now() - interval '7 days') AS created_prev_7d,
      max("lastSeenAt") AS newest_last_seen
    FROM "Job" WHERE ${LIVE}`,
  },
  {
    title: 'Company profile completeness',
    sql: `SELECT count(*) AS companies,
      count("employeeCount") AS has_employee_count, count("fundingStage") AS has_funding_stage,
      count(headquarters) AS has_headquarters, count(industry) AS has_industry, count("logoUrl") AS has_logo,
      count(description) AS has_description, count(website) AS has_website, count("foundedYear") AS has_founded_year
    FROM "Company"`,
  },
  {
    title: 'Currency of live six-figure jobs',
    sql: `SELECT coalesce(currency, '(none)') AS currency, count(*) AS jobs
    FROM "Job" WHERE ${LIVE} AND "isHighSalary" GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
  },
  {
    title: 'Remote jobs: is a country stored?',
    note: 'Live remote jobs (remote flag or remoteMode = remote).',
    sql: `SELECT count(*) AS remote_jobs,
      count(*) FILTER (WHERE "countryCode" IS NOT NULL) AS with_country,
      count(*) FILTER (WHERE "countryCode" IS NULL) AS without_country
    FROM "Job" WHERE ${LIVE} AND ${REMOTE}`,
  },
  {
    title: 'Remote jobs without a country: what the location text says',
    note: 'The buckets can overlap; "worldwide words" is looser than the site\'s own check (it ignores limiting words such as "US").',
    sql: `SELECT
      count(*) AS without_country,
      count(*) FILTER (WHERE "locationRaw" ~* '(worldwide|anywhere|global)') AS worldwide_words,
      count(*) FILTER (WHERE "locationRaw" ~* '\\meurope') AS mentions_europe,
      count(*) FILTER (WHERE "locationRaw" ~* '\\memea\\M') AS mentions_emea,
      count(*) FILTER (WHERE "locationRaw" ~* '(\\mapac\\M|asia[ -]?pacific)') AS mentions_apac,
      count(*) FILTER (WHERE "locationRaw" ~* '\\mmiddle[ -]east') AS mentions_middle_east,
      count(*) FILTER (WHERE lower(btrim("locationRaw")) = 'remote') AS just_remote,
      count(*) FILTER (WHERE "locationRaw" IS NULL OR btrim("locationRaw") = '') AS no_text
    FROM "Job" WHERE ${LIVE} AND ${REMOTE} AND "countryCode" IS NULL`,
  },
  {
    title: 'Remote jobs without a country: most common location texts',
    sql: `SELECT coalesce(btrim("locationRaw"), '(none)') AS location_text, count(*) AS jobs
    FROM "Job" WHERE ${LIVE} AND ${REMOTE} AND "countryCode" IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 25`,
  },
  {
    title: 'Remote jobs with a country: top countries',
    sql: `SELECT "countryCode" AS country, count(*) AS jobs
    FROM "Job" WHERE ${LIVE} AND ${REMOTE} AND "countryCode" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
  },
  {
    title: 'Stored remoteRegion values on live remote jobs',
    note: 'Ingest writes "Global" when a source gives none, so "Global" is not evidence that a job is worldwide.',
    sql: `SELECT coalesce("remoteRegion", '(none)') AS remote_region, count(*) AS jobs
    FROM "Job" WHERE ${LIVE} AND ${REMOTE} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
  },
  {
    title: 'Real expiry dates from sources',
    note: 'expiresAt is only set when the source gave an expiry; the page publishes validThrough from it and nothing else.',
    sql: `SELECT source, count(*) AS live_jobs, count("expiresAt") AS with_expires_at, count("validThrough") AS with_valid_through
    FROM "Job" WHERE ${LIVE} GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
  },
]

type Row = Record<string, unknown>

function cell(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value === null || value === undefined) return ''
  return String(value).replace(/\|/g, '\\|').replace(/\s+/g, ' ')
}

/** A Markdown table for one result (pure). */
export function toMarkdown(audit: Audit, rows: Row[]): string {
  const out = [`### ${audit.title}`, '']
  if (audit.note) out.push(`_${audit.note}_`, '')
  if (rows.length === 0) return [...out, '(no rows)', ''].join('\n')
  const cols = Object.keys(rows[0])
  out.push(`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`)
  for (const row of rows) out.push(`| ${cols.map((c) => cell(row[c])).join(' | ')} |`)
  return [...out, ''].join('\n')
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const parts: string[] = [`## Database coverage audit`, '', `Run at ${new Date().toISOString()}. Read-only.`, '']
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY') // must be the first statement in the transaction
        for (const audit of AUDITS) {
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
