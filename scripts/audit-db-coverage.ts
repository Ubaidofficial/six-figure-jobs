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
      count(description) AS has_description, count(website) AS has_website, count("foundedYear") AS has_founded_year,
      count("sizeBucket") AS has_size_bucket, count("tagsJson") AS has_tags, count("linkedinUrl") AS has_linkedin,
      count("countryCode") AS has_country, count("atsProvider") AS has_ats_provider, count("fundingSummary") AS has_funding_summary
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
    title: 'Remote jobs without a country: country words in the text',
    note: 'Rough word matches (a job can be in several buckets): how many name the US and Canada together, one of them, the UK, or a continent.',
    sql: `SELECT
      count(*) FILTER (WHERE "locationRaw" ~* '(united states|u\\.s\\.?|\\musa?\\M)' AND "locationRaw" ~* 'canada') AS us_and_canada,
      count(*) FILTER (WHERE "locationRaw" ~* '(united states|u\\.s\\.?|\\musa?\\M)' AND "locationRaw" !~* 'canada') AS us_not_canada,
      count(*) FILTER (WHERE "locationRaw" ~* 'canada' AND "locationRaw" !~* '(united states|u\\.s\\.?|\\musa?\\M)') AS canada_not_us,
      count(*) FILTER (WHERE "locationRaw" ~* '(united kingdom|\\muk\\M|britain)') AS mentions_uk,
      count(*) FILTER (WHERE "locationRaw" ~* 'north america') AS north_america,
      count(*) FILTER (WHERE "locationRaw" ~* 'americas') AS americas,
      count(*) FILTER (WHERE "locationRaw" ~* 'latam|latin america') AS latam
    FROM "Job" WHERE ${LIVE} AND ${REMOTE} AND "countryCode" IS NULL`,
  },
  {
    title: 'Remote jobs with a stored country whose text says worldwide',
    note: 'The page lists the stored country for these, not every country. If it is mostly the company\'s country, the stored value may be a guess.',
    sql: `SELECT btrim("locationRaw") AS location_text, "countryCode" AS stored_country, count(*) AS jobs
    FROM "Job" WHERE ${LIVE} AND ${REMOTE} AND "countryCode" IS NOT NULL AND "locationRaw" ~* '(worldwide|anywhere|global)'
    GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 15`,
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
    title: 'Remote jobs by source: is a country stored?',
    note: 'Which sources leave remote jobs without a country, and how many of those say just "Remote".',
    sql: `SELECT source, count(*) AS remote_jobs,
      count(*) FILTER (WHERE "countryCode" IS NOT NULL) AS with_country,
      count(*) FILTER (WHERE "countryCode" IS NULL) AS without_country,
      count(*) FILTER (WHERE "countryCode" IS NULL AND lower(btrim("locationRaw")) = 'remote') AS just_remote_no_country
    FROM "Job" WHERE ${LIVE} AND ${REMOTE} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
  },
  {
    title: 'Remote jobs whose description says worldwide',
    note: 'Phrases in the description, not the location field. "worldwide" alone is noisy (it can describe customers); the anywhere phrases are the stronger signal.',
    sql: `SELECT count(*) AS remote_jobs,
      count(*) FILTER (WHERE "descriptionHtml" ~* '(work from anywhere|anywhere in the world|work remotely from anywhere|globally distributed)') AS anywhere_phrases,
      count(*) FILTER (WHERE "descriptionHtml" ~* 'worldwide') AS says_worldwide,
      count(*) FILTER (WHERE "countryCode" IS NULL AND "descriptionHtml" ~* '(work from anywhere|anywhere in the world|work remotely from anywhere|globally distributed)') AS anywhere_phrases_no_country
    FROM "Job" WHERE ${LIVE} AND ${REMOTE}`,
  },
  {
    title: 'AI enrichment and description length by source',
    note: 'How many live jobs already carry AI fields (aiEnrichedAt, summary, snippet, one-liner) and how long their descriptions are.',
    sql: `SELECT source, count(*) AS live_jobs, count("aiEnrichedAt") AS ai_enriched, count("aiSummaryJson") AS has_ai_summary,
      count("aiSnippet") AS has_ai_snippet, count("aiOneLiner") AS has_one_liner,
      coalesce(round(avg(length("descriptionHtml")))::int, 0) AS avg_description_chars,
      count(*) FILTER (WHERE "descriptionHtml" IS NULL OR length("descriptionHtml") < 400) AS short_or_missing_description
    FROM "Job" WHERE ${LIVE} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
  },
  {
    title: 'Live freehire jobs by currency',
    note: 'To set against freehire\'s own count for the same markets and window.',
    sql: `SELECT coalesce(currency, '(none)') AS currency, count(*) AS jobs
    FROM "Job" WHERE ${LIVE} AND source = 'board:freehire' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
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
