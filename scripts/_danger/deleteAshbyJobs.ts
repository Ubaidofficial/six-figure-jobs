import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


if (process.env.ALLOW_DANGER !== 'true') {
  __serr('Refusing to run. Set ALLOW_DANGER=true to proceed.')
  process.exit(1)
}


const prisma = new PrismaClient()

async function deleteAshbyJobs() {
  __slog('\n🗑️  DELETING ASHBY JOBS...\n')

  const result = await prisma.job.deleteMany({
    where: {
      source: 'ats:ashby'
    }
  })

  __slog(`✅ Deleted ${result.count} Ashby jobs\n`)
  __slog('Now run: npx tsx scripts/dailyScrape.ts\n')
}

deleteAshbyJobs()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
