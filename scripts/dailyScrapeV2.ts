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

// Core board scrapers (default exports)
import scrapeRemoteOK from '../lib/scrapers/remoteok'
import scrapeWeWorkRemotely from '../lib/scrapers/weworkremotely'
import scrapeNodesk from '../lib/scrapers/nodesk'
import scrapeBuiltIn from '../lib/scrapers/builtin'
import scrapeRemoteRocketship from '../lib/scrapers/remoterocketship'
import scrapeRemoteAI from '../lib/scrapers/remoteai'
import scrapeRemoteYeah from '../lib/scrapers/remoteyeah'
import scrapeHimalayas from '../lib/scrapers/himalayas'
import scrapeRemoteLeaf from '../lib/scrapers/remoteleaf'
import scrapeRemote100k from '../lib/scrapers/remote100k'
import { discoverRemote100kCompanies } from '../lib/scrapers/remote100k-companies'

// New board scrapers (named exports)
import { scrapeRealWorkFromAnywhere } from '../lib/scrapers/realworkfromanywhere'
import { scrapeJustJoin } from '../lib/scrapers/justjoin'
import { scrapeRemoteOtter } from '../lib/scrapers/remoteotter'
import { scrapeTrawle } from '../lib/scrapers/trawle'
import { scrapeFourDayWeek } from '../lib/scrapers/fourdayweek'

// “API style” board scrapers / extra sources
import scrapeRemotive from '../lib/scrapers/remotive'
import scrapeYCombinator from '../lib/scrapers/ycombinator'
import scrapeDice from '../lib/scrapers/dice'
import scrapeWellfound from '../lib/scrapers/wellfound'
import scrapeOtta from '../lib/scrapers/otta'

// ATS scrapers
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'
import type { AtsProvider } from '../lib/scrapers/ats/types'
import { upsertJobsForCompanyFromAts } from '../lib/jobs/ingestFromAts'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

type Mode = 'all' | 'boards' | 'ats'

type DailyScrapeStats = {
  jobsAdded: number
  failures: number
  failedSources: string[]
}

type BoardScraperTask = {
  key: string
  name: string
  run: () => Promise<unknown>
  dryRunSafe?: boolean
}

interface CliOptions {
  mode: Mode
  fast: boolean
  concurrency: number
  atsConcurrency: number
  dryRun: boolean
  maxAtsCompanies: number | null
  sourceFilter: string[] | null
}

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
    dryRun,
    maxAtsCompanies,
    sourceFilter,
  }
}

async function runBoardScrapers(options: CliOptions): Promise<DailyScrapeStats> {
  const { fast, dryRun, sourceFilter } = options

  __slog('🌐 Running BOARD scrapers…\n')

  let jobsAdded = 0
  let failures = 0
  const failedSources: string[] = []

  // Ordered so we hit “core” boards first
  const allScrapers: BoardScraperTask[] = [
    { key: 'remoteok', name: 'RemoteOK', run: scrapeRemoteOK },
    { key: 'weworkremotely', name: 'WeWorkRemotely', run: scrapeWeWorkRemotely },
    { key: 'nodesk', name: 'NoDesk', run: scrapeNodesk },
    { key: 'builtin', name: 'BuiltIn', run: scrapeBuiltIn },
    { key: 'remote100k', name: 'Remote100k', run: scrapeRemote100k },
    { key: 'remote100k-companies', name: 'Remote100k-Companies', run: discoverRemote100kCompanies },
    { key: 'remoterocketship', name: 'RemoteRocketship', run: scrapeRemoteRocketship },
    { key: 'himalayas', name: 'Himalayas', run: scrapeHimalayas },
    { key: 'remoteleaf', name: 'RemoteLeaf', run: scrapeRemoteLeaf },
    { key: 'realworkfromanywhere', name: 'RealWorkFromAnywhere', run: scrapeRealWorkFromAnywhere },
    { key: 'justjoin', name: 'JustJoin', run: scrapeJustJoin },
    { key: 'remoteotter', name: 'RemoteOtter', run: scrapeRemoteOtter },
    { key: 'trawle', name: 'Trawle', run: scrapeTrawle },
    { key: 'fourdayweek', name: 'FourDayWeek', run: scrapeFourDayWeek },
    { key: 'remotive', name: 'Remotive', run: scrapeRemotive },
    { key: 'dice', name: 'Dice', run: scrapeDice },
    { key: 'wellfound', name: 'Wellfound', run: scrapeWellfound },
    { key: 'otta', name: 'Otta', run: scrapeOtta },
    { key: 'ycombinator', name: 'YCombinator', run: scrapeYCombinator },
    { key: 'remoteyeah', name: 'RemoteYeah', run: scrapeRemoteYeah, dryRunSafe: false },
    { key: 'remoteai', name: 'RemoteAI (companies only)', run: scrapeRemoteAI, dryRunSafe: false },
  ]

  const fastKeys = new Set([
    'remoteok',
    'weworkremotely',
    'remote100k-companies',
    'remoterocketship',
    'himalayas',
    'remoteleaf',
    'realworkfromanywhere',
    'justjoin',
    'fourdayweek',
    'remoteyeah',
    'remoteai',
  ])

  let scrapers = fast ? allScrapers.filter((s) => fastKeys.has(s.key)) : allScrapers

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
    return { jobsAdded: 0, failures: 0, failedSources: [] }
  }

  await runWithConcurrency(scrapers, options.concurrency, async ({ name, run }) => {
    __slog(`\n▶ Running ${name}…`)
    const startTime = Date.now()

    try {
      const result = (await run()) as any
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

      const created = Number(result?.created ?? 0)
      const skipped = Number(result?.skipped ?? 0)
      const error = result?.error

      if (error) {
        failures++
        failedSources.push(name)
        __slog(`   ❌ ${name} failed: ${error}`)
      } else {
        jobsAdded += created
        __slog(`   ✓ ${name}: ${created} created, ${skipped} skipped (${elapsed}s)`)
      }
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      failures++
      failedSources.push(name)
      __serr(`   ❌ ${name} crashed:`, err)
      __slog(`   Time: ${elapsed}s`)
    }
  })
  return {
    jobsAdded,
    failures,
    failedSources: Array.from(new Set(failedSources)).sort(),
  }
}

