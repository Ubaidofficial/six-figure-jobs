import { PrismaClient } from '@prisma/client'
import { scrapeAshby } from '../lib/scrapers/ashby.js'
import { ingestJob } from '../lib/ingest/index.js'
import { scrapeWeWorkRemotely } from '../lib/scrapers/weworkremotely.js'
import { scrapeNodesk } from '../lib/scrapers/nodesk.js'
import scrapeRemoteOK from '../lib/scrapers/remoteok.js'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// Greenhouse API scraper
async function scrapeGreenhouse(slug: string): Promise<any[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, {
    headers: { 'User-Agent': 'Remote100kBot/1.0' },
    signal: AbortSignal.timeout(15000)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data.jobs || []).map((job: any) => ({
    externalId: `gh-${job.id}`,
    title: job.title,
    location: job.location?.name || 'Remote',
    url: job.absolute_url,
    description: job.content || '',
    postedAt: job.updated_at ? new Date(job.updated_at) : new Date(),
  }))
}

// Lever API scraper
async function scrapeLever(slug: string): Promise<any[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
    headers: { 'User-Agent': 'Remote100kBot/1.0' },
    signal: AbortSignal.timeout(15000)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const jobs = await res.json()
  return (jobs || []).map((job: any) => ({
    externalId: `lever-${job.id}`,
    title: job.text,
    location: job.categories?.location || 'Remote',
    url: job.hostedUrl || job.applyUrl,
    description: job.descriptionPlain || '',
    postedAt: job.createdAt ? new Date(job.createdAt) : new Date(),
  }))
}

// Ashby API scraper  
async function scrapeAshbyAPI(slug: string): Promise<any[]> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, {
    headers: { 'User-Agent': 'Remote100kBot/1.0' },
    signal: AbortSignal.timeout(15000)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data.jobs || []).map((job: any) => ({
    externalId: `ashby-${job.id}`,
    title: job.title,
    location: job.location || 'Remote',
    url: `https://jobs.ashbyhq.com/${slug}/${job.id}`,
    description: job.descriptionPlain || '',
    postedAt: job.publishedAt ? new Date(job.publishedAt) : new Date(),
  }))
}

