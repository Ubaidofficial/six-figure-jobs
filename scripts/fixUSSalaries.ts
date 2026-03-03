import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Find US jobs with wrong currency
  const wrongCurrency = await prisma.job.findMany({
    where: {
      countryCode: 'US',
      currency: { in: ['AUD', 'EUR', 'GBP', 'CAD'] },
      isExpired: false
    },
    select: { id: true, title: true, currency: true, minAnnual: true, maxAnnual: true }
  })

  __slog(`Found ${wrongCurrency.length} US jobs with wrong currency`)

  // For now, clear the salary data for these jobs (it's unreliable)
  // They'll need to be re-scraped with proper salary parsing
  const cleared = await prisma.job.updateMany({
    where: {
      countryCode: 'US',
      currency: { in: ['AUD', 'EUR', 'GBP', 'CAD'] }
    },
    data: {
      minAnnual: null,
      maxAnnual: null,
      currency: null,
      isHighSalary: false,
      isHundredKLocal: false
    }
  })

  __slog(`Cleared salary for ${cleared.count} US jobs with wrong currency`)

  // Check remaining salary distribution
  const withSalary = await prisma.job.count({
    where: { isExpired: false, minAnnual: { not: null } }
  })
  const highSalary = await prisma.job.count({
    where: { isExpired: false, isHighSalary: true }
  })

  __slog(`\nRemaining: ${withSalary} jobs with salary, ${highSalary} high-salary`)

  await prisma.$disconnect()
}
main()
