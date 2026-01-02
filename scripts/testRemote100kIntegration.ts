// scripts/testRemote100kIntegration.ts
// Quick test of Remote100k scraper with the ingest layer
//
// Run with: npx ts-node scripts/testRemote100kIntegration.ts

import { format as __format } from 'node:util'
import scrapeRemote100k from '../lib/scrapers/remote100k'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function test() {
  __slog('Testing Remote100k scraper integration...')
  __slog('')
  
  try {
    const stats = await scrapeRemote100k()
    
    __slog('')
    __slog('═══════════════════════════════════════════════')
    __slog('  Results')
    __slog('═══════════════════════════════════════════════')
    __slog(`  Created: ${stats.created}`)
    __slog(`  Updated: ${stats.updated}`)
    __slog(`  Upgraded: ${stats.upgraded}`)
    __slog(`  Skipped: ${stats.skipped}`)
    __slog(`  Errors: ${stats.errors}`)
    __slog('═══════════════════════════════════════════════')
    
    if (stats.errors === 0) {
      __slog('')
      __slog('✅ Test passed!')
    } else {
      __slog('')
      __slog('⚠️  Some errors occurred - check logs above')
    }
    
  } catch (err) {
    __serr('❌ Test failed:', err)
    process.exit(1)
  }
}

test()