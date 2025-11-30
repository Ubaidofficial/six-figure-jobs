// scripts/clearCrazySalaries.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Clearing obviously broken salaries (> $1M/yr)…')

  // 1) Clear all jobs with salary > $1M (clearly broken)
  const cleared = await prisma.job.updateMany({
    where: {
      OR: [
        { minAnnual: { gt: 1_000_000n } },
        { maxAnnual: { gt: 1_000_000n } },
      ],
    },
    data: {
      minAnnual: null,
      maxAnnual: null,
      isHighSalary: false,
      isHundredKLocal: false,
    },
  })

  console.log(`✅ Cleared ${cleared.count} jobs with salary > $1M`)

  // 2) Recalculate isHighSalary / isHundredKLocal for remaining jobs
  const setHigh = await prisma.job.updateMany({
    where: {
      OR: [
        { minAnnual: { gte: 100_000n, lte: 1_000_000n } },
        { maxAnnual: { gte: 100_000n, lte: 1_000_000n } },
      ],
    },
    data: {
      isHighSalary: true,
      isHundredKLocal: true,
    },
  })

  console.log(
    `✅ Set isHighSalary=true & isHundredKLocal=true for ${setHigh.count} jobs`,
  )

  const final = await prisma.job.count({
    where: {
      isExpired: false,
      OR: [
        { minAnnual: { gte: 100_000n, lte: 1_000_000n } },
        { maxAnnual: { gte: 100_000n, lte: 1_000_000n } },
      ],
    },
  })

  console.log(`📊 Final $100k–$1M jobs: ${final}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
