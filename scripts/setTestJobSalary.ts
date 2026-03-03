// scripts/setTestJobSalary.ts
import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


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
    __serr('No ATS jobs found to update')
    return
  }

  __slog('Updating job:', {
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

  __slog('Updated row:', {
    id: updated.id,
    roleSlug: updated.roleSlug,
    minAnnual: updated.minAnnual?.toString(),
    maxAnnual: updated.maxAnnual?.toString(),
    isHundredKLocal: updated.isHundredKLocal,
  })
}

main()
  .catch((e) => {
    __serr(e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
