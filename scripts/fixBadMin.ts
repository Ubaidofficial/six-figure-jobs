import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Clear jobs with minAnnual > $500k (unrealistic)
  const cleared = await prisma.job.updateMany({
    where: { minAnnual: { gt: 500000n } },
    data: { minAnnual: null, isHighSalary: false }
  })
  console.log(`Cleared minAnnual for ${cleared.count} jobs`)

  // Recount
  const bands = [100000n, 200000n, 300000n, 400000n]
  for (const min of bands) {
    const count = await prisma.job.count({
      where: { isExpired: false, minAnnual: { gte: min } }
    })
    console.log(`$${Number(min)/1000}k+ min: ${count}`)
  }

  await prisma.$disconnect()
}
main()
