// scripts/_danger/resetDatabase.ts
// One-shot database reset:
//  - Deletes ALL Job records
//  - Then runs scripts/seed.ts to (re)seed companies & ATS links
//
// Run with:
//   npx tsx scripts/_danger/resetDatabase.ts

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


if (process.env.ALLOW_DANGER !== 'true') {
  __serr('Refusing to run. Set ALLOW_DANGER=true to proceed.')
  process.exit(1)
}


const prisma = new PrismaClient()

async function askYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output })
  const answer = (await rl.question(`${question} (yes/no) `)).trim().toLowerCase()
  rl.close()
  return answer === 'y' || answer === 'yes'
}

async function main() {
  __slog('\n====================================================')
  __slog('⚠️  DATABASE RESET')
  __slog('====================================================')
  __slog('This will:')
  __slog('  • DELETE all rows from the "Job" table')
  __slog('  • KEEP all companies')
  __slog('  • Then run scripts/seed.ts to (re)seed companies & ATS links\n')

  const confirm = await askYesNo('Are you absolutely sure you want to continue?')
  if (!confirm) {
    __slog('❌ Cancelled. No changes were made.')
    await prisma.$disconnect()
    return
  }

  __slog('\n🧹 Deleting all jobs...')
  const deleted = await prisma.job.deleteMany({})
  __slog(`   → Deleted ${deleted.count} jobs\n`)

  await prisma.$disconnect()

  __slog('🌱 Running company seed (scripts/seed.ts)...')
  __slog('   (This will re-add curated + discovery companies and ATS metadata.)\n')

  // Dynamically import the seed script so we don't duplicate logic.
  // seed.ts already contains the full company lists and ATS links.
  await import('./seed')

  __slog('\n✅ Reset complete.')
  __slog('Next suggested step:')
  __slog('  npx tsx scripts/dailyScrapeV2.ts\n')
}

main().catch(async (err) => {
  __serr('Fatal error in resetDatabase.ts:', err)
  await prisma.$disconnect()
  process.exit(1)
})
