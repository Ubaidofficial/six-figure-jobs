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
import scrapeGenericSources from '../lib/scrapers/generic'
import scrapeRemoteAI from '../lib/scrapers/remoteai'
import scrapeRemoteYeah from '../lib/scrapers/remoteyeah'
import scrapeHimalayas from '../lib/scrapers/himalayas'
import scrapeRemoteLeaf from '../lib/scrapers/remoteleaf'

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

/**
 * Seed generic career sources for companies that have a website but no ATS.
 * This lets the generic puppeteer scraper pick them up.
 */
async function seedGenericSourcesForNonAts() {
  const candidates = await prisma.company.findMany({
    where: {
      atsProvider: null,
      atsUrl: null,
      website: { not: null },
    },
    select: { id: true, website: true },
  })

  if (!candidates.length) return

  let created = 0
  for (const c of candidates) {
    const existing = await prisma.companySource.findFirst({
      where: {
        companyId: c.id,
        url: c.website!,
      },
      select: { id: true },
    })
    if (existing) continue

    await prisma.companySource.create({
      data: {
        companyId: c.id,
        url: c.website!,
        sourceType: 'generic_careers_page',
        isActive: true,
        priority: 200, // lower priority than ATS/board
      },
    })
    created++
  }

  if (created > 0) {
    __slog(`🌱 Seeded ${created} generic career sources for non-ATS companies.`)
  }
}

async function runBoardScrapers(options: CliOptions) {
  const { fast } = options

  __slog('🌐 Running BOARD scrapers…\n')

  // Ensure generic scraper has sources to work with (non-ATS companies from seed)
  await seedGenericSourcesForNonAts()

  // Ordered so we hit “core” boards first
	  const allScrapers: Array<[string, () => Promise<unknown>]> = [
	    ['RemoteOK', scrapeRemoteOK],
	    ['WeWorkRemotely', scrapeWeWorkRemotely],
	    ['NoDesk', scrapeNodesk],
	    ['BuiltIn', scrapeBuiltIn],
	    ['RemoteRocketship', scrapeRemoteRocketship],
	    ['Himalayas', scrapeHimalayas],
	    ['RemoteLeaf', scrapeRemoteLeaf],
	    ['RealWorkFromAnywhere', scrapeRealWorkFromAnywhere],
	    ['JustJoin', scrapeJustJoin],
	    ['RemoteOtter', scrapeRemoteOtter],
	    ['Trawle', scrapeTrawle],
	    ['FourDayWeek', scrapeFourDayWeek],
	    ['Remotive', scrapeRemotive],
	    ['Dice', scrapeDice],
	    ['Wellfound', scrapeWellfound],
	    ['Otta', scrapeOtta],
	    ['YCombinator', scrapeYCombinator],
	    ['RemoteYeah', scrapeRemoteYeah],
	    ['RemoteAI (companies only)', scrapeRemoteAI],
	    ['GenericSources', scrapeGenericSources],
	  ]

  // In fast mode, skip the slower / more experimental scrapers
	  const scrapers = fast
	    ? allScrapers.filter(([name]) =>
	        [
	          'RemoteOK',
	          'WeWorkRemotely',
	          'RemoteRocketship',
	          'Himalayas',
	          'RemoteLeaf',
	          'RealWorkFromAnywhere',
	          'JustJoin',
	          'FourDayWeek',
	          'RemoteYeah',
	          'RemoteAI (companies only)',
	          'GenericSources',
	        ].includes(name),
	      )
	    : allScrapers

	  await runWithConcurrency(scrapers, options.concurrency, async ([name, fn]) => {
	    __slog(`\n▶ Running ${name}…`)
	    const startTime = Date.now()

	    try {
	      const result = (await fn()) as any
	      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

	      const created = Number(result?.created ?? 0)
	      const skipped = Number(result?.skipped ?? 0)
	      const error = result?.error

	      if (error) {
	        __slog(`   ❌ ${name} failed: ${error}`)
	      } else {
	        __slog(`   ✓ ${name}: ${created} created, ${skipped} skipped (${elapsed}s)`)
	      }
	    } catch (err) {
	      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
	      __serr(`   ❌ ${name} crashed:`, err)
	      __slog(`   Time: ${elapsed}s`)
	    }
	  })
	}

async function runAtsScrapers() {
  __slog('🏢 Running ATS scrapers…\n')

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
    __slog('   ⚠️  No companies with ATS metadata. Skipping ATS scrape.\n')
    return
  }

  let totalCreated = 0
  let totalUpdated = 0
  let totalSkipped = 0
  let totalErrors = 0

  await runWithConcurrency(companies, 5, async (company) => {
    const provider = company.atsProvider as AtsProvider
    const slug = company.slug ?? company.id

    __slog(`▶ ${slug} (${provider})…`)
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

      __slog(
        `   ✅ ${slug}: jobs=${jobs.length} created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`,
      )
      __slog('')
    } catch (err: any) {
      totalErrors++
      const message = err?.message || String(err)
      __serr(`   ❌ ${slug} failed:`, message)
      __serr('')

      await prisma.company.update({
        where: { id: company.id },
        data: {
          scrapeStatus: 'failed',
          scrapeError: message.slice(0, 500),
        },
      })
    }
  })

  __slog('ATS scrape totals:')
  __slog(`  Created: ${totalCreated}`)
  __slog(`  Updated: ${totalUpdated}`)
  __slog(`  Skipped: ${totalSkipped}`)
  __slog(`  Errors : ${totalErrors}\n`)
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

  __slog('===========================================')
  __slog('  SixFigureJobs – Daily Scraper v2')
  __slog('===========================================')
  __slog(`Mode : ${options.mode}`)
  __slog(`Fast : ${options.fast ? 'YES (skip slow boards)' : 'no'}`)
  __slog(`Concurrency : ${options.concurrency}`)
  __slog('')

  if (options.mode === 'boards' || options.mode === 'all') {
    await runBoardScrapers(options)
  }

  if (options.mode === 'ats' || options.mode === 'all') {
    await runAtsScrapers()
  }

  await printJobSummary()

  __slog('✅ Finished daily scrape run.')
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
