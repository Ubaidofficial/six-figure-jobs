import { PrismaClient } from '@prisma/client'

if (process.env.ALLOW_DANGER !== 'true') {
  console.error('Refusing to run. Set ALLOW_DANGER=true to proceed.')
  process.exit(1)
}


const prisma = new PrismaClient()

async function deleteAshbyJobs() {
  console.log('\n🗑️  DELETING ASHBY JOBS...\n')

  const result = await prisma.job.deleteMany({
    where: {
      source: 'ats:ashby'
    }
  })

  console.log(`✅ Deleted ${result.count} Ashby jobs\n`)
  console.log('Now run: npx tsx scripts/dailyScrape.ts\n')
}

deleteAshbyJobs()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
