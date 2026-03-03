import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Check Anthropic US jobs
  const anthropicUS = await prisma.job.findMany({
    where: { company: 'Anthropic', countryCode: 'US', isExpired: false },
    take: 10,
    select: { title: true, minAnnual: true, maxAnnual: true, currency: true, locationRaw: true }
  })
  
  __slog('Anthropic US jobs:')
  anthropicUS.forEach(j => {
    const min = j.minAnnual ? Number(j.minAnnual).toLocaleString() : 'null'
    const max = j.maxAnnual ? Number(j.maxAnnual).toLocaleString() : 'null'
    __slog(`  ${j.currency || 'N/A'} ${min}-${max} | ${j.title}`)
  })

  // Summary by currency
  __slog('\n--- Salary distribution ---')
  const currencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD']
  for (const c of currencies) {
    const count = await prisma.job.count({
      where: { currency: c, isExpired: false, minAnnual: { not: null } }
    })
    __slog(`${c}: ${count} jobs`)
  }

  // High salary counts
  const bands = [100000n, 200000n, 300000n, 400000n]
  __slog('\n--- Salary bands (by minAnnual) ---')
  for (const min of bands) {
    const count = await prisma.job.count({
      where: { isExpired: false, minAnnual: { gte: min } }
    })
    __slog(`$${Number(min)/1000}k+: ${count}`)
  }

  await prisma.$disconnect()
}
main()
