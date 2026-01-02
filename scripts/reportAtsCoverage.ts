import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


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

  __slog('ATS Coverage')
  __slog('============')
  __slog(`Total companies           : ${total}`)
  __slog(`With ATS provider/url     : ${withAts}`)
  __slog(`Missing ATS metadata      : ${missing}`)
  __slog('')
  __slog('Counts by provider:')
  grouped
    .filter((g) => g.atsProvider)
    .sort((a, b) => (b._count || 0) - (a._count || 0))
    .forEach((g) => {
      __slog(`  ${g.atsProvider?.padEnd(16)} ${g._count}`)
    })

  if (missingSamples.length) {
    __slog('\nSample companies missing ATS:')
    missingSamples.forEach((c) => {
      __slog(`  - ${c.name}${c.website ? ` (${c.website})` : ''}`)
    })
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  __serr(err)
  process.exit(1)
})
