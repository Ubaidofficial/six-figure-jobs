import { format as __format } from 'node:util'
import { readFileSync, existsSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

function shouldWrite(): boolean {
  return process.argv.includes('--write')
}

function ageDaysFlag(name: string, fallback: number): number {
  const raw = process.env[name]
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.floor(parsed)
}

function readDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim()
  if (fromEnv) return stripWrappingQuotes(fromEnv)

  const envFiles = ['.env.local', '.env']
  for (const file of envFiles) {
    if (!existsSync(file)) continue
    const line = readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .find((value) => value.startsWith('DATABASE_URL='))
    if (!line) continue
    return stripWrappingQuotes(line.slice('DATABASE_URL='.length).trim())
  }

  throw new Error('DATABASE_URL not found in env or .env.local/.env')
}

function stripWrappingQuotes(value: string): string {
  let next = value.trim()
  if (next.startsWith('"') && next.endsWith('"')) next = next.slice(1, -1)
  if (next.startsWith("'") && next.endsWith("'")) next = next.slice(1, -1)
  return next
}

const invalidUrlPredicate = (column: string) => `
${column} IS NOT NULL
AND (
  btrim(${column}) = ''
  OR ${column} !~* '^https?://'
  OR ${column} ~ '\\\\s'
  OR ${column} ~* '^https?://(localhost|127\\\\.0\\\\.0\\\\.1|0\\\\.0\\\\.0\\\\.0)'
)`

async function fetchMetrics(prisma: PrismaClient) {
  const rows = await prisma.$queryRawUnsafe<Array<{ metric: string; n: number }>>(`
    SELECT metric, count(*)::int AS n
    FROM (
      SELECT 'job_url_invalid' AS metric FROM "Job" WHERE ${invalidUrlPredicate('"url"')}
      UNION ALL
      SELECT 'job_apply_invalid' AS metric FROM "Job" WHERE ${invalidUrlPredicate('"applyUrl"')}
      UNION ALL
      SELECT 'company_website_invalid' AS metric FROM "Company" WHERE ${invalidUrlPredicate('website')}
      UNION ALL
      SELECT 'company_ats_invalid' AS metric FROM "Company" WHERE ${invalidUrlPredicate('"atsUrl"')}
      UNION ALL
      SELECT 'companysource_invalid' AS metric FROM "CompanySource" WHERE ${invalidUrlPredicate('url')}
    ) t
    GROUP BY metric
    ORDER BY metric
  `)

  const map = new Map(rows.map((row) => [row.metric, Number(row.n) || 0]))
  return {
    jobUrlInvalid: map.get('job_url_invalid') || 0,
    jobApplyInvalid: map.get('job_apply_invalid') || 0,
    companyWebsiteInvalid: map.get('company_website_invalid') || 0,
    companyAtsInvalid: map.get('company_ats_invalid') || 0,
    companySourceInvalid: map.get('companysource_invalid') || 0,
  }
}

async function runWrite(prisma: PrismaClient) {
  const updates = await prisma.$transaction([
    prisma.$executeRawUnsafe(`
      UPDATE "Job"
      SET "url" = NULL
      WHERE ${invalidUrlPredicate('"url"')}
    `),
    prisma.$executeRawUnsafe(`
      UPDATE "Job"
      SET "applyUrl" = NULL
      WHERE ${invalidUrlPredicate('"applyUrl"')}
    `),
    prisma.$executeRawUnsafe(`
      UPDATE "Company"
      SET website = NULL
      WHERE ${invalidUrlPredicate('website')}
    `),
    prisma.$executeRawUnsafe(`
      UPDATE "Company"
      SET "atsProvider" = NULL,
          "atsUrl" = NULL,
          "atsSlug" = NULL,
          "scrapeStatus" = 'error',
          "scrapeError" = 'Auto-cleanup: invalid ATS URL'
      WHERE ${invalidUrlPredicate('"atsUrl"')}
    `),
    prisma.$executeRawUnsafe(`
      UPDATE "CompanySource"
      SET "isActive" = false,
          "scrapeStatus" = 'error',
          "scrapeError" = 'Auto-cleanup: invalid source URL'
      WHERE ${invalidUrlPredicate('url')}
    `),
  ])

  return {
    jobsUrlCleared: Number(updates[0] || 0),
    jobsApplyCleared: Number(updates[1] || 0),
    companyWebsiteCleared: Number(updates[2] || 0),
    companyAtsCleared: Number(updates[3] || 0),
    companySourceDisabled: Number(updates[4] || 0),
  }
}

