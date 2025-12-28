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

function blockedUrlReason(rawUrl: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return 'invalid-url'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `blocked-protocol:${parsed.protocol}`
  }

  const hostname = parsed.hostname.toLowerCase()
  const blockedHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '::1'])

  if (blockedHosts.has(hostname) || hostname.endsWith('.localhost')) {
    return `blocked-host:${hostname}`
  }

  if (
    hostname.match(/^10\./) ||
    hostname.match(/^127\./) ||
    hostname.match(/^192\.168\./) ||
    hostname.match(/^169\.254\./) ||
    hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)
  ) {
    return `blocked-ip:${hostname}`
  }

  return null
}

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
    return { created: 0, updated: 0, skipped: 0 }
  }

  console.log(`[Generic] Found ${sources.length} pages to scrape.`)

  const browser = await puppeteer.launch({
    headless: true,
    // @ts-expect-error: ignoreHTTPSErrors is available at runtime but missing in our bundled types
    ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 }

  try {
    for (const source of sources) {
      console.log(`[Generic] Scraping ${source.company.name} at ${source.url}`)
      console.log(`[Generic] Processing ${source.company.name}...`)

      const blockedReason = blockedUrlReason(source.url)
      if (blockedReason) {
        console.error(
          `[Generic] Blocked URL for ${source.company.name}: ${source.url} (${blockedReason})`,
        )
        stats.errors++
        await prisma.companySource.update({
          where: { id: source.id },
          data: { scrapeStatus: 'error', scrapeError: blockedReason.slice(0, 100) },
        })
        continue
      }

      const page = await browser.newPage()
      
      try {
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        page.setDefaultNavigationTimeout(45000)

        await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 45000 })
        
        // Scan page for links that look like jobs
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

  return {
    created: stats.created,
    updated: stats.updated,
    skipped: stats.skipped + stats.errors,
  }
}

async function scanPageForJobs(page: Page) {
  return await page.evaluate((keywords) => {
    // Some sites throw ReferenceError for __name helper; ensure it exists
    ;(globalThis as any).__name = (v: any) => v

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
