// scripts/markVisaSponsorship.ts
// Scans job descriptions and company names to mark visaSponsorship = true.
// Run: npx tsx scripts/markVisaSponsorship.ts
// Run (dry): npx tsx scripts/markVisaSponsorship.ts --dry-run

import { markVisaSponsorshipBatch, markVisaSponsorshipBySource } from '../lib/jobs/markVisaSponsorship'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('[markVisaSponsorship] DRY RUN — no DB writes')

  // 1. Mark jobs from H1B board sources
  await markVisaSponsorshipBySource(['board:h1bvisajobs', 'board:myvisajobs'], dryRun)

  // 2. Scan descriptions for visa keywords
  const { marked, checked } = await markVisaSponsorshipBatch({ dryRun })
  console.log(`\nResult: checked=${checked}, marked=${marked}`)
}

main().catch(console.error)
