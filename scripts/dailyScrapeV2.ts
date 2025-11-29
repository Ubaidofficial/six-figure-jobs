// scripts/dailyScrapeV2.ts
// Comprehensive daily scraper - ATS + All Board Scrapers
// Run: npx tsx scripts/dailyScrapeV2.ts

import { PrismaClient } from '@prisma/client'
import { ingestJob } from '../lib/ingest'

// Import existing board scrapers
import scrapeRemoteOK from '../lib/scrapers/remoteok'
import { scrapeWeWorkRemotely } from '../lib/scrapers/weworkremotely'
import { scrapeNodesk } from '../lib/scrapers/nodesk'
import scrapeRemote100k from '../lib/scrapers/remote100k'

const prisma = new PrismaClient()

// ============================================
// ATS SCRAPERS (inline for speed)
// ============================================

async function scrapeGreenhouse(slug: string): Promise<any[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, {
    headers: { 'User-Agent': 'SixFigureJobs/1.0' },
    signal: AbortSignal.timeout(15000)
  })
  if (!res.ok) return []
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

async function scrapeLever(slug: string): Promise<any[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
    headers: { 'User-Agent': 'SixFigureJobs/1.0' },
    signal: AbortSignal.timeout(15000)
  })
  if (!res.ok) return []
  const jobs = await res.json()
  return (jobs || []).map((job: any) => ({
    externalId: `lever-${job.id}`,
    title: job.text,
    location: job.categories?.location || 'Remote',
    url: job.hostedUrl || job.applyUrl,
    description: job.descriptionPlain || job.description || '',
    postedAt: job.createdAt ? new Date(job.createdAt) : new Date(),
  }))
}

async function scrapeAshby(slug: string): Promise<any[]> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, {
    headers: { 'User-Agent': 'SixFigureJobs/1.0' },
    signal: AbortSignal.timeout(15000)
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.jobs || []).map((job: any) => ({
    externalId: `ashby-${job.id}`,
    title: job.title,
    location: job.location || 'Remote',
    url: `https://jobs.ashbyhq.com/${slug}/${job.id}`,
    description: job.descriptionHtml || job.descriptionPlain || '',
    postedAt: new Date(),
  }))
}

// ============================================
// ATS JOB INGEST
// ============================================

async function ingestATSJob(job: any, companyName: string, companyWebsite: string | null, source: string) {
  return ingestJob({
    externalId: job.externalId,
    title: job.title,
    rawCompanyName: companyName,
    companyWebsiteUrl: companyWebsite,
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
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('🚀 Starting Comprehensive Daily Scrape')
  console.log('='.repeat(60) + '\n')

  let totalNew = 0, totalUpdated = 0

  // ─────────────────────────────────────────────────────────────
  // PART 1: ATS Companies (Greenhouse, Lever, Ashby)
  // ─────────────────────────────────────────────────────────────
  console.log('━━━ PART 1: ATS Companies ━━━\n')
  
  const companies = await prisma.company.findMany({
    where: { atsUrl: { not: null } },
    select: { id: true, name: true, slug: true, atsUrl: true, website: true }
  })

  const ghCount = companies.filter(c => c.atsUrl?.includes('greenhouse')).length
  const leverCount = companies.filter(c => c.atsUrl?.includes('lever')).length
  const ashbyCount = companies.filter(c => c.atsUrl?.includes('ashby')).length
  
  console.log(`Found ${companies.length} ATS companies: ${ghCount} Greenhouse, ${leverCount} Lever, ${ashbyCount} Ashby\n`)

  for (const company of companies) {
    const slug = company.atsUrl!.split('/').pop()!
    let jobs: any[] = []
    let source = ''

    try {
      if (company.atsUrl!.includes('greenhouse')) {
        jobs = await scrapeGreenhouse(slug)
        source = 'ats:greenhouse'
      } else if (company.atsUrl!.includes('lever')) {
        jobs = await scrapeLever(slug)
        source = 'ats:lever'
      } else if (company.atsUrl!.includes('ashby')) {
        jobs = await scrapeAshby(slug)
        source = 'ats:ashby'
      } else continue

      let newJobs = 0, updated = 0
      for (const job of jobs) {
        const result = await ingestATSJob(job, company.name, company.website, source)
        if (result.status === 'created') newJobs++
        else if (result.status === 'updated' || result.status === 'upgraded') updated++
      }

      if (jobs.length > 0) {
        console.log(`  ✓ ${company.name}: ${jobs.length} jobs (${newJobs} new)`)
      }
      totalNew += newJobs
      totalUpdated += updated

    } catch (err: any) {
      console.error(`  ✗ ${company.name}: ${err.message?.slice(0, 50)}`)
    }
  }

  console.log(`\n  ATS Total: ${totalNew} new, ${totalUpdated} updated\n`)

  // ─────────────────────────────────────────────────────────────
  // PART 2: Board Scrapers
  // ─────────────────────────────────────────────────────────────
  console.log('━━━ PART 2: Job Boards ━━━\n')

  // RemoteOK
  try {
    console.log('  Scraping RemoteOK...')
    const result = await scrapeRemoteOK()
    console.log(`  ✓ RemoteOK: ${result.jobsNew} new, ${result.jobsUpdated} updated`)
    totalNew += result.jobsNew
    totalUpdated += result.jobsUpdated
  } catch (err: any) {
    console.error(`  ✗ RemoteOK: ${err.message?.slice(0, 50)}`)
  }

  // WeWorkRemotely
  try {
    console.log('  Scraping WeWorkRemotely...')
    const jobs = await scrapeWeWorkRemotely()
    console.log(`  ✓ WeWorkRemotely: ${jobs.length} jobs found`)
  } catch (err: any) {
    console.error(`  ✗ WeWorkRemotely: ${err.message?.slice(0, 50)}`)
  }

  // Nodesk (Puppeteer - may be slow)
  try {
    console.log('  Scraping Nodesk (Puppeteer)...')
    const jobs = await scrapeNodesk()
    console.log(`  ✓ Nodesk: ${jobs.length} jobs found`)
  } catch (err: any) {
    console.error(`  ✗ Nodesk: ${err.message?.slice(0, 50)}`)
  }

  // Remote100k (Puppeteer - this is our main scraper)
  try {
    console.log('  Scraping Remote100k (Puppeteer)...')
    const result = await scrapeRemote100k()
    console.log(`  ✓ Remote100k: ${result.created} new, ${result.updated} updated`)
    totalNew += result.created
    totalUpdated += result.updated
  } catch (err: any) {
    console.error(`  ✗ Remote100k: ${err.message?.slice(0, 50)}`)
  }

  // ─────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log(`✅ COMPLETE: ${totalNew} new jobs, ${totalUpdated} updated`)
  console.log('='.repeat(60) + '\n')

  // Final counts
  const totalJobs = await prisma.job.count({ where: { isExpired: false } })
  const highSalaryJobs = await prisma.job.count({ where: { isExpired: false, isHighSalary: true } })
  const totalCompanies = await prisma.company.count()
  const atsCompanies = await prisma.company.count({ where: { atsUrl: { not: null } } })
  
  console.log('📊 Database Summary:')
  console.log(`   ${totalJobs.toLocaleString()} active jobs (${highSalaryJobs.toLocaleString()} high-salary)`)
  console.log(`   ${totalCompanies.toLocaleString()} companies (${atsCompanies} with ATS)\n`)

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
