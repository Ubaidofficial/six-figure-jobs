import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Sample jobs WITH salary (what should show on homepage)
  const withSalary = await prisma.job.findMany({
    where: { isExpired: false, maxAnnual: { gte: 100000n } },
    orderBy: [{ maxAnnual: 'desc' }],
    take: 5,
    select: { title: true, company: true, minAnnual: true, maxAnnual: true, currency: true }
  })
  console.log('Jobs WITH $100k+ salary:')
  withSalary.forEach(j => console.log(`  ${j.title} @ ${j.company} | ${Number(j.minAnnual)}-${Number(j.maxAnnual)} ${j.currency}`))

  // Check what homepage query returns
  const homepageQuery = await prisma.job.findMany({
    where: { 
      isExpired: false,
      OR: [
        { minAnnual: { gte: 100000n } },
        { maxAnnual: { gte: 100000n } },
        { isHundredKLocal: true }
      ]
    },
    orderBy: [{ isHundredKLocal: 'desc' }, { maxAnnual: 'desc' }],
    take: 5,
    select: { title: true, company: true, minAnnual: true, maxAnnual: true, isHundredKLocal: true }
  })
  console.log('\nHomepage query results:')
  homepageQuery.forEach(j => console.log(`  ${j.title} | ${j.minAnnual}-${j.maxAnnual} | isHundredKLocal: ${j.isHundredKLocal}`))

  await prisma.$disconnect()
}
main()
