// scripts/repairAggregatorApplyUrls.ts
// Repairs existing jobs whose public apply URL points at an aggregator we
// scraped from (e.g. builtin.com) — the ingest guard prevents new ones, this
// cleans up the backlog. Nulls the bad apply URL so the apply button is hidden
// rather than sending users to a competitor board.
//
//   dry-run (default):  npx tsx scripts/repairAggregatorApplyUrls.ts
//   apply:              npx tsx scripts/repairAggregatorApplyUrls.ts --apply

import { prisma } from '../lib/prisma'
import { isAggregatorApplyUrl } from '../lib/jobs/applyUrl'

async function main() {
  const apply = process.argv.includes('--apply')

  const jobs = await prisma.job.findMany({
    where: { isExpired: false, applyUrl: { not: null } },
    select: { id: true, title: true, source: true, applyUrl: true },
  })

  const bad = jobs.filter((j) => isAggregatorApplyUrl(j.applyUrl))
  const bySource: Record<string, number> = {}
  for (const j of bad) bySource[j.source || 'unknown'] = (bySource[j.source || 'unknown'] || 0) + 1

  console.log(`[repair] scanned ${jobs.length} active jobs with an apply URL`)
  console.log(`[repair] aggregator apply URLs found: ${bad.length}`)
  console.log(`[repair] by source: ${JSON.stringify(bySource)}`)
  bad.slice(0, 10).forEach((j) => console.log(`   - ${j.source} :: ${j.applyUrl}`))

  if (!apply) {
    console.log('\n[repair] DRY RUN — re-run with --apply to null these apply URLs.')
    await prisma.$disconnect()
    return
  }

  const result = await prisma.job.updateMany({
    where: { id: { in: bad.map((j) => j.id) } },
    data: { applyUrl: null },
  })
  console.log(`\n[repair] APPLIED — nulled applyUrl on ${result.count} jobs.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
