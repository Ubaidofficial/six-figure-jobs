const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const total = await prisma.job.count()
  const active = await prisma.job.count({ where: { isExpired: false } })
  const companies = await prisma.job.findMany({
    where: { isExpired: false },
    distinct: ['companyId'],
    select: { companyId: true }
  })
  
  const recent = await prisma.job.findMany({
    where: { isExpired: false },
    orderBy: { postedAt: 'desc' },
    take: 5,
    select: { title: true, postedAt: true, createdAt: true }
  })

  console.log('Total jobs:', total)
  console.log('Active jobs:', active)
  console.log('Active companies:', companies.length)
  console.log('\nRecent jobs:')
  recent.forEach(j => {
    const date = j.postedAt || j.createdAt
    console.log(`  ${j.title} - ${date?.toISOString().split('T')[0] || 'unknown'}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
