import { PrismaClient } from '@prisma/client'
import { HIGH_SALARY_THRESHOLDS, isHighSalary } from '../lib/currency/thresholds'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Updating High Salary Flags based on new currency thresholds...')
  console.log('Thresholds:', HIGH_SALARY_THRESHOLDS)

  const jobs = await prisma.job.findMany({
    where: { isExpired: false },
    select: { id: true, minAnnual: true, maxAnnual: true, currency: true, isHighSalary: true }
  })

  let updated = 0
  
  for (const job of jobs) {
    if (!job.currency) continue

    // Calculate max salary (most optimistic)
    const salary = Number(job.maxAnnual || job.minAnnual || 0)
    if (salary === 0) continue

    const shouldBeHigh = isHighSalary(salary, job.currency)

    if (job.isHighSalary !== shouldBeHigh) {
      await prisma.job.update({
        where: { id: job.id },
        data: { isHighSalary: shouldBeHigh }
      })
      // console.log(`  Updated ${job.id}: ${salary} ${job.currency} -> High? ${shouldBeHigh}`)
      updated++
    }
  }

  console.log(`✅ Done! Updated ${updated} jobs to reflect local market rates.`)
}

main()