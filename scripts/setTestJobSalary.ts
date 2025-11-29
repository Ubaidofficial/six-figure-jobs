// scripts/setTestJobSalary.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Grab any one ATS job as a test row
  const job = await prisma.job.findFirst({
    where: {
      source: 'ats',
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  if (!job) {
    console.error('No ATS jobs found to update')
    return
  }

  console.log('Updating job:', {
    id: job.id,
    title: job.title,
    roleSlug: job.roleSlug,
  })

  const updated = await prisma.job.update({
    where: { id: job.id },
    data: {
      // make sure it shows up on /remote/software-engineer
      roleSlug: 'software-engineer',

      // put it clearly above 100k
      minAnnual: BigInt(120_000),
      maxAnnual: BigInt(150_000),
      salaryMin: BigInt(120_000),
      salaryMax: BigInt(150_000),
      salaryCurrency: 'USD',
      salaryPeriod: 'year',
      currency: 'USD',
      isHundredKLocal: true,

      isExpired: false,
    },
  })

  console.log('Updated row:', {
    id: updated.id,
    roleSlug: updated.roleSlug,
    minAnnual: updated.minAnnual?.toString(),
    maxAnnual: updated.maxAnnual?.toString(),
    isHundredKLocal: updated.isHundredKLocal,
  })
}

main()
  .catch((e) => {
    console.error(e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
