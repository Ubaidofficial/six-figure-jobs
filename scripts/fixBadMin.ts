import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Clear jobs with minAnnual > $500k (unrealistic)
  const cleared = await prisma.job.updateMany({
    where: { minAnnual: { gt: 500000n } },
    data: { minAnnual: null, isHighSalary: false }
  })
  __slog(`Cleared minAnnual for ${cleared.count} jobs`)

  // Recount
  const bands = [100000n, 200000n, 300000n, 400000n]
  for (const min of bands) {
    const count = await prisma.job.count({
      where: { isExpired: false, minAnnual: { gte: min } }
    })
    __slog(`$${Number(min)/1000}k+ min: ${count}`)
  }

  await prisma.$disconnect()
}
main()
