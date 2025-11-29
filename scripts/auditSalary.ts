import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const total = await prisma.job.count({ where: { isExpired: false } })
  const withMin = await prisma.job.count({ where: { isExpired: false, minAnnual: { not: null } } })
  const withMax = await prisma.job.count({ where: { isExpired: false, maxAnnual: { not: null } } })
  const isHighSalary = await prisma.job.count({ where: { isExpired: false, isHighSalary: true } })

  const over100k = await prisma.job.count({
    where: { isExpired: false, OR: [{ minAnnual: { gte: 100000n } }, { maxAnnual: { gte: 100000n } }] }
  })
  const over200k = await prisma.job.count({
    where: { isExpired: false, OR: [{ minAnnual: { gte: 200000n } }, { maxAnnual: { gte: 200000n } }] }
  })

  console.log(`
Total active jobs: ${total}
Jobs with minAnnual: ${withMin}
Jobs with maxAnnual: ${withMax}
Jobs with isHighSalary=true: ${isHighSalary}
$100k+: ${over100k}
$200k+: ${over200k}
`)

  const samples = await prisma.job.findMany({
    where: { isExpired: false },
    take: 5,
    select: { title: true, company: true, minAnnual: true, maxAnnual: true, currency: true, isHighSalary: true }
  })
  console.log('Sample jobs:')
  samples.forEach(j => console.log(`  ${j.title} | ${j.minAnnual}-${j.maxAnnual} ${j.currency} | isHighSalary: ${j.isHighSalary}`))

  await prisma.$disconnect()
}
main()
