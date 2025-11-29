// scripts/dailyScrapeV2.ts
// Comprehensive daily scraper - ATS + All Board Scrapers
// Run: npx tsx scripts/dailyScrapeV2.ts

import { PrismaClient } from '@prisma/client'
import { ingestJob } from '../lib/ingest'

// 1. Core Board Scrapers (Already working)
import scrapeRemoteOK from '../lib/scrapers/remoteok'
import { scrapeWeWorkRemotely } from '../lib/scrapers/weworkremotely'
import { scrapeNodesk } from '../lib/scrapers/nodesk'
import scrapeRemote100k from '../lib/scrapers/remote100k'

// 2. NEW: Activate Dormant Scrapers
// UPDATED: Using named imports { } to fix "no default export" errors
import { scrapeWorkday } from '../lib/scrapers/workday'
import { scrapeYCombinator } from '../lib/scrapers/ycombinator'
import { scrapeRemotive } from '../lib/scrapers/remotive'
import scrapeRemoteRocketship from '../lib/scrapers/remoterocketship' // Fixed: Default import
import scrapeGenericSources from '../lib/scrapers/generic'

const prisma = new PrismaClient()

// ============================================
// ATS SCRAPERS (Inline Helpers)
// ============================================

async function scrapeGreenhouse(slug: string): Promise<any[]> {
  try {
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
  } catch (e) { return [] }
}

async function scrapeLever(slug: string): Promise<any[]> {
  try {
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
  } catch (e) { return [] }
}

