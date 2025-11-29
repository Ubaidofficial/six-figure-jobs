import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check Anthropic US jobs
  const anthropicUS = await prisma.job.findMany({
    where: { company: 'Anthropic', countryCode: 'US', isExpired: false },
    take: 10,
    select: { title: true, minAnnual: true, maxAnnual: true, currency: true, locationRaw: true }
  })
  
  console.log('Anthropic US jobs:')
  anthropicUS.forEach(j => {
    const min = j.minAnnual ? Number(j.minAnnual).toLocaleString() : 'null'
    const max = j.maxAnnual ? Number(j.maxAnnual).toLocaleString() : 'null'
    console.log(`  ${j.currency || 'N/A'} ${min}-${max} | ${j.title}`)
  })

  // Summary by currency
  console.log('\n--- Salary distribution ---')
  const currencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD']
  for (const c of currencies) {
    const count = await prisma.job.count({
      where: { currency: c, isExpired: false, minAnnual: { not: null } }
    })
    console.log(`${c}: ${count} jobs`)
  }

  // High salary counts
  const bands = [100000n, 200000n, 300000n, 400000n]
  console.log('\n--- Salary bands (by minAnnual) ---')
  for (const min of bands) {
    const count = await prisma.job.count({
      where: { isExpired: false, minAnnual: { gte: min } }
    })
    console.log(`$${Number(min)/1000}k+: ${count}`)
  }

  await prisma.$disconnect()
}
main()
