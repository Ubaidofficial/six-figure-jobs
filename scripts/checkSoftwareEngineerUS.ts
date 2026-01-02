// scripts/checkSoftwareEngineerUS.ts
import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


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

  __slog('Matching jobs:', count)
}

main().finally(() => prisma.$disconnect())
