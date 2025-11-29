// lib/scrapers/remote100k.ts
// UPDATED: Fixes "Detached Frame" error by using fresh pages for each category

import puppeteer, { Browser, Page } from 'puppeteer'
import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'
import type { ScrapedJobInput, IngestStats } from '../ingest/types'

// =============================================================================
// Constants
// =============================================================================

const BOARD_NAME = 'remote100k'
const BASE_URL = 'https://remote100k.com'

// Rate limiting
const MAX_PAGES_PER_RUN = 20
const DELAY_BETWEEN_PAGES_MS = 1000 // Increased delay slightly
const PAGE_LOAD_TIMEOUT_MS = 45000 // Increased timeout
const WAIT_FOR_CONTENT_MS = 3000

const CATEGORY_PAGES = [
  '/remote-jobs/engineering',
  '/remote-jobs/data-science',
  '/remote-jobs/product',
  '/remote-jobs/marketing',
  '/remote-jobs/sales',
  '/remote-jobs/design',
  '/remote-jobs/management',
  '/remote-jobs/operations',
  '/remote-jobs/all-other',
  '/remote-jobs/ai-engineer',
  '/remote-jobs/software-engineer',
  '/remote-jobs/devops',
  '/remote-jobs/frontend-development',
  '/remote-jobs/backend-development',
  '/remote-jobs/full-stack-development',
  '/remote-jobs/data-engineer',
  '/remote-jobs/machine-learning',
  '/remote-jobs/cybersecurity',
  '/remote-jobs/cloud-engineer',
]

const CATEGORIES = [
  'Engineering', 'Marketing', 'Product', 'Data', 'Sales', 
  'Management', 'Design', 'Operations', 'All Other', 'Data Science'
]

// =============================================================================
// Types
// =============================================================================

interface ParsedJob {
  title: string
  company: string
  location: string
  category: string
  salaryText: string
  employmentType: string
  ageText: string
  url: string
}

// =============================================================================
// Scraper Functions
// =============================================================================

export default async function scrapeRemote100k(): Promise<IngestStats> {
  console.log(`[${BOARD_NAME}] Starting scrape...`)
  
  const stats: IngestStats = {
    created: 0,
    updated: 0,
    upgraded: 0,
    skipped: 0,
    errors: 0,
  }

  let browser: Browser | null = null

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })

    // Track seen jobs to avoid duplicates across category pages
    const seenJobUrls = new Set<string>()

    const pagesToScrape = CATEGORY_PAGES.slice(0, MAX_PAGES_PER_RUN)
    
    for (let i = 0; i < pagesToScrape.length; i++) {
      const categoryPath = pagesToScrape[i]
      const url = `${BASE_URL}${categoryPath}`
      
      console.log(`[${BOARD_NAME}] Scraping page ${i + 1}/${pagesToScrape.length}: ${url}`)
      
      // CRITICAL FIX: Open a new page for EVERY request to prevent "Detached Frame" errors
      let page: Page | null = null;

      try {
        page = await browser.newPage()
        
        await page.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )

        const jobs = await scrapeListingPage(page, url, seenJobUrls)
        console.log(`[${BOARD_NAME}] Found ${jobs.length} new jobs on ${categoryPath}`)
        
        for (const job of jobs) {
          try {
            const result = await ingestJob(job)
            if (result.status === 'error') {
              stats.errors++
            } else {
              stats[result.status]++
            }
          } catch (err) {
            console.error(`[${BOARD_NAME}] Error ingesting job:`, err)
            stats.errors++
          }
        }
        
      } catch (err) {
        console.error(`[${BOARD_NAME}] Error scraping ${url}:`, err)
        stats.errors++
      } finally {
        // CRITICAL FIX: Always close the page to free up memory/context
        if (page) await page.close().catch(() => {}) 
      }

      // Rate limit
      if (i < pagesToScrape.length - 1) {
        await delay(DELAY_BETWEEN_PAGES_MS)
      }
    }

  } catch (err) {
    console.error(`[${BOARD_NAME}] Fatal error:`, err)
    stats.errors++
  } finally {
    if (browser) {
      await browser.close()
    }
  }

  console.log(`[${BOARD_NAME}] Scrape complete:`, stats)
  return stats
}

