// lib/scrapers/generic.ts
// Scrapes individual company career pages that don't use a known ATS.
// Relies on "heuristic" scraping (looking for keywords like "Engineer", "Apply", etc.)

import puppeteer, { Page } from 'puppeteer'
import { PrismaClient } from '@prisma/client'
import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'

const prisma = new PrismaClient()

const JOB_TITLE_KEYWORDS = [
  'engineer', 'developer', 'manager', 'designer', 'product', 
  'sales', 'marketing', 'analyst', 'lead', 'head of', 'vp', 
  'director', 'counsel', 'recruiter', 'support', 'success'
]

export default async function scrapeGenericSources() {
  console.log('[Generic] Starting scrape of custom career pages...')
  
  // 1. Find sources marked as generic pages
  const sources = await prisma.companySource.findMany({
    where: { 
      sourceType: 'generic_careers_page',
      isActive: true
    },
    include: { company: true }
  })

  if (sources.length === 0) {
    console.log('[Generic] No generic sources found. Run deepDiscovery.ts to find some.')
    return { created: 0, updated: 0, skipped: 0, errors: 0 }
  }

  console.log(`[Generic] Found ${sources.length} pages to scrape.`)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 }

  try {
    for (const source of sources) {
      console.log(`[Generic] Scraping ${source.company.name} at ${source.url}`)
      const page = await browser.newPage()
      
      try {
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        
        // Scan page for links that look like jobs
        const jobs = await scanPageForJobs(page)
        
        if (jobs.length > 0) {
          console.log(`   -> Found ${jobs.length} potential jobs`)
          
          for (const job of jobs) {
            const result = await ingestJob({
              externalId: Buffer.from(job.url).toString('base64').slice(0, 32),
              title: job.title,
              rawCompanyName: source.company.name,
              companyWebsiteUrl: source.company.website,
              url: job.url,
              applyUrl: job.url,
              source: makeBoardSource('generic_career_page'),
              descriptionText: 'Discovered via generic scrape',
              postedAt: new Date(),
              isRemote: true // Assumption for now, or use keyword detection
            })
            
            if (result.status === 'created') stats.created++
            else if (result.status === 'updated') stats.updated++
            else stats.skipped++
          }
        }

        // Update last scraped time
        await prisma.companySource.update({
          where: { id: source.id },
          data: { lastScrapedAt: new Date(), scrapeStatus: 'success' }
        })

      } catch (err) {
        console.error(`   -> Error scraping ${source.url}:`, err)
        stats.errors++
        await prisma.companySource.update({
          where: { id: source.id },
          data: { scrapeStatus: 'error', scrapeError: String(err).slice(0, 100) }
        })
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
    await prisma.$disconnect()
  }

  return stats
}

async function scanPageForJobs(page: Page) {
  return await page.evaluate((keywords) => {
    const links = Array.from(document.querySelectorAll('a'))
    const results: { title: string, url: string }[] = []
    
    const hasJobKeyword = (text: string) => {
      const t = text.toLowerCase()
      return keywords.some(k => t.includes(k))
    }

    const isBadLink = (text: string) => {
      const t = text.toLowerCase()
      return t.includes('login') || t.includes('sign up') || t.includes('policy') || t.length > 100
    }

    links.forEach(link => {
      const text = link.innerText.trim()
      const href = link.href

      if (text && href && hasJobKeyword(text) && !isBadLink(text)) {
        if (!results.find(r => r.url === href)) {
          results.push({ title: text, url: href })
        }
      }
    })

    return results
  }, JOB_TITLE_KEYWORDS)
}