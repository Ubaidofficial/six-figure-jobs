import { format as __format } from 'node:util'
import scrapeWeWorkRemotely, { fetchWeWorkRemotelyJobs } from '../lib/scrapers/weworkremotely'
import scrapeNodesk, { fetchNodeskJobs } from '../lib/scrapers/nodesk'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function main() {
  __slog('Testing job board scrapers...\n')
  
  __slog('=== WeWorkRemotely ===')
  const wwrJobs = await fetchWeWorkRemotelyJobs()
  __slog('Sample:', wwrJobs[0]?.title, '-', wwrJobs[0]?.rawCompanyName)
  __slog('Stats:', await scrapeWeWorkRemotely())
  
  __slog('\n=== Nodesk ===')
  const nodeskJobs = await fetchNodeskJobs()
  __slog('Sample:', nodeskJobs[0]?.title, '-', nodeskJobs[0]?.rawCompanyName)
  __slog('Stats:', await scrapeNodesk())
  
  __slog('\nTotal: WWR=' + wwrJobs.length + ', Nodesk=' + nodeskJobs.length)
}

main()
