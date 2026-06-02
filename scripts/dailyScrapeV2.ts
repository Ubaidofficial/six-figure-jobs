// scripts/dailyScrapeV2.ts
// -------------------------------------------------------------
// Comprehensive daily scraper – ATS + All Board Scrapers
//
// Run examples:
//
//   Full (boards + ATS):
//     npx tsx scripts/dailyScrapeV2.ts --mode=all
//
//   Boards only:
//     npx tsx scripts/dailyScrapeV2.ts --mode=boards
//
//   ATS only:
//     npx tsx scripts/dailyScrapeV2.ts --mode=ats
//
//   Fast (skip slower boards):
//     npx tsx scripts/dailyScrapeV2.ts --mode=boards --fast
// -------------------------------------------------------------

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import {
  buildWhere,
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
} from '../lib/jobs/queryJobs'
import { buildFreshJobWhere, MAX_INDEXABLE_JOB_AGE_DAYS } from '../lib/jobs/freshness'
import { buildIndexableJobStructureWhere } from '../lib/jobs/qualityGate'
import { buildJobSlug } from '../lib/jobs/jobSlug'
import { notifyUrls, hasIndexingCredentials } from '../lib/indexing/googleIndexingClient'
import { markVisaSponsorshipBatch } from '../lib/jobs/markVisaSponsorship'
import { BOARD_SCRAPERS, FAST_BOARD_SCRAPER_KEYS, type BoardScraperTask } from '../lib/scrapers/boardRegistry'

// ATS scrapers
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'
import { SUPPORTED_ATS_PROVIDERS, type AtsProvider } from '../lib/scrapers/ats/types'
import { upsertJobsForCompanyFromAts } from '../lib/jobs/ingestFromAts'
import { runExpiryCycle } from '../lib/jobs/expiry'
import { runCompanyDiscovery } from './discoverCompanies'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

type Mode = 'all' | 'boards' | 'ats'

type DailyScrapeStats = {
  jobsAdded: number
  failures: number
  failedSources: string[]
  sourceMetrics: SourceRunMetric[]
}

type SourceRunMetric = {
  key: string
  name: string
  status: 'success' | 'failed'
  elapsedMs: number
  created?: number
  updated?: number
  skipped?: number
  jobs?: number
  error?: string
}

interface CliOptions {
  mode: Mode
  fast: boolean
  concurrency: number
  atsConcurrency: number
  atsTimeoutMs: number
  dryRun: boolean
  maxAtsCompanies: number | null
  sourceFilter: string[] | null
}

const ATS_COMPANY_PAGE_SIZE = 500
const DEFAULT_ATS_TIMEOUT_MS = 90_000
const MAX_ATS_TIMEOUT_MS = 10 * 60 * 1000

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)

  const getFlagValue = (name: string): string | null => {
    const exactIdx = args.indexOf(name)
    if (exactIdx !== -1) {
      return args[exactIdx + 1] ?? null
    }

    const withEquals = args.find((a) => a.startsWith(`${name}=`))
    if (withEquals) {
      return withEquals.slice(name.length + 1) || null
    }

    return null
  }

  const hasFlag = (name: string): boolean => {
    return args.includes(name)
  }

  const parsePositiveInt = (value: string | null, fallback: number, max: number): number => {
    if (!value) return fallback
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback
    return Math.min(Math.floor(parsed), max)
  }

  const modeArg = (getFlagValue('--mode') || 'all').toLowerCase()
  const mode: Mode =
    modeArg === 'boards' || modeArg === 'ats' ? (modeArg as Mode) : 'all'

  const fast = hasFlag('--fast')
  const dryRun = hasFlag('--dry-run')
  const concurrency = parsePositiveInt(getFlagValue('--concurrency'), 4, 8)
  const atsConcurrency = parsePositiveInt(getFlagValue('--ats-concurrency'), 5, 12)
  const atsTimeoutMs = parsePositiveInt(
    getFlagValue('--ats-timeout-ms') || process.env.ATS_SCRAPE_TIMEOUT_MS || null,
    DEFAULT_ATS_TIMEOUT_MS,
    MAX_ATS_TIMEOUT_MS,
  )

  const maxAtsCompaniesRaw = getFlagValue('--max-ats-companies')
  const maxAtsCompanies =
    maxAtsCompaniesRaw && Number(maxAtsCompaniesRaw) > 0
      ? Math.min(Math.floor(Number(maxAtsCompaniesRaw)), 5000)
      : null

  const sourceArg = (getFlagValue('--source') || '').trim().toLowerCase()
  const sourceFilter =
    sourceArg && sourceArg !== 'all'
      ? Array.from(
          new Set(
            sourceArg
              .split(',')
              .map((v) => v.trim().toLowerCase())
              .filter(Boolean),
          ),
        )
      : null

  return {
    mode,
    fast,
    concurrency,
    atsConcurrency,
    atsTimeoutMs,
    dryRun,
    maxAtsCompanies,
    sourceFilter,
  }
}

