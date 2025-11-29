import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Clear jobs with exactly $1M max (clearly a placeholder/error)
  const cleared = await prisma.job.updateMany({
    where: { maxAnnual: 1000000n },
    data: { maxAnnual: null }
  })
  console.log(`Cleared maxAnnual for ${cleared.count} jobs with exactly $1M`)

  // Also clear any with max > $500k (unrealistic)
  const cleared2 = await prisma.job.updateMany({
    where: { maxAnnual: { gt: 500000n } },
    data: { maxAnnual: null }
  })
  console.log(`Cleared ${cleared2.count} jobs with max > $500k`)

  // Show top salaries now
  const top = await prisma.job.findMany({
    where: { maxAnnual: { not: null } },
    orderBy: { maxAnnual: 'desc' },
    take: 10,
    select: { title: true, company: true, minAnnual: true, maxAnnual: true, currency: true }
  })
  console.log('\nTop 10 salaries now:')
  top.forEach(j => console.log(`  ${Number(j.maxAnnual)} ${j.currency} - ${j.title} @ ${j.company}`))

  await prisma.$disconnect()
}
main()
