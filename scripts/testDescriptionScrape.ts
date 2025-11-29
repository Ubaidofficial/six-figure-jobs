import { scrapeGreenhouse } from '../lib/scrapers/ats/greenhouse'

async function test() {
  console.log('\n🔍 Testing Greenhouse scrape...\n')
  
  const jobs = await scrapeGreenhouse('https://boards.greenhouse.io/openai')
  
  if (jobs.length > 0) {
    const job = jobs[0]
    console.log('Title:', job.title)
    console.log('Has raw object?', !!job.raw)
    console.log('Raw keys:', job.raw ? Object.keys(job.raw).join(', ') : 'none')
    
    if (job.raw) {
      console.log('Has content?', !!(job.raw as any).content)
      console.log('Has description?', !!(job.raw as any).description)
      
      const content = (job.raw as any).content
      if (content) {
        console.log('Content length:', content.length)
        console.log('First 200 chars:', content.substring(0, 200))
      }
    }
  } else {
    console.log('No jobs returned!')
  }
}

test().catch(console.error)