function elapsedSeconds(startTime: number): string {
  return ((Date.now() - startTime) / 1000).toFixed(1)
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeout: NodeJS.Timeout | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${label} timed out after ${formatDuration(timeoutMs)}`))
        }, timeoutMs)
        timeout.unref?.()
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function printSlowestSources(metrics: SourceRunMetric[], label: string) {
  if (!metrics.length) return

  const slowest = [...metrics]
    .sort((a, b) => b.elapsedMs - a.elapsedMs)
    .slice(0, 10)

  __slog(`${label} slowest sources:`)
  for (const metric of slowest) {
    const details = [
      metric.jobs != null ? `jobs=${metric.jobs}` : null,
      metric.created != null ? `created=${metric.created}` : null,
      metric.updated != null ? `updated=${metric.updated}` : null,
      metric.skipped != null ? `skipped=${metric.skipped}` : null,
      metric.error ? `error=${metric.error}` : null,
    ].filter(Boolean)

    __slog(
      `  ${metric.status === 'success' ? '✓' : '✗'} ${metric.name}: ${formatDuration(metric.elapsedMs)}${details.length ? ` (${details.join(', ')})` : ''}`,
    )
  }
  __slog('')
}

async function runBoardScrapers(options: CliOptions): Promise<DailyScrapeStats> {
  const { fast, dryRun, sourceFilter } = options

  __slog('🌐 Running BOARD scrapers…\n')

  let jobsAdded = 0
  let failures = 0
  const failedSources: string[] = []
  const sourceMetrics: SourceRunMetric[] = []

  // Ordered so we hit “core” boards first
  let scrapers = fast ? BOARD_SCRAPERS.filter((s) => FAST_BOARD_SCRAPER_KEYS.has(s.key)) : BOARD_SCRAPERS

  if (sourceFilter?.length) {
    const allowed = new Set(sourceFilter)
    scrapers = scrapers.filter((s) => allowed.has(s.key))
  }

  if (dryRun) {
    const blocked = scrapers.filter((s) => s.dryRunSafe === false).map((s) => s.name)
    if (blocked.length) {
      __slog(`⚠️ Dry run: skipping write-unsafe scrapers: ${blocked.join(', ')}`)
    }
    scrapers = scrapers.filter((s) => s.dryRunSafe !== false)
  }

  if (scrapers.length === 0) {
    __slog('⚠️ No board scrapers selected for this run.')
    return { jobsAdded: 0, failures: 0, failedSources: [], sourceMetrics: [] }
  }

  await runWithConcurrency(scrapers, options.concurrency, async ({ key, name, run }) => {
    __slog(`\n▶ Running ${name}…`)
    const startTime = Date.now()

    try {
      const result = (await run()) as any
      const elapsedMs = Date.now() - startTime

      const created = Number(result?.created ?? 0)
      const skipped = Number(result?.skipped ?? 0)
      const error = result?.error

      if (error) {
        failures++
        failedSources.push(name)
        sourceMetrics.push({
          key,
          name,
          status: 'failed',
          elapsedMs,
          created,
          skipped,
          error: String(error).slice(0, 300),
        })
        __slog(`   ❌ ${name} failed: ${error}`)
      } else {
        jobsAdded += created
        sourceMetrics.push({
          key,
          name,
          status: 'success',
          elapsedMs,
          created,
          skipped,
        })
        __slog(`   ✓ ${name}: ${created} created, ${skipped} skipped (${formatDuration(elapsedMs)})`)
      }
    } catch (err) {
      const elapsedMs = Date.now() - startTime
      failures++
      failedSources.push(name)
      sourceMetrics.push({
        key,
        name,
        status: 'failed',
        elapsedMs,
        error: getErrorMessage(err).slice(0, 300),
      })
      __serr(`   ❌ ${name} crashed:`, err)
      __slog(`   Time: ${elapsedSeconds(startTime)}s`)
    }
  })

  printSlowestSources(sourceMetrics, 'BOARD')

  return {
    jobsAdded,
    failures,
    failedSources: Array.from(new Set(failedSources)).sort(),
    sourceMetrics,
  }
}

async function loadAtsCompanies(options: CliOptions) {
  const companies: Array<{
    id: string
    name: string
    slug: string | null
    atsProvider: string | null
    atsUrl: string | null
  }> = []

  let cursor: string | undefined

  while (true) {
    const remaining = options.maxAtsCompanies
      ? options.maxAtsCompanies - companies.length
      : ATS_COMPANY_PAGE_SIZE

    if (remaining <= 0) break

    const page = await prisma.company.findMany({
      where: {
        atsProvider: { in: [...SUPPORTED_ATS_PROVIDERS] },
        atsUrl: { not: null },
      },
      orderBy: [
        { lastScrapedAt: 'asc' },
        { slug: 'asc' },
        { id: 'asc' },
      ],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: Math.min(ATS_COMPANY_PAGE_SIZE, remaining),
      select: {
        id: true,
        name: true,
        slug: true,
        atsProvider: true,
        atsUrl: true,
      },
    })

    companies.push(...page)

    if (page.length < Math.min(ATS_COMPANY_PAGE_SIZE, remaining)) break
    cursor = page[page.length - 1]?.id
    if (!cursor) break
  }

  return companies
}

async function loadUnsupportedAtsCompanySummary() {
  const rows = await prisma.company.groupBy({
    by: ['atsProvider'],
    where: {
      atsProvider: {
        not: null,
        notIn: [...SUPPORTED_ATS_PROVIDERS],
      },
      atsUrl: { not: null },
    },
    _count: {
      _all: true,
    },
    orderBy: {
      atsProvider: 'asc',
    },
  })

  return rows
    .filter((row): row is typeof row & { atsProvider: string } => typeof row.atsProvider === 'string')
    .map((row) => ({ provider: row.atsProvider, count: row._count._all }))
}

async function runAtsScrapers(options: CliOptions): Promise<DailyScrapeStats> {
  __slog('🏢 Running ATS scrapers…\n')

  const unsupportedSummary = await loadUnsupportedAtsCompanySummary()
  if (unsupportedSummary.length) {
    __slog(
      `   ⚠️ Skipping unsupported ATS providers in Company table: ${unsupportedSummary
        .map((row) => `${row.provider}=${row.count}`)
        .join(', ')}`,
    )
    __slog('')
  }

  const companies = await loadAtsCompanies(options)

  if (!companies.length) {
    __slog('   ⚠️  No companies with ATS metadata. Skipping ATS scrape.\n')
    return { jobsAdded: 0, failures: 0, failedSources: [], sourceMetrics: [] }
  }

  __slog(
    `   Selected ${companies.length} ATS companies, ordered by oldest scrape first (timeout ${formatDuration(options.atsTimeoutMs)} each).\n`,
  )

  let totalCreated = 0
  let totalUpdated = 0
  let totalSkipped = 0
  let totalErrors = 0
  const failedSources: string[] = []
  const failedCompanies: string[] = []
  const sourceMetrics: SourceRunMetric[] = []

  await runWithConcurrency(companies, options.atsConcurrency, async (company) => {
    const provider = company.atsProvider as AtsProvider
    const slug = company.slug ?? company.id
    const metricKey = `ats:${provider}:${slug}`

    __slog(`▶ ${slug} (${provider})…`)
    const startTime = Date.now()

    try {
      const result = await withTimeout(
        scrapeCompanyAtsJobs(provider, company.atsUrl!),
        options.atsTimeoutMs,
        `${slug} (${provider})`,
      )
      const scrapeElapsedMs = Date.now() - startTime

      if (!result.success) {
        totalErrors++
        failedSources.push(provider)
        failedCompanies.push(slug)
        sourceMetrics.push({
          key: metricKey,
          name: `${slug} (${provider})`,
          status: 'failed',
          elapsedMs: scrapeElapsedMs,
          error: result.error.slice(0, 300),
        })

        __serr(`   ❌ [ATS FAILURE] ${slug} (${provider}): ${result.error}`)
        __serr('')

        if (!options.dryRun) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              scrapeStatus: 'failed',
              scrapeError: String(result.error).slice(0, 500),
            },
          })
        }
        return
      }

      const jobs = result.jobs
      const stats = await upsertJobsForCompanyFromAts(company, jobs)
      const elapsedMs = Date.now() - startTime

      totalCreated += stats.created
      totalUpdated += stats.updated
      totalSkipped += stats.skipped
      sourceMetrics.push({
        key: metricKey,
        name: `${slug} (${provider})`,
        status: 'success',
        elapsedMs,
        jobs: jobs.length,
        created: stats.created,
        updated: stats.updated,
        skipped: stats.skipped,
      })

      if (!options.dryRun) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            lastScrapedAt: new Date(),
            jobCount: jobs.length,
            scrapeStatus: 'success',
            scrapeError: null,
          },
        })
      }

      __slog(
        `   ✅ ${slug}: jobs=${jobs.length} created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} (${formatDuration(elapsedMs)})`,
      )
      __slog('')
    } catch (err: any) {
      const elapsedMs = Date.now() - startTime
      totalErrors++
      const message = getErrorMessage(err)
      __serr(`   ❌ ${slug} failed:`, message)
      __serr('')
      failedSources.push(provider)
      failedCompanies.push(slug)
      sourceMetrics.push({
        key: metricKey,
        name: `${slug} (${provider})`,
        status: 'failed',
        elapsedMs,
        error: message.slice(0, 300),
      })

      if (!options.dryRun) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            scrapeStatus: 'failed',
            scrapeError: message.slice(0, 500),
          },
        })
      }
    }
  })

  __slog('ATS scrape totals:')
  __slog(`  Created: ${totalCreated}`)
  __slog(`  Updated: ${totalUpdated}`)
  __slog(`  Skipped: ${totalSkipped}`)
  __slog(`  Errors : ${totalErrors}\n`)
  printSlowestSources(sourceMetrics, 'ATS')

  if (failedCompanies.length) {
    const uniqProviders = Array.from(new Set(failedSources)).sort()
    const uniqCompanies = Array.from(new Set(failedCompanies)).sort()
    __slog(`  Failed providers: ${uniqProviders.join(', ')}`)
    __slog(`  Failed companies: ${uniqCompanies.slice(0, 50).join(', ')}${uniqCompanies.length > 50 ? '…' : ''}`)
    __slog('')
  }

  return {
    jobsAdded: totalCreated,
    failures: totalErrors,
    failedSources: Array.from(new Set(failedSources)).sort(),
    sourceMetrics,
  }
}

async function printJobSummary() {
  const browseEligibleWhere = buildWhere({})
  const detailSitemapWhere = {
    isExpired: false,
    AND: [
      buildGlobalExclusionsWhere(),
      buildHighSalaryEligibilityWhere(),
      buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS),
      buildIndexableJobStructureWhere(),
    ],
  } as const

  const [
    totalJobs,
    activeJobs,
    rawJobs100k,
    rawJobs200k,
    rawJobs300k,
    rawJobs400k,
    browseEligibleJobs,
    detailSitemapEligibleJobs,
    newestActive,
  ] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { isExpired: false } }),
    prisma.job.count({ where: { minAnnual: { gte: 100_000 } } }),
    prisma.job.count({ where: { minAnnual: { gte: 200_000 } } }),
    prisma.job.count({ where: { minAnnual: { gte: 300_000 } } }),
    prisma.job.count({ where: { minAnnual: { gte: 400_000 } } }),
    prisma.job.count({ where: browseEligibleWhere }),
    prisma.job.count({ where: detailSitemapWhere }),
    prisma.job.aggregate({
      where: { isExpired: false },
      _max: { lastSeenAt: true },
    }),
  ])

  __slog('\n📊 Job Totals (raw DB)')
  __slog('----------------------')
  __slog(`Total jobs in DB               : ${totalJobs}`)
  __slog(`Active jobs                    : ${activeJobs}`)
  __slog(`Jobs ≥ $100k (raw minAnnual)   : ${rawJobs100k}`)
  __slog(`Jobs ≥ $200k (raw minAnnual)   : ${rawJobs200k}`)
  __slog(`Jobs ≥ $300k (raw minAnnual)   : ${rawJobs300k}`)
  __slog(`Jobs ≥ $400k (raw minAnnual)   : ${rawJobs400k}`)

  __slog('\n🧭 pSEO Eligibility')
  __slog('-------------------')
  __slog(`Browse-eligible jobs           : ${browseEligibleJobs}`)
  __slog(`Job-sitemap-eligible jobs      : ${detailSitemapEligibleJobs}`)
  __slog(
    `Newest active lastSeenAt       : ${newestActive._max.lastSeenAt?.toISOString() ?? 'none'}`,
  )
  __slog('')
}

async function notifyGoogleOfNewJobs(since: Date, dryRun: boolean) {
  if (dryRun) return
  if (!hasIndexingCredentials()) {
    __slog('ℹ️  Skipping Google Indexing API — no credentials configured.')
    return
  }

  const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.6figjobs.com').replace(/\/+$/, '')

  try {
    const newJobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: since },
        isExpired: false,
      },
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    if (newJobs.length === 0) {
      __slog('ℹ️  No new jobs to notify Google about.')
      return
    }

    const urls = newJobs.map((j) => `${siteUrl}/job/${buildJobSlug({ id: j.id, title: j.title })}`)
    __slog(`\n📡 Notifying Google Indexing API for ${urls.length} new job(s)…`)

    const results = await notifyUrls(urls, { concurrency: 4 })
    const succeeded = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    __slog(`   ✅ Google Indexing API: submitted=${succeeded} failed=${failed}`)
    if (failed > 0) {
      results.filter((r) => !r.success).slice(0, 5).forEach((r) =>
        __serr(`   ❌ ${r.url}: ${r.error}`)
      )
    }
  } catch (err) {
    __serr('⚠️  Google Indexing API notification failed (non-fatal):', getErrorMessage(err))
  }
}

async function main() {
  const options = parseCliArgs()
  const scrapeStartedAt = new Date()

  if (options.dryRun) {
    process.env.SCRAPE_DRY_RUN = '1'
    process.env.DRY_RUN = '1'
  }

  const stats: DailyScrapeStats = {
    jobsAdded: 0,
    failures: 0,
    failedSources: [],
    sourceMetrics: [],
  }

  __slog('===========================================')
  __slog('  SixFigureJobs – Daily Scraper v2')
  __slog('===========================================')
  __slog(`Mode : ${options.mode}`)
  __slog(`Fast : ${options.fast ? 'YES (skip slow boards)' : 'no'}`)
  __slog(`Dry run : ${options.dryRun ? 'YES (no DB writes)' : 'no'}`)
  __slog(`Board concurrency : ${options.concurrency}`)
  __slog(`ATS concurrency : ${options.atsConcurrency}`)
  __slog(`ATS timeout : ${formatDuration(options.atsTimeoutMs)}`)
  __slog(`Max ATS companies : ${options.maxAtsCompanies ?? 'all'}`)
  __slog(`Source filter : ${options.sourceFilter?.join(', ') || 'all'}`)
  __slog('')

  if (options.mode === 'boards' || options.mode === 'all') {
    const boardStats = await runBoardScrapers(options)
    stats.jobsAdded += boardStats.jobsAdded
    stats.failures += boardStats.failures
    stats.failedSources.push(...boardStats.failedSources)
    stats.sourceMetrics.push(...boardStats.sourceMetrics)
  }

  if (options.mode === 'ats' || options.mode === 'all') {
    const atsStats = await runAtsScrapers(options)
    stats.jobsAdded += atsStats.jobsAdded
    stats.failures += atsStats.failures
    stats.failedSources.push(...atsStats.failedSources)
    stats.sourceMetrics.push(...atsStats.sourceMetrics)
  }

  await printJobSummary()
  await notifyGoogleOfNewJobs(scrapeStartedAt, options.dryRun)

  // Expire stale jobs (not seen/updated in 7+ days)
  let jobsExpired = 0
  try {
    const expiryResult = await runExpiryCycle()
    jobsExpired = expiryResult.expired
    __slog(`🗑  Expiry cycle: ${expiryResult.expired} jobs marked expired`)
  } catch (err) {
    __serr('⚠️  Expiry cycle failed:', err)
  }

  // Mark visa sponsorship on jobs whose descriptions contain H1B keywords
  try {
    const visaResult = await markVisaSponsorshipBatch({ batchSize: 500, dryRun: options.dryRun })
    __slog(`🛂  Visa sponsorship: marked ${visaResult.marked} jobs (checked ${visaResult.checked})`)
  } catch (err) {
    __serr('⚠️  Visa sponsorship marking failed:', err)
  }

  // Weekly company discovery: run on Sundays (or when FORCE_DISCOVER=1)
  const isSunday = new Date().getDay() === 0
  const forceDiscover = process.env.FORCE_DISCOVER === '1'
  if ((isSunday || forceDiscover) && options.mode !== 'boards') {
    __slog('🔍 Running weekly company discovery (YC + ATS)...')
    try {
      await runCompanyDiscovery()
      __slog('✅ Company discovery complete')
    } catch (err) {
      __serr('⚠️  Company discovery failed:', err)
    }
  }

  __slog('✅ Finished daily scrape run.')
  const slowSources = [...stats.sourceMetrics]
    .sort((a, b) => b.elapsedMs - a.elapsedMs)
    .slice(0, 10)
    .map((metric) => ({
      key: metric.key,
      name: metric.name,
      status: metric.status,
      elapsedMs: metric.elapsedMs,
      jobs: metric.jobs,
      created: metric.created,
      updated: metric.updated,
      skipped: metric.skipped,
      error: metric.error,
    }))

  const runtimeMs = Date.now() - scrapeStartedAt.getTime()
  
  const jobsUpdated = stats.sourceMetrics.reduce((acc, curr) => acc + (curr.updated || 0), 0)
  const skippedByGate = stats.sourceMetrics.reduce((acc, curr) => acc + (curr.skipped || 0), 0)

  const summary = {
    jobsAdded: stats.jobsAdded,
    jobsUpdated,
    jobsExpired,
    skippedByGate,
    failures: stats.failures,
    runtime: runtimeMs,
    failedSources: Array.from(new Set(stats.failedSources)).sort(),
    slowSources,
  }

  __slog(`__SCRAPE_STATS__ ${JSON.stringify(summary)}`)
  require('node:fs').writeFileSync('scrape-summary.json', JSON.stringify(summary, null, 2))
}

main()
  .catch((err) => {
    __serr('💥 Fatal error in dailyScrapeV2.ts')
    __serr(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

// Simple concurrency limiter for arrays of tasks
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
) {
  const queue = [...items]
  const runners: Promise<void>[] = []

  const runNext = async () => {
    const item = queue.shift()
    if (!item) return
    try {
      await task(item)
    } catch (err) {
      __serr(err)
    }
    await runNext()
  }

  for (let i = 0; i < Math.min(limit, items.length); i++) {
    runners.push(runNext())
  }

  await Promise.all(runners)
}
