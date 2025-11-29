import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Count by minAnnual bands
  const bands = [
    { label: '$100k+ min', min: 100000n },
    { label: '$200k+ min', min: 200000n },
    { label: '$300k+ min', min: 300000n },
    { label: '$400k+ min', min: 400000n },
  ]
  
  console.log('Jobs by minAnnual threshold:')
  for (const b of bands) {
    const count = await prisma.job.count({
      where: { isExpired: false, minAnnual: { gte: b.min } }
    })
    console.log(`  ${b.label}: ${count}`)
  }

  // Top 5 by minAnnual
  const top = await prisma.job.findMany({
    where: { isExpired: false, minAnnual: { not: null } },
    orderBy: { minAnnual: 'desc' },
    take: 10,
    select: { title: true, company: true, minAnnual: true, maxAnnual: true, currency: true }
  })
  console.log('\nTop 10 by minAnnual:')
  top.forEach(j => console.log(`  ${Number(j.minAnnual)} ${j.currency} - ${j.title} @ ${j.company}`))

  await prisma.$disconnect()
}
main()