async function scrapeListingPage(
  page: Page, 
  url: string,
  seenJobUrls: Set<string>
): Promise<ScrapedJobInput[]> {
  const jobs: ScrapedJobInput[] = []

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // Changed from networkidle2 to be faster/safer
      timeout: PAGE_LOAD_TIMEOUT_MS,
    })

    await delay(WAIT_FOR_CONTENT_MS)

    const pageText = await page.evaluate(() => document.body.innerText)
    
    const jobUrls = await page.evaluate(() => {
      const urls: string[] = []
      document.querySelectorAll('a[href*="/remote-job/"]').forEach(link => {
        const fullUrl = (link as HTMLAnchorElement).href
        if (fullUrl && fullUrl.includes('/remote-job/') && !urls.includes(fullUrl)) {
          urls.push(fullUrl)
        }
      })
      return urls
    })

    const parsedJobs = parseJobsFromText(pageText, jobUrls)
    
    for (const parsed of parsedJobs) {
      if (seenJobUrls.has(parsed.url)) {
        continue
      }
      seenJobUrls.add(parsed.url)

      const salary = parseSalaryText(parsed.salaryText)
      
      const job: ScrapedJobInput = {
        externalId: generateExternalId(parsed.url),
        title: parsed.title,
        source: makeBoardSource(BOARD_NAME),
        rawCompanyName: parsed.company,
        url: parsed.url,
        applyUrl: parsed.url,
        locationText: parsed.location,
        isRemote: true,
        salaryMin: salary.min,
        salaryMax: salary.max,
        salaryCurrency: salary.currency,
        salaryInterval: 'year',
        salaryRaw: parsed.salaryText,
        employmentType: parsed.employmentType,
        department: parsed.category || null,
        postedAt: parseAgeToDate(parsed.ageText),
        raw: parsed as unknown as Record<string, unknown>,
      }
      
      jobs.push(job)
    }

  } catch (err) {
    console.error(`[${BOARD_NAME}] Error parsing page ${url}:`, err)
    throw err; // Re-throw so the main loop knows it failed
  }

  return jobs
}

function parseJobsFromText(pageText: string, jobUrls: string[]): ParsedJob[] {
  const jobs: ParsedJob[] = []
  const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  const urlMap = new Map<string, string>()
  for (const url of jobUrls) {
    const match = url.match(/\/remote-job\/([^/]+)/)
    if (match) {
      urlMap.set(match[1].toLowerCase(), url)
    }
  }

  for (let i = 0; i < lines.length - 5; i++) {
    const line = lines[i]
    if (isNavigationLine(line)) continue
    if (/^(Full-Time|Part-Time|Contract)$/i.test(line)) continue
    
    let salaryLineIdx = -1
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      if (/^[$£€][\d,]+/.test(lines[j])) {
        salaryLineIdx = j
        break
      }
    }
    
    if (salaryLineIdx === -1) continue
    
    let remoteIdx = -1
    for (let j = i + 1; j < salaryLineIdx; j++) {
      if (lines[j] === 'Remote:') {
        remoteIdx = j
        break
      }
    }
    
    if (remoteIdx === -1) continue
    
    const title = line
    if (!isValidJobTitle(title)) continue
    
    let company = ''
    for (let j = i + 1; j < remoteIdx; j++) {
      const candidateLine = lines[j]
      if (!isNavigationLine(candidateLine) && 
          candidateLine !== 'NEW' && 
          !/^\d+d$/.test(candidateLine) &&
          !/^(Full-Time|Part-Time|Contract)$/i.test(candidateLine) &&
          candidateLine.length > 1) {
        company = candidateLine
        break
      }
    }
    
    if (!company || !isValidCompanyName(company)) continue
    
    let locationParts: string[] = []
    let category = ''
    for (let j = remoteIdx + 1; j < salaryLineIdx; j++) {
      const l = lines[j]
      if (CATEGORIES.includes(l)) {
        category = l
        break
      } else if (l && !isNavigationLine(l) && l.length > 0) {
        if (l !== ',') {
          locationParts.push(l)
        }
      }
    }
    
    let location = cleanLocation(locationParts.join(', '))
    const salaryText = lines[salaryLineIdx]
    
    let employmentType = 'Full-Time'
    if (salaryLineIdx + 1 < lines.length) {
      const typeLine = lines[salaryLineIdx + 1]
      if (/full-time/i.test(typeLine)) employmentType = 'Full-Time'
      else if (/part-time/i.test(typeLine)) employmentType = 'Part-Time'
      else if (/contract/i.test(typeLine)) employmentType = 'Contract'
    }
    
    let ageText = ''
    if (salaryLineIdx + 2 < lines.length) {
      const potentialAge = lines[salaryLineIdx + 2]
      if (/^(NEW|\d+d)$/i.test(potentialAge)) {
        ageText = potentialAge
      }
    }
    if (!ageText && i > 0) {
      const lineBefore = lines[i - 1]
      if (/^(NEW|\d+d)$/i.test(lineBefore)) {
        ageText = lineBefore
      }
    }
    
    let url = findMatchingUrl(company, title, urlMap)
    
    jobs.push({
      title,
      company,
      location: location || 'Remote',
      category,
      salaryText,
      employmentType,
      ageText,
      url,
    })
    
    i = salaryLineIdx + 2
  }
  
  return jobs
}

