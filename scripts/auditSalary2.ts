import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Sample jobs WITH salary (what should show on homepage)
  const withSalary = await prisma.job.findMany({
    where: { isExpired: false, maxAnnual: { gte: 100000n } },
    orderBy: [{ maxAnnual: 'desc' }],
    take: 5,
    select: { title: true, company: true, minAnnual: true, maxAnnual: true, currency: true }
  })
  __slog('Jobs WITH $100k+ salary:')
  withSalary.forEach(j => __slog(`  ${j.title} @ ${j.company} | ${Number(j.minAnnual)}-${Number(j.maxAnnual)} ${j.currency}`))

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
  __slog('\nHomepage query results:')
  homepageQuery.forEach(j => __slog(`  ${j.title} | ${j.minAnnual}-${j.maxAnnual} | isHundredKLocal: ${j.isHundredKLocal}`))

  await prisma.$disconnect()
}
main()
