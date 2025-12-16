import { prisma } from '../lib/prisma'
import { normalizeLocationRaw, hasMultiLocationSignals } from '../lib/location/locationRaw'

async function main() {
  const rows = await prisma.job.findMany({
    where: { isExpired: false, locationRaw: { not: null } },
    select: { id: true, source: true, locationRaw: true },
    take: 5000,
  })

  let wouldChangeMulti = 0

  for (const r of rows) {
    const lr = normalizeLocationRaw(r.locationRaw)
    const multi = hasMultiLocationSignals(lr)

    // crude heuristic: old behavior treated "3 commas" as multi
    const oldMulti = /(.+,.+,.+)/.test((r.locationRaw ?? '').toLowerCase())

    if (multi !== oldMulti) wouldChangeMulti++
  }

  console.log({ sampled: rows.length, wouldChangeMulti })
}

main().finally(() => prisma.$disconnect())