async function scrapeAshby(slug: string): Promise<any[]> {
  try {
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
  } catch (e) { return [] }
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
  console.log('🚀 Starting Comprehensive Daily Scrape (V2)')
  console.log('='.repeat(60) + '\n')

  let totalNew = 0, totalUpdated = 0

  // ─────────────────────────────────────────────────────────────
  // PART 1: ATS Companies (Greenhouse, Lever, Ashby)
  // ─────────────────────────────────────────────────────────────
  console.log('━━━ PART 1: ATS Companies ━━━\n')
  
  const companies = await prisma.company.findMany({
    where: { atsUrl: { not: null } },
    select: { id: true, name: true, slug: true, atsUrl: true, website: true, atsProvider: true, atsSlug: true }
  })

  // Group stats
  const ghCount = companies.filter(c => c.atsProvider === 'greenhouse' || c.atsUrl?.includes('greenhouse')).length
  const leverCount = companies.filter(c => c.atsProvider === 'lever' || c.atsUrl?.includes('lever')).length
  const ashbyCount = companies.filter(c => c.atsProvider === 'ashby' || c.atsUrl?.includes('ashby')).length
  const workdayCount = companies.filter(c => c.atsProvider === 'workday' || c.atsUrl?.includes('myworkdayjobs')).length
  
  console.log(`Found ${companies.length} ATS companies: ${ghCount} Greenhouse, ${leverCount} Lever, ${ashbyCount} Ashby, ${workdayCount} Workday\n`)

  for (const company of companies) {
    // Prefer explicitly saved slug, fallback to extracting from URL
    const slug = company.atsSlug || company.atsUrl?.split('/').pop() || ''
    if (!slug) continue

    let jobs: any[] = []
    let source = ''

    // Normalize provider check
    const provider = company.atsProvider || ''
    const url = company.atsUrl || ''

    try {
      if (provider === 'greenhouse' || url.includes('greenhouse')) {
        jobs = await scrapeGreenhouse(slug)
        source = 'ats:greenhouse'
      } else if (provider === 'lever' || url.includes('lever')) {
        jobs = await scrapeLever(slug)
        source = 'ats:lever'
      } else if (provider === 'ashby' || url.includes('ashby')) {
        jobs = await scrapeAshby(slug)
        source = 'ats:ashby'
      } else if (provider === 'workday' || url.includes('myworkdayjobs')) {
        // Workday requires the full URL to scrape
        jobs = await scrapeWorkday(url) 
        source = 'ats:workday'
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

  // ─────────────────────────────────────────────────────────────
  // PART 2: Job Boards
  // ─────────────────────────────────────────────────────────────
  console.log('\n━━━ PART 2: Job Boards ━━━\n')

  // --- Remote100k (Puppeteer) ---
  try {
    console.log('  Scraping Remote100k (Puppeteer)...')
    const result = await scrapeRemote100k()
    console.log(`  ✓ Remote100k: ${result.created} new, ${result.updated} updated`)
    totalNew += result.created
    totalUpdated += result.updated
  } catch (err: any) {
    console.error(`  ✗ Remote100k: ${err.message?.slice(0, 50)}`)
  }

  // --- RemoteOK ---
  try {
    console.log('  Scraping RemoteOK...')
    const result = await scrapeRemoteOK()
    console.log(`  ✓ RemoteOK: ${result.jobsNew} new, ${result.jobsUpdated} updated`)
    totalNew += result.jobsNew
    totalUpdated += result.jobsUpdated
  } catch (err: any) {
    console.error(`  ✗ RemoteOK: ${err.message?.slice(0, 50)}`)
  }

  // --- WeWorkRemotely ---
  try {
    console.log('  Scraping WeWorkRemotely...')
    const jobs = await scrapeWeWorkRemotely()
    console.log(`  ✓ WeWorkRemotely: ${jobs.length} jobs found`)
  } catch (err: any) {
    console.error(`  ✗ WeWorkRemotely: ${err.message?.slice(0, 50)}`)
  }

  // --- Nodesk ---
  try {
    console.log('  Scraping Nodesk...')
    const jobs = await scrapeNodesk()
    console.log(`  ✓ Nodesk: ${jobs.length} jobs found`)
  } catch (err: any) {
    console.error(`  ✗ Nodesk: ${err.message?.slice(0, 50)}`)
  }

  // ─────────────────────────────────────────────────────────────
  // PART 3: New Boards (Previously Inactive)
  // ─────────────────────────────────────────────────────────────
  console.log('\n━━━ PART 3: Additional Sources ━━━\n')

  // --- Generic Company Pages ---
  try {
    console.log('  Scraping Generic Career Pages...')
    const result = await scrapeGenericSources()
    console.log(`  ✓ Generic Sources: ${result.created} new, ${result.updated} updated`)
    totalNew += result.created
    totalUpdated += result.updated
  } catch (err: any) {
    console.error(`  ✗ Generic Sources: ${err.message?.slice(0, 50)}`)
  }

  // --- YCombinator ---
  try {
    console.log('  Scraping YCombinator...')
    const result = await scrapeYCombinator() 
    console.log(`  ✓ YCombinator: Scrape complete`)
  } catch (err: any) {
    console.error(`  ✗ YCombinator: ${err.message?.slice(0, 50)}`)
  }

  // --- Remotive ---
  try {
    console.log('  Scraping Remotive...')
    const result = await scrapeRemotive()
    console.log(`  ✓ Remotive: Scrape complete`)
  } catch (err: any) {
    console.error(`  ✗ Remotive: ${err.message?.slice(0, 50)}`)
  }

  // --- Remote Rocketship ---
  try {
    console.log('  Scraping Remote Rocketship...')
    const result = await scrapeRemoteRocketship()
    console.log(`  ✓ Remote Rocketship: Scrape complete`)
  } catch (err: any) {
    console.error(`  ✗ Remote Rocketship: ${err.message?.slice(0, 50)}`)
  }

  // ─────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log(`✅ COMPLETE`)
  console.log('='.repeat(60) + '\n')

  const totalJobs = await prisma.job.count({ where: { isExpired: false } })
  const highSalaryJobs = await prisma.job.count({ where: { isExpired: false, isHighSalary: true } })
  const totalCompanies = await prisma.company.count()
  
  console.log('📊 Database Summary:')
  console.log(`   ${totalJobs.toLocaleString()} active jobs (${highSalaryJobs.toLocaleString()} high-salary)`)
  console.log(`   ${totalCompanies.toLocaleString()} companies`)

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})