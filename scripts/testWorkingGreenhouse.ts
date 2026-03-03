import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { scrapeGreenhouse } from '../lib/scrapers/ats/greenhouse'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

async function test() {
  const companies = await prisma.company.findMany({
    where: {
      atsProvider: 'greenhouse',
      atsUrl: { not: null }
    },
    take: 5
  })
  
  for (const company of companies) {
    __slog(`\nTesting ${company.name} (${company.atsUrl})...`)
    
    const jobs = await scrapeGreenhouse(company.atsUrl!)
    
    if (jobs.length > 0) {
      __slog(`✅ SUCCESS! Got ${jobs.length} jobs`)
      __slog('Testing first job...')
      
      const job = jobs[0]
      const content = (job.raw as any)?.content
      
      __slog('Title:', job.title)
      __slog('Has content?', !!content)
      
      if (content) {
        __slog('Content length:', content.length)
        __slog('First 200 chars:', content.substring(0, 200))
        break
      }
    }
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
