import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Count jobs by source
  const sources = await prisma.job.groupBy({
    by: ['source'],
    _count: true,
    where: { isExpired: false },
    orderBy: { _count: { source: 'desc' } }
  })

  console.log('Jobs by source:')
  console.log('=' .repeat(50))
  sources.forEach(s => {
    console.log(`  ${s.source || 'unknown'}: ${s._count}`)
  })

  const total = sources.reduce((sum, s) => sum + s._count, 0)
  console.log(`\nTotal active jobs: ${total}`)

  await prisma.$disconnect()
}
main()
