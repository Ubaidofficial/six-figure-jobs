// Read-only: why do companies fail the publishing gate, and how many would qualify under "5+ live jobs"?
// Writes nothing. Run through the "company publishing report" workflow, or locally with DATABASE_URL set:
//   npx tsx scripts/company-publishing-report.ts

import { prisma } from '../lib/prisma'
import { buildCompanyPublishingManifestData } from '../lib/seo/companyPublishing'

async function main() {
  const manifest = await buildCompanyPublishingManifestData(new Date())
  const all = manifest.candidates
  const withJobs = all.filter((c) => c.liveJobs >= 5)

  const tally = (rows: typeof all) => {
    const m = new Map<string, number>()
    for (const c of rows) for (const r of c.reasons) m.set(r, (m.get(r) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }

  console.log(`companies evaluated: ${all.length}`)
  console.log(`ready (pass every gate): ${manifest.readyCount}, unlocked by drip so far: ${manifest.unlockedCount}`)
  console.log(`with >= 5 live jobs: ${withJobs.length}`)
  console.log(`with >= 5 live jobs and ready: ${withJobs.filter((c) => c.ready).length}`)
  console.log('\nBlocking reasons among companies with >= 5 live jobs:')
  for (const [reason, n] of tally(withJobs)) console.log(`  ${String(n).padStart(5)}  ${reason}`)
  console.log('\nBlocking reasons among all companies:')
  for (const [reason, n] of tally(all)) console.log(`  ${String(n).padStart(5)}  ${reason}`)

  console.log('\nTop 25 by live jobs:')
  for (const c of [...all].sort((a, b) => b.liveJobs - a.liveJobs).slice(0, 25)) {
    console.log(
      `  ${c.slug.padEnd(32)} live=${String(c.liveJobs).padStart(4)} salary=${String(c.salaryBackedJobs).padStart(4)} roles=${c.roleDiversity} meta=${c.metadataSignals} ready=${c.ready} ${c.reasons.join(',')}`,
    )
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