async function runAtsScrapers(options: CliOptions): Promise<DailyScrapeStats> {
  __slog('🏢 Running ATS scrapers…\n')

  let companies = await prisma.company.findMany({
    where: {
      atsProvider: { not: null },
      atsUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      atsProvider: true,
      atsUrl: true,
    },
  })

  if (options.maxAtsCompanies && companies.length > options.maxAtsCompanies) {
    companies = companies.slice(0, options.maxAtsCompanies)
  }

  if (!companies.length) {
    __slog('   ⚠️  No companies with ATS metadata. Skipping ATS scrape.\n')
    return { jobsAdded: 0, failures: 0, failedSources: [] }
  }

  let totalCreated = 0
  let totalUpdated = 0
  let totalSkipped = 0
  let totalErrors = 0
  const failedSources: string[] = []
  const failedCompanies: string[] = []

  await runWithConcurrency(companies, options.atsConcurrency, async (company) => {
    const provider = company.atsProvider as AtsProvider
    const slug = company.slug ?? company.id

    __slog(`▶ ${slug} (${provider})…`)
    try {
      const result = await scrapeCompanyAtsJobs(provider, company.atsUrl!)

      if (!result.success) {
        totalErrors++
        failedSources.push(provider)
        failedCompanies.push(slug)

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

      totalCreated += stats.created
      totalUpdated += stats.updated
      totalSkipped += stats.skipped

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
        `   ✅ ${slug}: jobs=${jobs.length} created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`,
      )
      __slog('')
    } catch (err: any) {
      totalErrors++
      const message = err?.message || String(err)
      __serr(`   ❌ ${slug} failed:`, message)
      __serr('')
      failedSources.push(provider)
      failedCompanies.push(slug)

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
  }
}

async function printJobSummary() {
  const totalJobs = await prisma.job.count()

  const jobs100k = await prisma.job.count({
    where: { minAnnual: { gte: 100_000 } },
  })
  const jobs200k = await prisma.job.count({
    where: { minAnnual: { gte: 200_000 } },
  })
  const jobs300k = await prisma.job.count({
    where: { minAnnual: { gte: 300_000 } },
  })
  const jobs400k = await prisma.job.count({
    where: { minAnnual: { gte: 400_000 } },
  })

  __slog('\n📊 Job Totals (for frontend parity)')
  __slog('------------------------------------')
  __slog(`Total jobs in DB          : ${totalJobs}`)
  __slog(`Jobs ≥ $100k (minAnnual)  : ${jobs100k}`)
  __slog(`Jobs ≥ $200k              : ${jobs200k}`)
  __slog(`Jobs ≥ $300k              : ${jobs300k}`)
  __slog(`Jobs ≥ $400k              : ${jobs400k}\n`)
}

async function main() {
  const options = parseCliArgs()
  if (options.dryRun) {
    process.env.SCRAPE_DRY_RUN = '1'
    process.env.DRY_RUN = '1'
  }

  const stats: DailyScrapeStats = { jobsAdded: 0, failures: 0, failedSources: [] }

  __slog('===========================================')
  __slog('  SixFigureJobs – Daily Scraper v2')
  __slog('===========================================')
  __slog(`Mode : ${options.mode}`)
  __slog(`Fast : ${options.fast ? 'YES (skip slow boards)' : 'no'}`)
  __slog(`Dry run : ${options.dryRun ? 'YES (no DB writes)' : 'no'}`)
  __slog(`Board concurrency : ${options.concurrency}`)
  __slog(`ATS concurrency : ${options.atsConcurrency}`)
  __slog(`Max ATS companies : ${options.maxAtsCompanies ?? 'all'}`)
  __slog(`Source filter : ${options.sourceFilter?.join(', ') || 'all'}`)
  __slog('')

  if (options.mode === 'boards' || options.mode === 'all') {
    const boardStats = await runBoardScrapers(options)
    stats.jobsAdded += boardStats.jobsAdded
    stats.failures += boardStats.failures
    stats.failedSources.push(...boardStats.failedSources)
  }

  if (options.mode === 'ats' || options.mode === 'all') {
    const atsStats = await runAtsScrapers(options)
    stats.jobsAdded += atsStats.jobsAdded
    stats.failures += atsStats.failures
    stats.failedSources.push(...atsStats.failedSources)
  }

  await printJobSummary()

  __slog('✅ Finished daily scrape run.')
  __slog(`__SCRAPE_STATS__ ${JSON.stringify({
    jobsAdded: stats.jobsAdded,
    failures: stats.failures,
    failedSources: Array.from(new Set(stats.failedSources)).sort(),
  })}`)
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
