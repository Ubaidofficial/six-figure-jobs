// scripts/checkSoftwareEngineerUS.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.job.count({
    where: {
      isExpired: false,
      roleSlug: 'software-engineer',
      countryCode: 'US',
      OR: [
        {
          minAnnual: { gte: BigInt(100_000) },
          maxAnnual: { gte: BigInt(100_000) },
        },
        { isHundredKLocal: true },
      ],
    },
  })

  console.log('Matching jobs:', count)
}

main().finally(() => prisma.$disconnect())
