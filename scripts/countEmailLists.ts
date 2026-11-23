// scripts/countEmailLists.ts
//
// Read-only counts of the email addresses the site stores: job alert signups (JobAlert) by status, and user accounts
// (User). Counts only: no address, name or token is printed, because workflow logs and summaries are kept by GitHub and
// readable by anyone with access to the repository. The list itself is on the admin page /ubaid93/alerts (and its CSV
// export). One transaction set to READ ONLY, so the database refuses a write even if one were added by mistake.
// Run from the "email list counts" workflow, or locally with DATABASE_URL.
//
//   npx tsx scripts/countEmailLists.ts
import { appendFileSync } from 'node:fs'

type Row = Record<string, unknown>

export const QUERIES: Array<{ title: string; sql: string }> = [
  {
    title: 'Job alert signups by status',
    sql: `SELECT status, count(*)::int AS alerts, count(DISTINCT lower(email))::int AS unique_emails,
      count("firstName")::int AS with_first_name
      FROM "JobAlert" GROUP BY status ORDER BY status`,
  },
  {
    title: 'Job alert signups, all statuses',
    sql: `SELECT count(*)::int AS alerts, count(DISTINCT lower(email))::int AS unique_emails,
      count(*) FILTER (WHERE "createdAt" >= now() - interval '7 days')::int AS new_7d,
      count(*) FILTER (WHERE "createdAt" >= now() - interval '30 days')::int AS new_30d,
      count(*) FILTER (WHERE "confirmedAt" IS NOT NULL)::int AS ever_confirmed,
      min("createdAt") AS first_signup, max("createdAt") AS last_signup
      FROM "JobAlert"`,
  },
  {
    title: 'Job alert signups by page signed up on (all time, top 15)',
    sql: `SELECT coalesce(source, '(none)') AS source, count(*)::int AS alerts
      FROM "JobAlert" GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
  },
  {
    title: 'User accounts',
    sql: `SELECT count(*)::int AS users, count(email)::int AS with_email,
      count("emailVerified")::int AS email_verified FROM "User"`,
  },
]

function cell(v: unknown): string {
  if (v === null || v === undefined) return '–'
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace('T', ' ')
  return String(v).replace(/\|/g, '\\|')
}

function toMarkdown(title: string, rows: Row[]): string {
  if (rows.length === 0) return `### ${title}\n\n(none)\n`
  const cols = Object.keys(rows[0])
  return [
    `### ${title}`,
    '',
    `| ${cols.join(' | ')} |`,
    `| ${cols.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${cols.map((c) => cell(r[c])).join(' | ')} |`),
    '',
  ].join('\n')
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const parts = ['## Email list counts', '', `Run at ${new Date().toISOString()}. Read-only; counts only, no addresses.`, '']
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY') // must be the first statement in the transaction
      for (const q of QUERIES) parts.push(toMarkdown(q.title, (await tx.$queryRawUnsafe(q.sql)) as Row[]))
    })
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
