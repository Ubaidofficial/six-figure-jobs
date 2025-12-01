// scripts/fixSalaryOutliers.ts
// Lists jobs with maxAnnual > $1M and clamps them to null to avoid UI pollution.
// Usage: npx tsx scripts/fixSalaryOutliers.ts

import { prisma } from '../lib/prisma'

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
    console.log('No salary outliers found.')
    return
  }

  console.log(`Found ${jobs.length} outlier jobs. Clamping salaries...`)

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

  console.log('Clamped outlier salaries.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
