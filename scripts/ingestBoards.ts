import { format as __format } from 'node:util'
import scrapeWeWorkRemotely, { fetchWeWorkRemotelyJobs } from '../lib/scrapers/weworkremotely'
import { ingestJobs } from '../lib/ingest'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function main() {
  __slog('Ingesting jobs from job boards...\n')
  
  __slog('=== WeWorkRemotely ===')
  const wwrJobs = await fetchWeWorkRemotelyJobs()
  
  if (wwrJobs.length > 0) {
    const result = await ingestJobs(wwrJobs)
    __slog('Ingested:', result.created, 'new,', result.updated, 'updated')
  }
  const stats = await scrapeWeWorkRemotely()
  __slog('Scraper stats:', stats)
  
  __slog('\nDone!')
}

main()
