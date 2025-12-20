import scrapeWeWorkRemotely, { fetchWeWorkRemotelyJobs } from '../lib/scrapers/weworkremotely'
import scrapeNodesk, { fetchNodeskJobs } from '../lib/scrapers/nodesk'

async function main() {
  console.log('Testing job board scrapers...\n')
  
  console.log('=== WeWorkRemotely ===')
  const wwrJobs = await fetchWeWorkRemotelyJobs()
  console.log('Sample:', wwrJobs[0]?.title, '-', wwrJobs[0]?.rawCompanyName)
  console.log('Stats:', await scrapeWeWorkRemotely())
  
  console.log('\n=== Nodesk ===')
  const nodeskJobs = await fetchNodeskJobs()
  console.log('Sample:', nodeskJobs[0]?.title, '-', nodeskJobs[0]?.rawCompanyName)
  console.log('Stats:', await scrapeNodesk())
  
  console.log('\nTotal: WWR=' + wwrJobs.length + ', Nodesk=' + nodeskJobs.length)
}

main()
