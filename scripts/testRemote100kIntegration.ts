// scripts/testRemote100kIntegration.ts
// Quick test of Remote100k scraper with the ingest layer
//
// Run with: npx ts-node scripts/testRemote100kIntegration.ts

import scrapeRemote100k from '../lib/scrapers/remote100k'

async function test() {
  console.log('Testing Remote100k scraper integration...')
  console.log('')
  
  try {
    const stats = await scrapeRemote100k()
    
    console.log('')
    console.log('═══════════════════════════════════════════════')
    console.log('  Results')
    console.log('═══════════════════════════════════════════════')
    console.log(`  Created: ${stats.created}`)
    console.log(`  Updated: ${stats.updated}`)
    console.log(`  Upgraded: ${stats.upgraded}`)
    console.log(`  Skipped: ${stats.skipped}`)
    console.log(`  Errors: ${stats.errors}`)
    console.log('═══════════════════════════════════════════════')
    
    if (stats.errors === 0) {
      console.log('')
      console.log('✅ Test passed!')
    } else {
      console.log('')
      console.log('⚠️  Some errors occurred - check logs above')
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err)
    process.exit(1)
  }
}

test()