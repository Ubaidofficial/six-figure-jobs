import { scrapeWeWorkRemotely } from '../lib/scrapers/weworkremotely'
import { ingestJobs } from '../lib/ingest'

async function main() {
  console.log('Ingesting jobs from job boards...\n')
  
  console.log('=== WeWorkRemotely ===')
  const wwrJobs = await scrapeWeWorkRemotely()
  
  if (wwrJobs.length > 0) {
    const result = await ingestJobs(wwrJobs)
    console.log('Ingested:', result.created, 'new,', result.updated, 'updated')
  }
  
  console.log('\nDone!')
}

main()
