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

import { PrismaClient } from '@prisma/client'

// Core board scrapers (default exports)
import scrapeRemoteOK from '../lib/scrapers/remoteok'
import scrapeWeWorkRemotely from '../lib/scrapers/weworkremotely'
import scrapeNodesk from '../lib/scrapers/nodesk'
import scrapeBuiltIn from '../lib/scrapers/builtin'
import scrapeRemote100k from '../lib/scrapers/remote100k'
import scrapeRemoteRocketship from '../lib/scrapers/remoterocketship'
import scrapeGenericSources from '../lib/scrapers/generic'
import scrapeRemoteAI from '../lib/scrapers/remoteai'

// New board scrapers (named exports)
import { scrapeRealWorkFromAnywhere } from '../lib/scrapers/realworkfromanywhere'
import { scrapeJustJoin } from '../lib/scrapers/justjoin'
import { scrapeRemoteOtter } from '../lib/scrapers/remoteotter'
import { scrapeTrawle } from '../lib/scrapers/trawle'
import { scrapeFourDayWeek } from '../lib/scrapers/fourdayweek'

// “API style” board scrapers / extra sources
import scrapeRemotive from '../lib/scrapers/remotive'
// YC disabled for now – endpoint returning 404s, will revisit later
// import scrapeYCombinator from '../lib/scrapers/ycombinator'

// ATS scrapers
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'
import type { AtsProvider } from '../lib/scrapers/ats/types'
import { upsertJobsForCompanyFromAts } from '../lib/jobs/ingestFromAts'

const prisma = new PrismaClient()

type Mode = 'all' | 'boards' | 'ats'

interface CliOptions {
  mode: Mode
  fast: boolean
  concurrency: number
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)

  const getFlagValue = (name: string): string | null => {
    const idx = args.indexOf(name)
    if (idx === -1) return null
    return args[idx + 1] ?? null
  }

  const modeArg = (getFlagValue('--mode') || 'all').toLowerCase()
  const mode: Mode =
    modeArg === 'boards' || modeArg === 'ats' ? (modeArg as Mode) : 'all'

  const fast = args.includes('--fast')
  const concurrencyFlag = args.find((a) => a.startsWith('--concurrency='))
  const parsedConcurrency = concurrencyFlag
    ? Number(concurrencyFlag.split('=')[1])
    : 4
  const concurrency = Number.isFinite(parsedConcurrency) && parsedConcurrency > 0
    ? Math.min(parsedConcurrency, 8)
    : 4

  return { mode, fast, concurrency }
}

async function runBoardScrapers(options: CliOptions) {
  const { fast } = options

  console.log('🌐 Running BOARD scrapers…\n')

  // Ordered so we hit “core” boards first
  const allScrapers: Array<[string, () => Promise<unknown>]> = [
    ['RemoteOK', scrapeRemoteOK],
    ['WeWorkRemotely', scrapeWeWorkRemotely],
    ['NoDesk', scrapeNodesk],
    ['BuiltIn', scrapeBuiltIn],
    ['Remote100k', scrapeRemote100k],
    ['RemoteRocketship', scrapeRemoteRocketship],
    ['RealWorkFromAnywhere', scrapeRealWorkFromAnywhere],
    ['JustJoin', scrapeJustJoin],
    ['RemoteOtter', scrapeRemoteOtter],
    ['Trawle', scrapeTrawle],
    ['FourDayWeek', scrapeFourDayWeek],
    ['Remotive', scrapeRemotive],
    ['RemoteAI (companies only)', scrapeRemoteAI],
    // ['YCombinator', scrapeYCombinator], // disabled for now
    ['GenericSources', scrapeGenericSources],
  ]

  // In fast mode, skip the slower / more experimental scrapers
  const scrapers = fast
    ? allScrapers.filter(([name]) =>
        [
          'RemoteOK',
          'WeWorkRemotely',
          'Remote100k',
          'RemoteRocketship',
          'RealWorkFromAnywhere',
          'JustJoin',
          'FourDayWeek',
        ].includes(name),
      )
    : allScrapers

  await runWithConcurrency(
    scrapers,
    options.concurrency,
    async ([name, fn]) => {
      console.log(`▶ ${name}…`)
      await fn()
      console.log(`   ✅ ${name} done.\n`)
    },
  )
}

async function runAtsScrapers() {
  console.log('🏢 Running ATS scrapers…\n')

  const companies = await prisma.company.findMany({
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

  if (!companies.length) {
    console.log('   ⚠️  No companies with ATS metadata. Skipping ATS scrape.\n')
    return
  }

  let totalCreated = 0
  let totalUpdated = 0
  let totalSkipped = 0
  let totalErrors = 0

  await runWithConcurrency(companies, 5, async (company) => {
    const provider = company.atsProvider as AtsProvider
    const slug = company.slug ?? company.id

    console.log(`▶ ${slug} (${provider})…`)
    try {
      const jobs = await scrapeCompanyAtsJobs(provider, company.atsUrl!)
      const stats = await upsertJobsForCompanyFromAts(company, jobs)

      totalCreated += stats.created
      totalUpdated += stats.updated
      totalSkipped += stats.skipped

      await prisma.company.update({
        where: { id: company.id },
        data: {
          lastScrapedAt: new Date(),
          jobCount: jobs.length,
          scrapeStatus: 'success',
          scrapeError: null,
        },
      })

      console.log(
        `   ✅ ${slug}: jobs=${jobs.length} created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`,
      )
      console.log('')
    } catch (err: any) {
      totalErrors++
      const message = err?.message || String(err)
      console.error(`   ❌ ${slug} failed:`, message)
      console.error('')

      await prisma.company.update({
        where: { id: company.id },
        data: {
          scrapeStatus: 'failed',
          scrapeError: message.slice(0, 500),
        },
      })
    }
  })

  console.log('ATS scrape totals:')
  console.log(`  Created: ${totalCreated}`)
  console.log(`  Updated: ${totalUpdated}`)
  console.log(`  Skipped: ${totalSkipped}`)
  console.log(`  Errors : ${totalErrors}\n`)
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

  console.log('\n📊 Job Totals (for frontend parity)')
  console.log('------------------------------------')
  console.log(`Total jobs in DB          : ${totalJobs}`)
  console.log(`Jobs ≥ $100k (minAnnual)  : ${jobs100k}`)
  console.log(`Jobs ≥ $200k              : ${jobs200k}`)
  console.log(`Jobs ≥ $300k              : ${jobs300k}`)
  console.log(`Jobs ≥ $400k              : ${jobs400k}\n`)
}

async function main() {
  const options = parseCliArgs()

  console.log('===========================================')
  console.log('  SixFigureJobs – Daily Scraper v2')
  console.log('===========================================')
  console.log(`Mode : ${options.mode}`)
  console.log(`Fast : ${options.fast ? 'YES (skip slow boards)' : 'no'}`)
  console.log(`Concurrency : ${options.concurrency}`)
  console.log('')

  if (options.mode === 'boards' || options.mode === 'all') {
    await runBoardScrapers(options)
  }

  if (options.mode === 'ats' || options.mode === 'all') {
    await runAtsScrapers()
  }

  await printJobSummary()

  console.log('✅ Finished daily scrape run.')
}

main()
  .catch((err) => {
    console.error('💥 Fatal error in dailyScrapeV2.ts')
    console.error(err)
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
      console.error(err)
    }
    await runNext()
  }

  for (let i = 0; i < Math.min(limit, items.length); i++) {
    runners.push(runNext())
  }

  await Promise.all(runners)
}
