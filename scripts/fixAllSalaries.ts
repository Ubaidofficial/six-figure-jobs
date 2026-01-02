import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Clear ALL jobs with salary > $1M (clearly broken)
  const cleared = await prisma.job.updateMany({
    where: {
      OR: [
        { minAnnual: { gt: 1000000n } },
        { maxAnnual: { gt: 1000000n } }
      ]
    },
    data: {
      minAnnual: null,
      maxAnnual: null,
      isHighSalary: false,
      isHundredKLocal: false
    }
  })
  __slog(`Cleared ${cleared.count} jobs with salary > $1M`)

  // Recalculate isHighSalary for remaining
  const setHigh = await prisma.job.updateMany({
    where: {
      OR: [
        { minAnnual: { gte: 100000n } },
        { maxAnnual: { gte: 100000n } }
      ]
    },
    data: { isHighSalary: true, isHundredKLocal: true }
  })
  __slog(`Set isHighSalary=true for ${setHigh.count} jobs`)

  // Final count
  const final = await prisma.job.count({
    where: { isExpired: false, maxAnnual: { gte: 100000n, lte: 1000000n } }
  })
  __slog(`\nFinal $100k-$1M jobs: ${final}`)

  await prisma.$disconnect()
}
main()
