// scripts/qaScrapers.ts
// Lightweight smoke test for board scrapers (and sample ATS via company metadata if desired).
// Run: npx tsx scripts/qaScrapers.ts

import { format as __format } from 'node:util'
import scrapeWeWorkRemotely from '../lib/scrapers/weworkremotely'
import scrapeNodesk from '../lib/scrapers/nodesk'
import scrapeRemoteOK from '../lib/scrapers/remoteok'
import scrapeRemotive from '../lib/scrapers/remotive'
import { scrapeRemoteOtter } from '../lib/scrapers/remoteotter'
import { scrapeRealWorkFromAnywhere } from '../lib/scrapers/realworkfromanywhere'
import { scrapeTrawle } from '../lib/scrapers/trawle'
import { scrapeFourDayWeek } from '../lib/scrapers/fourdayweek'
import scrapeRemoteRocketship from '../lib/scrapers/remoterocketship'
import { scrapeJustJoin } from '../lib/scrapers/justjoin'
import scrapeYCombinator from '../lib/scrapers/ycombinator'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


type Scraper = {
  name: string
  fn: () => Promise<any>
}

const SCRAPERS: Scraper[] = [
  { name: 'WeWorkRemotely', fn: scrapeWeWorkRemotely },
  { name: 'Nodesk', fn: scrapeNodesk },
  { name: 'RemoteOK', fn: scrapeRemoteOK },
  { name: 'Remotive', fn: scrapeRemotive },
  { name: 'RemoteOtter', fn: scrapeRemoteOtter },
  { name: 'RealWorkFromAnywhere', fn: scrapeRealWorkFromAnywhere },
  { name: 'Trawle', fn: scrapeTrawle },
  { name: 'FourDayWeek', fn: scrapeFourDayWeek },
  { name: 'RemoteRocketship', fn: scrapeRemoteRocketship },
  { name: 'JustJoin', fn: scrapeJustJoin },
  { name: 'YCombinator', fn: scrapeYCombinator },
]

function summarizeResult(result: any): { count: number; sample?: any } {
  if (Array.isArray(result)) {
    return { count: result.length, sample: result[0] }
  }
  if (result && Array.isArray(result.jobs)) {
    return { count: result.jobs.length, sample: result.jobs[0] }
  }
  if (result && typeof result.created === 'number' && typeof result.updated === 'number') {
    return { count: result.created + result.updated, sample: undefined }
  }
  return { count: 0, sample: undefined }
}

async function runScraper(scraper: Scraper) {
  const start = Date.now()
  try {
    const result = await scraper.fn()
    const ms = Date.now() - start
    const { count, sample } = summarizeResult(result)
    const sampleTitle = sample?.title ?? sample?.position ?? sample?.name
    const sampleCompany = sample?.rawCompanyName ?? sample?.company ?? sample?.companyName
    __slog(
      `✅ ${scraper.name}: ${count} items (${ms}ms) — sample:`,
      sampleTitle,
      '–',
      sampleCompany,
    )
  } catch (err: any) {
    const ms = Date.now() - start
    __serr(`❌ ${scraper.name} failed after ${ms}ms:`, err?.message || err)
  }
}

async function main() {
  __slog('🔍 Running scraper smoke tests…\n')
  for (const s of SCRAPERS) {
    await runScraper(s)
  }
  __slog('\nDone.')
}

main().catch((err) => {
  __serr(err)
  process.exitCode = 1
})
