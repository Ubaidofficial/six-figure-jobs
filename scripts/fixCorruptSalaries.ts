import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

async function fixCorruptSalaries() {
  __slog('\n🔧 FIXING CORRUPT SALARIES...\n')

  const corruptJobs = await prisma.job.findMany({
    where: {
      OR: [
        { minAnnual: { gt: 2000000 } },
        { maxAnnual: { gt: 2000000 } }
      ]
    },
    select: {
      id: true,
      title: true,
      company: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      source: true,
    }
  })

  __slog(`Found ${corruptJobs.length} jobs with corrupt salaries\n`)

  for (const job of corruptJobs) {
    const min = job.minAnnual ? Number(job.minAnnual) : null
    const max = job.maxAnnual ? Number(job.maxAnnual) : null

    let fixedMin = min
    let fixedMax = max

    if (min && min > 2000000) {
      fixedMin = Math.round(min / 100)
    }
    if (max && max > 2000000) {
      fixedMax = Math.round(max / 100)
    }

    __slog(`${job.company}: ${job.title}`)
    __slog(`  Before: ${min?.toLocaleString()} - ${max?.toLocaleString()}`)
    __slog(`  After:  ${fixedMin?.toLocaleString()} - ${fixedMax?.toLocaleString()}`)

    await prisma.job.update({
      where: { id: job.id },
      data: {
        minAnnual: fixedMin ? BigInt(fixedMin) : null,
        maxAnnual: fixedMax ? BigInt(fixedMax) : null,
      }
    })
  }

  __slog(`\n✅ Fixed ${corruptJobs.length} corrupt salaries\n`)
}

fixCorruptSalaries()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