async function fetchStaleErrorMetrics(
  prisma: PrismaClient,
  atsCutoffDays: number,
  genericCutoffDays: number,
) {
  const rows = await prisma.$queryRawUnsafe<Array<{ metric: string; n: number }>>(`
    SELECT metric, count(*)::int AS n
    FROM (
      SELECT 'ats_stale_404' AS metric
      FROM "Company"
      WHERE "atsUrl" IS NOT NULL
        AND "lastScrapedAt" < now() - interval '${atsCutoffDays} days'
        AND (
          coalesce("scrapeError",'') ~* 'HTTP 404'
          OR coalesce("scrapeError",'') ~* 'HTTP 410'
          OR coalesce("scrapeError",'') ~* '\\mnot found\\M'
        )
      UNION ALL
      SELECT 'ats_stale_400_workday_bamboohr' AS metric
      FROM "Company"
      WHERE "atsUrl" IS NOT NULL
        AND "atsProvider" IN ('workday', 'bamboohr')
        AND "lastScrapedAt" < now() - interval '${atsCutoffDays} days'
        AND coalesce("scrapeError",'') ~* 'HTTP 400'
      UNION ALL
      SELECT 'generic_source_stale_network_error' AS metric
      FROM "CompanySource"
      WHERE "sourceType" = 'generic_careers_page'
        AND "isActive" = true
        AND "lastScrapedAt" IS NOT NULL
        AND "lastScrapedAt" < now() - interval '${genericCutoffDays} days'
        AND (
          coalesce("scrapeError",'') ~* 'ERR_NAME_NOT_RESOLVED'
          OR coalesce("scrapeError",'') ~* 'ERR_CERT_'
          OR coalesce("scrapeError",'') ~* 'ERR_CONNECTION_'
          OR coalesce("scrapeError",'') ~* 'ERR_TIMED_OUT'
          OR coalesce("scrapeError",'') ~* 'ERR_SSL_'
          OR coalesce("scrapeError",'') ~* 'Execution context was destroyed'
          OR coalesce("scrapeError",'') ~* 'TimeoutError'
        )
    ) t
    GROUP BY metric
    ORDER BY metric
  `)

  const map = new Map(rows.map((row) => [row.metric, Number(row.n) || 0]))
  return {
    atsStale404: map.get('ats_stale_404') || 0,
    atsStale400WorkdayBamboohr: map.get('ats_stale_400_workday_bamboohr') || 0,
    genericSourceStaleNetworkError: map.get('generic_source_stale_network_error') || 0,
  }
}

async function runStaleSourceCleanup(
  prisma: PrismaClient,
  atsCutoffDays: number,
  genericCutoffDays: number,
) {
  const updates = await prisma.$transaction([
    prisma.$executeRawUnsafe(`
      UPDATE "Company"
      SET "atsProvider" = NULL,
          "atsUrl" = NULL,
          "atsSlug" = NULL,
          "scrapeStatus" = 'error',
          "scrapeError" = 'Auto-cleanup: stale ATS endpoint with repeated 404/410/not-found'
      WHERE "atsUrl" IS NOT NULL
        AND "lastScrapedAt" < now() - interval '${atsCutoffDays} days'
        AND (
          coalesce("scrapeError",'') ~* 'HTTP 404'
          OR coalesce("scrapeError",'') ~* 'HTTP 410'
          OR coalesce("scrapeError",'') ~* '\\mnot found\\M'
        )
    `),
    prisma.$executeRawUnsafe(`
      UPDATE "Company"
      SET "atsProvider" = NULL,
          "atsUrl" = NULL,
          "atsSlug" = NULL,
          "scrapeStatus" = 'error',
          "scrapeError" = 'Auto-cleanup: stale ATS endpoint with repeated HTTP 400 (workday/bamboohr)'
      WHERE "atsUrl" IS NOT NULL
        AND "atsProvider" IN ('workday', 'bamboohr')
        AND "lastScrapedAt" < now() - interval '${atsCutoffDays} days'
        AND coalesce("scrapeError",'') ~* 'HTTP 400'
    `),
    prisma.$executeRawUnsafe(`
      UPDATE "CompanySource"
      SET "isActive" = false,
          "scrapeStatus" = 'error',
          "scrapeError" = 'Auto-cleanup: stale generic careers source with persistent network errors'
      WHERE "sourceType" = 'generic_careers_page'
        AND "isActive" = true
        AND "lastScrapedAt" IS NOT NULL
        AND "lastScrapedAt" < now() - interval '${genericCutoffDays} days'
        AND (
          coalesce("scrapeError",'') ~* 'ERR_NAME_NOT_RESOLVED'
          OR coalesce("scrapeError",'') ~* 'ERR_CERT_'
          OR coalesce("scrapeError",'') ~* 'ERR_CONNECTION_'
          OR coalesce("scrapeError",'') ~* 'ERR_TIMED_OUT'
          OR coalesce("scrapeError",'') ~* 'ERR_SSL_'
          OR coalesce("scrapeError",'') ~* 'Execution context was destroyed'
          OR coalesce("scrapeError",'') ~* 'TimeoutError'
        )
    `),
  ])

  return {
    atsCleared404: Number(updates[0] || 0),
    atsCleared400WorkdayBamboohr: Number(updates[1] || 0),
    genericSourcesDisabled: Number(updates[2] || 0),
  }
}

async function main() {
  const write = shouldWrite()
  const atsCutoffDays = ageDaysFlag('CLEANUP_ATS_CUTOFF_DAYS', 7)
  const genericCutoffDays = ageDaysFlag('CLEANUP_GENERIC_CUTOFF_DAYS', 7)
  const dbUrl = readDatabaseUrl()
  const prisma = new PrismaClient({
    datasources: {
      db: { url: dbUrl },
    },
  })

  try {
    __slog('=== Cleanup Bad URLs ===')
    __slog(`mode=${write ? 'write' : 'dry-run'}`)
    __slog(`atsCutoffDays=${atsCutoffDays}`)
    __slog(`genericCutoffDays=${genericCutoffDays}`)

    const before = await fetchMetrics(prisma)
    __slog('before=' + JSON.stringify(before))
    const staleBefore = await fetchStaleErrorMetrics(prisma, atsCutoffDays, genericCutoffDays)
    __slog('stale_before=' + JSON.stringify(staleBefore))

    if (!write) return

    const changed = await runWrite(prisma)
    __slog('changed=' + JSON.stringify(changed))
    const staleChanged = await runStaleSourceCleanup(prisma, atsCutoffDays, genericCutoffDays)
    __slog('stale_changed=' + JSON.stringify(staleChanged))

    const after = await fetchMetrics(prisma)
    __slog('after=' + JSON.stringify(after))
    const staleAfter = await fetchStaleErrorMetrics(prisma, atsCutoffDays, genericCutoffDays)
    __slog('stale_after=' + JSON.stringify(staleAfter))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  __serr('[cleanupBadUrls] error:', error)
  process.exit(1)
})
