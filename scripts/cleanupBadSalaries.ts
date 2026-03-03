import { format as __format } from 'node:util'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const { prisma } = require("../lib/prisma")

async function run() {
  __slog("Starting salary cleanup...")

  const result = await prisma.job.updateMany({
    where: {
      OR: [
        // Too low = likely monthly / local
        { minAnnual: { lt: BigInt(50000) } },
        { maxAnnual: { lt: BigInt(50000) } },

        // Absurdly high junk
        { minAnnual: { gt: BigInt(5_000_000) } },
        { maxAnnual: { gt: BigInt(5_000_000) } },

        // Known monthly/local currencies
        {
          currency: { in: ["SEK", "NOK", "DKK", "INR"] },
          AND: [{ minAnnual: { lt: BigInt(1_000_000) } }],
        },
      ],
    },
    data: {
      minAnnual: null,
      maxAnnual: null,
      salaryValidated: false,
    },
  })

  __slog(`Cleaned ${result.count} jobs`)
}

run()
  .catch((e) => {
    __serr(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
