// scripts/freehire-sync.ts
// Runs the freehire board sync by hand.
//   npm run sync:freehire -- --dry-run --max-pages 2   fetch + map only, no database needed
//   npm run sync:freehire                               real ingest (needs DATABASE_URL)
import { lastRateLimit, syncFreehire } from '../lib/scrapers/freehire'

const dryRun = process.argv.includes('--dry-run')
const pagesIdx = process.argv.indexOf('--max-pages')
const maxPagesPerMarket = pagesIdx > -1 ? Number(process.argv[pagesIdx + 1]) || undefined : undefined

async function main() {
  const { stats, markets } = await syncFreehire({ dryRun, maxPagesPerMarket })

  console.log(`\nfreehire sync ${dryRun ? '(DRY RUN — nothing written)' : ''}`)
  for (const m of markets) {
    console.log(
      `${m.currency}: available=${m.available} fetched=${m.fetched} mappable=${m.mappable}` +
        (dryRun ? ` gateRejected=${m.gateRejected}` : '') +
        ` range=${m.oldest ?? '-'} → ${m.newest ?? '-'}`,
    )
    for (const s of m.sample) console.log(`    e.g. ${s}`)
  }
  console.log(`\ncreated=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`)
  // freehire's own count of what is left of the key's budget, from the last page read (to see how close a day comes to it).
  if (lastRateLimit) console.log(`[freehire] rate limit after the sync: limit=${lastRateLimit.limit ?? '-'} remaining=${lastRateLimit.remaining ?? '-'} reset=${lastRateLimit.reset ?? '-'}s`)
  if (stats.error) {
    console.error(`errors: ${stats.error}`)
    process.exitCode = 1
  }
}

main()
