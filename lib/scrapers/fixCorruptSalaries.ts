import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixCorruptSalaries() {
  console.log('\n🔧 FIXING CORRUPT SALARIES...\n')

  // Find jobs with suspiciously high salaries (> $2M annual)
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

  console.log(`Found ${corruptJobs.length} jobs with corrupt salaries\n`)

  // Fix each one
  for (const job of corruptJobs) {
    const min = job.minAnnual ? Number(job.minAnnual) : null
    const max = job.maxAnnual ? Number(job.maxAnnual) : null

    let fixedMin = min
    let fixedMax = max

    // If it looks like cents (> $2M), divide by 100
    if (min && min > 2000000) {
      fixedMin = Math.round(min / 100)
    }
    if (max && max > 2000000) {
      fixedMax = Math.round(max / 100)
    }

    console.log(`${job.company}: ${job.title}`)
    console.log(`  Before: ${min?.toLocaleString()} - ${max?.toLocaleString()}`)
    console.log(`  After:  ${fixedMin?.toLocaleString()} - ${fixedMax?.toLocaleString()}`)
    console.log('')

    await prisma.job.update({
      where: { id: job.id },
      data: {
        minAnnual: fixedMin ? BigInt(fixedMin) : null,
        maxAnnual: fixedMax ? BigInt(fixedMax) : null,
      }
    })
  }

  console.log(`✅ Fixed ${corruptJobs.length} corrupt salaries\n`)
}

fixCorruptSalaries()
  .catch(console.error)
  .finally(() => prisma.$disconnect())