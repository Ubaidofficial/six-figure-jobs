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
import scrapeGreenhouse from '../lib/scrapers/greenhouse'
// (add Ashby / Lever / Workday ATS scripts here when ready)

const prisma = new PrismaClient()

type Mode = 'all' | 'boards' | 'ats'

interface CliOptions {
  mode: Mode
  fast: boolean
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

  return { mode, fast }
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

  for (const [name, fn] of scrapers) {
    console.log(`▶ ${name}…`)
    try {
      await fn()
      console.log(`   ✅ ${name} done.\n`)
    } catch (err: any) {
      console.error(`   ❌ ${name} failed:`, err?.message || err)
      console.error('')
    }
  }
}

async function runAtsScrapers() {
  console.log('🏢 Running ATS scrapers…\n')

  const scrapers: Array<[string, () => Promise<unknown>]> = [
    ['Greenhouse', scrapeGreenhouse],
    // ['Ashby', scrapeAshby], etc – when ready
  ]

  for (const [name, fn] of scrapers) {
    console.log(`▶ ${name}…`)
    try {
      await fn()
      console.log(`   ✅ ${name} done.\n`)
    } catch (err: any) {
      console.error(`   ❌ ${name} failed:`, err?.message || err)
      console.error('')
    }
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
