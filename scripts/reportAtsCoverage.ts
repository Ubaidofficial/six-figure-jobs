import { PrismaClient } from '@prisma/client'

/**
 * Quick ATS coverage report:
 *  - total companies
 *  - counts by atsProvider
 *  - companies missing atsUrl/provider (sample)
 *
 * Run: npx tsx scripts/reportAtsCoverage.ts
 */
async function main() {
  const prisma = new PrismaClient()

  const total = await prisma.company.count()
  const withAts = await prisma.company.count({
    where: { atsUrl: { not: null }, atsProvider: { not: null } },
  })
  const missing = total - withAts

  const grouped = await prisma.company.groupBy({
    by: ['atsProvider'],
    where: { atsProvider: { not: null } },
    _count: true,
  })

  const missingSamples = await prisma.company.findMany({
    where: { atsUrl: null },
    select: { name: true, website: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  console.log('ATS Coverage')
  console.log('============')
  console.log(`Total companies           : ${total}`)
  console.log(`With ATS provider/url     : ${withAts}`)
  console.log(`Missing ATS metadata      : ${missing}`)
  console.log('')
  console.log('Counts by provider:')
  grouped
    .filter((g) => g.atsProvider)
    .sort((a, b) => (b._count || 0) - (a._count || 0))
    .forEach((g) => {
      console.log(`  ${g.atsProvider?.padEnd(16)} ${g._count}`)
    })

  if (missingSamples.length) {
    console.log('\nSample companies missing ATS:')
    missingSamples.forEach((c) => {
      console.log(`  - ${c.name}${c.website ? ` (${c.website})` : ''}`)
    })
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
