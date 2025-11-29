import { PrismaClient } from '@prisma/client'
import { scrapeGreenhouse } from '../lib/scrapers/ats/greenhouse'

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
    console.log(`\nTesting ${company.name} (${company.atsUrl})...`)
    
    const jobs = await scrapeGreenhouse(company.atsUrl!)
    
    if (jobs.length > 0) {
      console.log(`✅ SUCCESS! Got ${jobs.length} jobs`)
      console.log('Testing first job...')
      
      const job = jobs[0]
      const content = (job.raw as any)?.content
      
      console.log('Title:', job.title)
      console.log('Has content?', !!content)
      
      if (content) {
        console.log('Content length:', content.length)
        console.log('First 200 chars:', content.substring(0, 200))
        break
      }
    }
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
