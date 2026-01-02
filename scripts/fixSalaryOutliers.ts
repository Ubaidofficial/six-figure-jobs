// scripts/fixSalaryOutliers.ts
// Lists jobs with maxAnnual > $1M and clamps them to null to avoid UI pollution.
// Usage: npx tsx scripts/fixSalaryOutliers.ts

import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const OUTLIER_THRESHOLD = 1_000_000

async function main() {
  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      maxAnnual: { gt: BigInt(OUTLIER_THRESHOLD) },
    },
    select: {
      id: true,
      title: true,
      company: true,
      maxAnnual: true,
      minAnnual: true,
    },
  })

  if (jobs.length === 0) {
    __slog('No salary outliers found.')
    return
  }

  __slog(`Found ${jobs.length} outlier jobs. Clamping salaries...`)

  for (const job of jobs) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        maxAnnual: null,
        minAnnual: job.minAnnual && job.minAnnual > BigInt(OUTLIER_THRESHOLD) ? null : job.minAnnual,
        salaryMax: null,
        salaryMin:
          job.minAnnual && job.minAnnual > BigInt(OUTLIER_THRESHOLD)
            ? null
            : job.minAnnual ?? null,
      },
    })
  }

  __slog('Clamped outlier salaries.')
}

main()
  .catch((err) => {
    __serr(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
