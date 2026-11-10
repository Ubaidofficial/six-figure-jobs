// scripts/fourdayweek-sync.ts
// Imports 4dayweek.io's four-day-week listings (lib/scrapers/fourdayweek.ts). Runs in the freehire daily workflow.
//   npm run sync:fourdayweek -- --dry-run   fetch + map only, no database writes
//   npm run sync:fourdayweek                real ingest (needs DATABASE_URL)
import { prisma } from '../lib/prisma'
import { scrapeFourDayWeek } from '../lib/scrapers/fourdayweek'

const dryRun = process.argv.includes('--dry-run')

scrapeFourDayWeek({ dryRun })
  .then((stats) => {
    console.log(`\n4dayweek sync ${dryRun ? '(DRY RUN — nothing written) ' : ''}created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`)
    if (stats.error) {
      console.error(`error: ${stats.error}`)
      process.exitCode = 1
    }
  })
  .finally(() => prisma.$disconnect())