function isValidJobTitle(title: string): boolean {
  if (title.length < 5) return false
  if (/^(Full-Time|Part-Time|Contract|Remote)$/i.test(title)) return false
  if (/^\d+d$/.test(title)) return false
  if (!/[a-zA-Z]/.test(title)) return false
  return true
}

function isValidCompanyName(name: string): boolean {
  if (name.length < 2) return false
  if (/^(Full-Time|Part-Time|Contract|Remote|NEW)$/i.test(name)) return false
  if (/^\d+d$/.test(name)) return false
  if (CATEGORIES.includes(name)) return false
  return true
}

function findMatchingUrl(company: string, title: string, urlMap: Map<string, string>): string {
  const companySlug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  
  const entries = Array.from(urlMap.entries())
  for (const [urlSlug, fullUrl] of entries) {
    if (urlSlug.startsWith(companySlug)) {
      urlMap.delete(urlSlug)
      return fullUrl
    }
  }
  
  const shortCompanySlug = companySlug.slice(0, Math.max(5, companySlug.length))
  for (const [urlSlug, fullUrl] of entries) {
    if (urlSlug.startsWith(shortCompanySlug)) {
      urlMap.delete(urlSlug)
      return fullUrl
    }
  }
  
  return `${BASE_URL}/remote-job/${companySlug}-${titleSlug}`
}

function isNavigationLine(line: string): boolean {
  const navPatterns = [
    'Remote100K', 'Stop applying', 'Meet JobCopilot', 'Remote jobs from companies like',
    'Land your next', 'Apply directly', 'Find remote', '💻',
  ]
  for (const pattern of navPatterns) {
    if (line.includes(pattern)) return true
  }
  if (/^(Engineering|Marketing|Product|Data|Sales|Management|Design|Operations|All Other)$/.test(line)) {
    return true
  }
  return false
}

function cleanLocation(location: string): string {
  let cleaned = location
  for (const cat of CATEGORIES) {
    cleaned = cleaned.replace(new RegExp(`\\s*,?\\s*${cat}\\s*,?\\s*`, 'gi'), ', ')
  }
  cleaned = cleaned.replace(/,\s*,+/g, ',').replace(/,\s*$/g, '').replace(/^\s*,/g, '').replace(/\s+/g, ' ').trim()
  return cleaned || 'Remote'
}

function parseSalaryText(text: string): { min: number | null; max: number | null; currency: string } {
  if (!text) return { min: null, max: null, currency: 'USD' }
  let currency = 'USD'
  if (text.includes('£')) currency = 'GBP'
  else if (text.includes('€')) currency = 'EUR'
  else if (text.includes('CAD')) currency = 'CAD'
  else if (text.includes('AUD')) currency = 'AUD'

  const matches = text.match(/[\d,]+/g)
  if (!matches) return { min: null, max: null, currency }

  const numbers = matches.map(m => parseInt(m.replace(/,/g, ''), 10)).filter(n => !isNaN(n) && n > 10000)
  if (numbers.length === 0) return { min: null, max: null, currency }
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0], currency }
  return { min: Math.min(...numbers), max: Math.max(...numbers), currency }
}

function parseAgeToDate(ageText: string): Date | null {
  if (!ageText) return null
  const now = new Date()
  if (ageText.toLowerCase() === 'new') return now
  const daysMatch = ageText.match(/(\d+)d/)
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10)
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  }
  return null
}

function generateExternalId(url: string): string {
  try {
    const urlObj = new URL(url)
    const match = urlObj.pathname.match(/\/remote-job\/(.+)/)
    if (match) return match[1]
    return urlObj.pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home'
  } catch {
    return Buffer.from(url).toString('base64').slice(0, 32)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export { scrapeRemote100k, scrapeListingPage }