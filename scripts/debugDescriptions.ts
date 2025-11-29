import { scrapeGreenhouse } from '../lib/scrapers/ats/greenhouse'
import { upsertJobsForCompanyFromAts } from '../lib/jobs/ingestFromAts'
import { prisma } from '../lib/prisma'

async function debug() {
  console.log('\n🔍 DEBUGGING DESCRIPTION FLOW...\n')
  
  // 1. Get Anthropic company
  const company = await prisma.company.findFirst({
    where: { slug: 'anthropic' }
  })
  
  if (!company) {
    console.log('❌ Anthropic not found')
    return
  }
  
  console.log('✅ Found company:', company.name)
  console.log('ATS URL:', company.atsUrl)
  
  // 2. Scrape raw jobs
  console.log('\n📥 Scraping jobs...')
  const jobs = await scrapeGreenhouse(company.atsUrl!)
  
  if (jobs.length === 0) {
    console.log('❌ No jobs scraped')
    return
  }
  
  const job = jobs[0]
  console.log('\n📋 First job scraped:')
  console.log('Title:', job.title)
  console.log('Has raw?', !!job.raw)
  console.log('Raw content length:', (job.raw as any)?.content?.length || 0)
  
  // 3. Ingest (this should save to DB)
  console.log('\n💾 Ingesting job...')
  await upsertJobsForCompanyFromAts(company, jobs.slice(0, 1))
  
  // 4. Check DB
  console.log('\n🔍 Checking DB...')
  const dbJob = await prisma.job.findFirst({
    where: {
      title: job.title,
      companyId: company.id
    }
  })
  
  if (dbJob) {
    console.log('✅ Job in DB')
    console.log('descriptionHtml length:', dbJob.descriptionHtml?.length || 0)
    
    if (!dbJob.descriptionHtml) {
      console.log('\n❌ DESCRIPTION WAS LOST IN PIPELINE!')
    } else {
      console.log('\n✅ DESCRIPTION SAVED!')
      console.log('First 200 chars:', dbJob.descriptionHtml.substring(0, 200))
    }
  } else {
    console.log('❌ Job not found in DB')
  }
}

debug()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
