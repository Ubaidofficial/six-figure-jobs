import { prisma } from '../lib/prisma'
import { buildWhere } from '../lib/jobs/queryJobs'

async function main() {
  const baseWhere = buildWhere({} as any)

  const totalWithCity = await prisma.job.count({
    where: { ...baseWhere, citySlug: { not: null } },
  })

  const rows = await prisma.job.groupBy({
    by: ['citySlug'],
    where: { ...baseWhere, citySlug: { not: null } },
    _count: { _all: true },
  })

  console.log(`[city-top] total with citySlug: ${totalWithCity}`)
  const sorted = rows
    .filter((row) => row.citySlug)
    .sort((a, b) => (b._count?._all ?? 0) - (a._count?._all ?? 0))
    .slice(0, 20)

  for (const row of sorted) {
    if (!row.citySlug) continue
    console.log(`[city-top] ${row.citySlug}: ${row._count._all}`)
  }
}

main().catch((err) => {
  console.error('[city-top] error:', err)
  process.exitCode = 1
})
