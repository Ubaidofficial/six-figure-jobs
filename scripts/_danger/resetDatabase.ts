// scripts/_danger/resetDatabase.ts
// One-shot database reset:
//  - Deletes ALL Job records
//  - Then runs scripts/seed.ts to (re)seed companies & ATS links
//
// Run with:
//   npx tsx scripts/_danger/resetDatabase.ts

import { PrismaClient } from '@prisma/client'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

if (process.env.ALLOW_DANGER !== 'true') {
  console.error('Refusing to run. Set ALLOW_DANGER=true to proceed.')
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
  console.log('\n====================================================')
  console.log('⚠️  DATABASE RESET')
  console.log('====================================================')
  console.log('This will:')
  console.log('  • DELETE all rows from the "Job" table')
  console.log('  • KEEP all companies')
  console.log('  • Then run scripts/seed.ts to (re)seed companies & ATS links\n')

  const confirm = await askYesNo('Are you absolutely sure you want to continue?')
  if (!confirm) {
    console.log('❌ Cancelled. No changes were made.')
    await prisma.$disconnect()
    return
  }

  console.log('\n🧹 Deleting all jobs...')
  const deleted = await prisma.job.deleteMany({})
  console.log(`   → Deleted ${deleted.count} jobs\n`)

  await prisma.$disconnect()

  console.log('🌱 Running company seed (scripts/seed.ts)...')
  console.log('   (This will re-add curated + discovery companies and ATS metadata.)\n')

  // Dynamically import the seed script so we don't duplicate logic.
  // seed.ts already contains the full company lists and ATS links.
  await import('./seed')

  console.log('\n✅ Reset complete.')
  console.log('Next suggested step:')
  console.log('  npx tsx scripts/dailyScrapeV2.ts\n')
}

main().catch(async (err) => {
  console.error('Fatal error in resetDatabase.ts:', err)
  await prisma.$disconnect()
  process.exit(1)
})
