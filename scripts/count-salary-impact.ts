import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function run() {
  const salaryTiers = await prisma.job.groupBy({
    by: ['salaryMin', 'salaryMax'],
    _count: { _all: true },
    where: { isExpired: false, salaryValidated: true }
  })
  
  let before1 = 0
  let after3 = 0
  
  for (const tier of salaryTiers) {
    if (tier._count._all >= 1) before1++
    if (tier._count._all >= 3) after3++
  }
  
  console.log(`Indexable Tiers (Threshold 1): ${before1}`)
  console.log(`Indexable Tiers (Threshold 3): ${after3}`)
  console.log(`Dropped from Index: ${before1 - after3}`)
}

run().catch(console.error).finally(() => prisma.$disconnect())
