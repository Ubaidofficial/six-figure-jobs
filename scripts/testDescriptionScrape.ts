import { format as __format } from 'node:util'
import { scrapeGreenhouse } from '../lib/scrapers/ats/greenhouse'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function test() {
  __slog('\n🔍 Testing Greenhouse scrape...\n')
  
  const jobs = await scrapeGreenhouse('https://boards.greenhouse.io/openai')
  
  if (jobs.length > 0) {
    const job = jobs[0]
    __slog('Title:', job.title)
    __slog('Has raw object?', !!job.raw)
    __slog('Raw keys:', job.raw ? Object.keys(job.raw).join(', ') : 'none')
    
    if (job.raw) {
      __slog('Has content?', !!(job.raw as any).content)
      __slog('Has description?', !!(job.raw as any).description)
      
      const content = (job.raw as any).content
      if (content) {
        __slog('Content length:', content.length)
        __slog('First 200 chars:', content.substring(0, 200))
      }
    }
  } else {
    __slog('No jobs returned!')
  }
}

test().catch(console.error)
