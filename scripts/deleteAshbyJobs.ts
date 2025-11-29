import { PrismaClient } from '@prisma/client'

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