async function main() {
  const startTime = Date.now()
  const failures: any[] = []
  
  console.log('═══════════════════════════════════════════════')
  console.log('  🚀 Starting Daily Scrape')
  console.log('═══════════════════════════════════════════════\n')

  const companies = await prisma.company.findMany({
    where: { atsUrl: { not: null } },
    orderBy: { jobCount: 'desc' }
  })

  const ghCount = companies.filter(c => c.atsUrl?.includes('greenhouse')).length
  const leverCount = companies.filter(c => c.atsUrl?.includes('lever')).length
  const ashbyCount = companies.filter(c => c.atsUrl?.includes('ashby')).length
  
  console.log(`Found ${companies.length} companies: ${ghCount} Greenhouse, ${leverCount} Lever, ${ashbyCount} Ashby\n`)

  let scraped = 0, failed = 0, totalNew = 0, totalUpdated = 0

  console.log('── Scraping ATS Jobs ──')
  
  for (const company of companies) {
    if (!company.atsUrl) continue
    const slug = company.atsUrl.split('/').pop() || ''
    
    try {
      let jobs: any[] = []
      let source = ''
      
      if (company.atsUrl.includes('greenhouse')) {
        jobs = await scrapeGreenhouse(slug)
        source = 'ats:greenhouse'
      } else if (company.atsUrl.includes('lever')) {
        jobs = await scrapeLever(slug)
        source = 'ats:lever'
      } else if (company.atsUrl.includes('ashby')) {
        jobs = await scrapeAshbyAPI(slug)
        source = 'ats:ashby'
      } else continue

      let newJobs = 0, updated = 0
      for (const job of jobs) {
        const result = await ingestJob({
          externalId: job.externalId,
          title: job.title,
          rawCompanyName: company.name,
          companyWebsiteUrl: company.website,
          locationText: job.location,
          url: job.url,
          applyUrl: job.url,
          descriptionText: null,
          descriptionHtml: job.description,
          postedAt: job.postedAt,
          source,
          isRemote: /remote/i.test(job.location || ''),
          salaryMin: null, salaryMax: null, salaryCurrency: null, salaryInterval: null,
          employmentType: null
        })
        if (result.status === 'created') newJobs++
        else if (result.status === 'updated') updated++
      }

      totalNew += newJobs
      totalUpdated += updated
      scraped++

      await prisma.company.update({
        where: { id: company.id },
        data: { jobCount: jobs.length, lastScrapedAt: new Date(), scrapeStatus: 'success', scrapeError: null }
      })

      process.stdout.write(`\r📊 Progress: ${scraped}/${companies.length} | New: ${totalNew} | Updated: ${totalUpdated}`)

    } catch (error: any) {
      failed++
      failures.push({ name: company.name, atsUrl: company.atsUrl, error: error.message })
      await prisma.company.update({
        where: { id: company.id },
        data: { scrapeStatus: 'failed', scrapeError: error.message?.slice(0, 500) }
      })
    }
  }

  console.log('\n\n── Expiring Old Jobs ──')
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const expired = await prisma.job.updateMany({
    where: { source: { startsWith: 'ats:' }, isExpired: false, updatedAt: { lt: thirtyDaysAgo } },
    data: { isExpired: true }
  })
  console.log(`🗑️ Marked ${expired.count} jobs as expired\n`)

  console.log('── Scraping Job Boards ──')
  
  try {
    console.log('  RemoteOK...')
    const rok = await scrapeRemoteOK()
    console.log(`    ✓ ${rok.jobsNew} new, ${rok.jobsUpdated} updated`)
  } catch (e: any) { console.log(`    ✗ ${e.message}`) }

  try {
    console.log('  WeWorkRemotely...')
    const wwr = await scrapeWeWorkRemotely()
    let n = 0
    for (const job of wwr) { if ((await ingestJob(job)).status === 'created') n++ }
    console.log(`    ✓ ${wwr.length} jobs (${n} new)`)
  } catch (e: any) { console.log(`    ✗ ${e.message}`) }

  try {
    console.log('  Nodesk...')
    const nd = await scrapeNodesk()
    let n = 0
    for (const job of nd) { if ((await ingestJob(job)).status === 'created') n++ }
    console.log(`    ✓ ${nd.length} jobs (${n} new)`)
  } catch (e: any) { console.log(`    ✗ ${e.message}`) }

  const totalJobs = await prisma.job.count({ where: { isExpired: false } })
  const highSalary = await prisma.job.count({ where: { isExpired: false, OR: [{ salaryMin: { gte: 100000 } }, { salaryMax: { gte: 100000 } }] } })

  const duration = ((Date.now() - startTime) / 60000).toFixed(1)

  const logDir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
  fs.writeFileSync(path.join(logDir, `scrape-${new Date().toISOString().split('T')[0]}.json`), 
    JSON.stringify({ date: new Date().toISOString(), duration, stats: { scraped, failed, totalNew, totalUpdated, totalJobs, highSalary }, failures }, null, 2))

  console.log('\n═══════════════════════════════════════════════')
  console.log('  ✅ Daily Scrape Complete')
  console.log('═══════════════════════════════════════════════')
  console.log(`  Duration: ${duration} min`)
  console.log(`  Companies: ${scraped}/${companies.length} (${failed} failed)`)
  console.log(`  Jobs: ${totalNew} new, ${totalUpdated} updated`)
  console.log('───────────────────────────────────────────────')
  console.log(`  Total Active: ${totalJobs}`)
  console.log(`  High-Salary: ${highSalary}`)
  
  if (failures.length > 0) {
    console.log(`\n⚠️  ${failures.length} failures (see logs)`)
  }
  
  await prisma.$disconnect()
}

main().catch(console.error)
