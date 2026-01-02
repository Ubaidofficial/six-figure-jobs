// scripts/test-all-scrapers.ts
// Comprehensive scraper health check
import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

interface ScraperResult {
  name: string
  success: boolean
  created?: number
  skipped?: number
  updated?: number
  error?: string
  duration: number
}

async function testScraper(
  name: string,
  scraperFn: () => Promise<any>
): Promise<ScraperResult> {
  const start = Date.now()
  try {
    const result = await scraperFn()
    const duration = (Date.now() - start) / 1000
    
    return {
      name,
      success: true,
      created: result?.created || 0,
      skipped: result?.skipped || 0,
      updated: result?.updated || 0,
      duration
    }
  } catch (err: any) {
    const duration = (Date.now() - start) / 1000
    return {
      name,
      success: false,
      error: err.message || String(err),
      duration
    }
  }
}

async function main() {
  __slog('🧪 SixFigureJobs Scraper Health Check')
  __slog('=====================================\n')

  const scrapers = [
    { name: 'RemoteOK', module: 'remoteok' },
    { name: 'WeWorkRemotely', module: 'weworkremotely' },
    { name: 'NoDesk', module: 'nodesk' },
    { name: 'BuiltIn', module: 'builtin' },
    { name: 'Remote100k', module: 'remote100k' },
    { name: 'RemoteRocketship', module: 'remoterocketship' },
    { name: 'Himalayas', module: 'himalayas' },
    { name: 'RemoteLeaf', module: 'remoteleaf' },
    { name: 'RealWorkFromAnywhere', module: 'realworkfromanywhere', export: 'scrapeRealWorkFromAnywhere' },
    { name: 'JustJoin', module: 'justjoin', export: 'scrapeJustJoin' },
    { name: 'RemoteOtter', module: 'remoteotter', export: 'scrapeRemoteOtter' },
    { name: 'Trawle', module: 'trawle', export: 'scrapeTrawle' },
    { name: 'FourDayWeek', module: 'fourdayweek', export: 'scrapeFourDayWeek' },
    { name: 'Remotive', module: 'remotive' },
    { name: 'Dice', module: 'dice' },
    { name: 'Wellfound', module: 'wellfound' },
    { name: 'Otta', module: 'otta' },
    { name: 'YCombinator', module: 'ycombinator' },
    { name: 'RemoteYeah', module: 'remoteyeah' },
  ]

  const results: ScraperResult[] = []

  for (const scraper of scrapers) {
    __slog(`\n▶ Testing ${scraper.name}...`)
    
    try {
      const mod = await import(`../lib/scrapers/${scraper.module}`)
      const scraperFn = scraper.export ? mod[scraper.export] : mod.default
      
      if (!scraperFn) {
        results.push({
          name: scraper.name,
          success: false,
          error: 'No export found',
          duration: 0
        })
        __slog(`   ❌ No export found`)
        continue
      }

      const result = await testScraper(scraper.name, scraperFn)
      results.push(result)

      if (result.success) {
        __slog(`   ✅ SUCCESS: ${result.created} created, ${result.skipped} skipped (${result.duration.toFixed(1)}s)`)
      } else {
        __slog(`   ❌ FAILED: ${result.error}`)
      }
    } catch (err: any) {
      results.push({
        name: scraper.name,
        success: false,
        error: `Import failed: ${err.message}`,
        duration: 0
      })
      __slog(`   ❌ Import failed: ${err.message}`)
    }
  }

  // Summary
  __slog('\n\n📊 SUMMARY')
  __slog('==========\n')

  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)

  __slog(`✅ Working: ${successful.length}/${results.length}`)
  __slog(`❌ Broken: ${failed.length}/${results.length}\n`)

  if (successful.length > 0) {
    __slog('✅ Working Scrapers:')
    successful.forEach(r => {
      __slog(`   • ${r.name}: ${r.created} created, ${r.skipped} skipped`)
    })
  }

  if (failed.length > 0) {
    __slog('\n❌ Broken Scrapers:')
    failed.forEach(r => {
      __slog(`   • ${r.name}: ${r.error}`)
    })
  }

  const totalCreated = successful.reduce((sum, r) => sum + (r.created || 0), 0)
  const totalSkipped = successful.reduce((sum, r) => sum + (r.skipped || 0), 0)

  __slog(`\n📈 Total: ${totalCreated} created, ${totalSkipped} skipped`)

  await prisma.$disconnect()
}

main().catch(console.error)
