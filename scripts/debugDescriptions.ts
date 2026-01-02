import { format as __format } from 'node:util'
import { scrapeGreenhouse } from '../lib/scrapers/ats/greenhouse'
import { upsertJobsForCompanyFromAts } from '../lib/jobs/ingestFromAts'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function debug() {
  __slog('\n🔍 DEBUGGING DESCRIPTION FLOW...\n')
  
  // 1. Get Anthropic company
  const company = await prisma.company.findFirst({
    where: { slug: 'anthropic' }
  })
  
  if (!company) {
    __slog('❌ Anthropic not found')
    return
  }
  
  __slog('✅ Found company:', company.name)
  __slog('ATS URL:', company.atsUrl)
  
  // 2. Scrape raw jobs
  __slog('\n📥 Scraping jobs...')
  const jobs = await scrapeGreenhouse(company.atsUrl!)
  
  if (jobs.length === 0) {
    __slog('❌ No jobs scraped')
    return
  }
  
  const job = jobs[0]
  __slog('\n📋 First job scraped:')
  __slog('Title:', job.title)
  __slog('Has raw?', !!job.raw)
  __slog('Raw content length:', (job.raw as any)?.content?.length || 0)
  
  // 3. Ingest (this should save to DB)
  __slog('\n💾 Ingesting job...')
  await upsertJobsForCompanyFromAts(company, jobs.slice(0, 1))
  
  // 4. Check DB
  __slog('\n🔍 Checking DB...')
  const dbJob = await prisma.job.findFirst({
    where: {
      title: job.title,
      companyId: company.id
    }
  })
  
  if (dbJob) {
    __slog('✅ Job in DB')
    __slog('descriptionHtml length:', dbJob.descriptionHtml?.length || 0)
    
    if (!dbJob.descriptionHtml) {
      __slog('\n❌ DESCRIPTION WAS LOST IN PIPELINE!')
    } else {
      __slog('\n✅ DESCRIPTION SAVED!')
      __slog('First 200 chars:', dbJob.descriptionHtml.substring(0, 200))
    }
  } else {
    __slog('❌ Job not found in DB')
  }
}

debug()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
