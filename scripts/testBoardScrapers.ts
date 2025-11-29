import { scrapeWeWorkRemotely } from '../lib/scrapers/weworkremotely'
import scrapeNodesk from '../lib/scrapers/nodesk'

async function main() {
  console.log('Testing job board scrapers...\n')
  
  console.log('=== WeWorkRemotely ===')
  const wwrJobs = await scrapeWeWorkRemotely()
  console.log('Sample:', wwrJobs[0]?.title, '-', wwrJobs[0]?.rawCompanyName)
  
  console.log('\n=== Nodesk ===')
  const nodeskJobs = await scrapeNodesk()
  console.log('Sample:', nodeskJobs[0]?.title, '-', nodeskJobs[0]?.rawCompanyName)
  
  console.log('\nTotal: WWR=' + wwrJobs.length + ', Nodesk=' + nodeskJobs.length)
}

main()
