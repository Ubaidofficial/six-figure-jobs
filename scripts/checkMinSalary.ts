import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Count by minAnnual bands
  const bands = [
    { label: '$100k+ min', min: 100000n },
    { label: '$200k+ min', min: 200000n },
    { label: '$300k+ min', min: 300000n },
    { label: '$400k+ min', min: 400000n },
  ]
  
  __slog('Jobs by minAnnual threshold:')
  for (const b of bands) {
    const count = await prisma.job.count({
      where: { isExpired: false, minAnnual: { gte: b.min } }
    })
    __slog(`  ${b.label}: ${count}`)
  }

  // Top 5 by minAnnual
  const top = await prisma.job.findMany({
    where: { isExpired: false, minAnnual: { not: null } },
    orderBy: { minAnnual: 'desc' },
    take: 10,
    select: { title: true, company: true, minAnnual: true, maxAnnual: true, currency: true }
  })
  __slog('\nTop 10 by minAnnual:')
  top.forEach(j => __slog(`  ${Number(j.minAnnual)} ${j.currency} - ${j.title} @ ${j.company}`))

  await prisma.$disconnect()
}
main()
