// scripts/worldwide-boards-sync.ts
// Imports worldwide-remote jobs from We Work Remotely and Himalayas (lib/scrapers/worldwideBoards.ts). Runs in the
// freehire daily workflow.
//   npm run sync:worldwide-boards -- --dry-run   fetch + map only, no database writes
//   npm run sync:worldwide-boards                real ingest (needs DATABASE_URL)
import { prisma } from '../lib/prisma'
import { syncWorldwideBoards } from '../lib/scrapers/worldwideBoards'

const dryRun = process.argv.includes('--dry-run')

syncWorldwideBoards({ dryRun })
  .then((byBoard) => {
    for (const [board, s] of Object.entries(byBoard)) {
      console.log(`${board}${dryRun ? ' (DRY RUN)' : ''}: created=${s.created} updated=${s.updated} skipped=${s.skipped}${s.error ? ` error=${s.error}` : ''}`)
    }
    if (Object.values(byBoard).every((s) => s.error)) process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
