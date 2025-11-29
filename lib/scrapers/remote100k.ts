// lib/scrapers/remote100k.ts
// Remote100k scraper - Puppeteer-based for JavaScript-rendered content
//
// This scraper fetches jobs from remote100k.com which is built with Framer
// and requires JavaScript execution to render job listings.
//
// Strategy:
// 1. Use Puppeteer to load category listing pages
// 2. Extract job cards with salary, company, location data
// 3. Use the new central ingest function for deduplication
//
// Rate limiting: 20 pages max per run, 500ms delay between pages

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
const DELAY_BETWEEN_PAGES_MS = 500
const PAGE_LOAD_TIMEOUT_MS = 30000
const WAIT_FOR_CONTENT_MS = 3000

// Category pages to scrape (from sitemap analysis)
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

// Known categories to filter out from location
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

/**
 * Main entry point - scrapes Remote100k job listings
 */
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
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })

    const page = await browser.newPage()
    
    // Set user agent to look like a real browser
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // Track seen jobs to avoid duplicates across category pages
    const seenJobUrls = new Set<string>()

    // Scrape each category page
    const pagesToScrape = CATEGORY_PAGES.slice(0, MAX_PAGES_PER_RUN)
    
    for (let i = 0; i < pagesToScrape.length; i++) {
      const categoryPath = pagesToScrape[i]
      const url = `${BASE_URL}${categoryPath}`
      
      console.log(`[${BOARD_NAME}] Scraping page ${i + 1}/${pagesToScrape.length}: ${url}`)
      
      try {
        const jobs = await scrapeListingPage(page, url, seenJobUrls)
        console.log(`[${BOARD_NAME}] Found ${jobs.length} new jobs on ${categoryPath}`)
        
        // Ingest each job
        for (const job of jobs) {
          try {
            const result = await ingestJob(job)
            // Handle the status - map 'error' to 'errors' for stats
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
        
        // Rate limit
        if (i < pagesToScrape.length - 1) {
          await delay(DELAY_BETWEEN_PAGES_MS)
        }
      } catch (err) {
        console.error(`[${BOARD_NAME}] Error scraping ${url}:`, err)
        stats.errors++
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

/**
 * Scrape a single listing page and extract job cards
 */
async function scrapeListingPage(
  page: Page, 
  url: string,
  seenJobUrls: Set<string>
): Promise<ScrapedJobInput[]> {
  const jobs: ScrapedJobInput[] = []

  try {
    // Navigate to page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: PAGE_LOAD_TIMEOUT_MS,
    })

    // Wait for content to render
    await delay(WAIT_FOR_CONTENT_MS)

    // Get page text and parse jobs from it
    const pageText = await page.evaluate(() => document.body.innerText)
    
    // Also get all job URLs from the page
    // Use .href property (not getAttribute) to get fully resolved URLs
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

    // Parse jobs from text
    const parsedJobs = parseJobsFromText(pageText, jobUrls)
    
    // Convert to ScrapedJobInput and filter already seen
    for (const parsed of parsedJobs) {
      // Skip if we've already processed this job URL
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
  }

  return jobs
}

/**
 * Parse jobs from page text using line-by-line analysis
 */
function parseJobsFromText(pageText: string, jobUrls: string[]): ParsedJob[] {
  const jobs: ParsedJob[] = []
  const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  // Create a URL lookup map from job slug
  const urlMap = new Map<string, string>()
  for (const url of jobUrls) {
    const match = url.match(/\/remote-job\/([^/]+)/)
    if (match) {
      urlMap.set(match[1].toLowerCase(), url)
    }
  }

  // Find job patterns in text
  for (let i = 0; i < lines.length - 5; i++) {
    const line = lines[i]
    
    // Skip navigation/header lines
    if (isNavigationLine(line)) continue
    
    // Skip employment type lines (these can appear due to page structure)
    if (/^(Full-Time|Part-Time|Contract)$/i.test(line)) continue
    
    // Look for salary pattern in nearby lines (within 8 lines)
    let salaryLineIdx = -1
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      if (/^[$£€][\d,]+/.test(lines[j])) {
        salaryLineIdx = j
        break
      }
    }
    
    if (salaryLineIdx === -1) continue
    
    // Look for "Remote:" marker
    let remoteIdx = -1
    for (let j = i + 1; j < salaryLineIdx; j++) {
      if (lines[j] === 'Remote:') {
        remoteIdx = j
        break
      }
    }
    
    if (remoteIdx === -1) continue
    
    // Title is at line i
    const title = line
    
    // Validate title - must look like a job title, not an employment type
    if (!isValidJobTitle(title)) continue
    
    // Find company (lines between title and Remote:)
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
    
    // Skip if no valid company found
    if (!company || !isValidCompanyName(company)) continue
    
    // Find location (after Remote: until category)
    let locationParts: string[] = []
    let category = ''
    for (let j = remoteIdx + 1; j < salaryLineIdx; j++) {
      const l = lines[j]
      if (CATEGORIES.includes(l)) {
        category = l
        break
      } else if (l && !isNavigationLine(l) && l.length > 0) {
        // Only add non-empty location parts
        if (l !== ',') {
          locationParts.push(l)
        }
      }
    }
    
    // Clean up location - join parts and clean
    let location = cleanLocation(locationParts.join(', '))
    
    // Salary line
    const salaryText = lines[salaryLineIdx]
    
    // Employment type (line after salary)
    let employmentType = 'Full-Time'
    if (salaryLineIdx + 1 < lines.length) {
      const typeLine = lines[salaryLineIdx + 1]
      if (/full-time/i.test(typeLine)) employmentType = 'Full-Time'
      else if (/part-time/i.test(typeLine)) employmentType = 'Part-Time'
      else if (/contract/i.test(typeLine)) employmentType = 'Contract'
    }
    
    // Age
    let ageText = ''
    // Check line after employment type
    if (salaryLineIdx + 2 < lines.length) {
      const potentialAge = lines[salaryLineIdx + 2]
      if (/^(NEW|\d+d)$/i.test(potentialAge)) {
        ageText = potentialAge
      }
    }
    // Check line before title
    if (!ageText && i > 0) {
      const lineBefore = lines[i - 1]
      if (/^(NEW|\d+d)$/i.test(lineBefore)) {
        ageText = lineBefore
      }
    }
    
    // Find matching URL
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
    
    // Skip ahead past this job
    i = salaryLineIdx + 2
  }
  
  return jobs
}

/**
 * Check if a string looks like a valid job title
 */
function isValidJobTitle(title: string): boolean {
  // Must be at least 5 chars
  if (title.length < 5) return false
  
  // Must not be employment type
  if (/^(Full-Time|Part-Time|Contract|Remote)$/i.test(title)) return false
  
  // Must not be just a number with 'd' (age indicator)
  if (/^\d+d$/.test(title)) return false
  
  // Should contain letters
  if (!/[a-zA-Z]/.test(title)) return false
  
  return true
}

/**
 * Check if a string looks like a valid company name
 */
function isValidCompanyName(name: string): boolean {
  // Must be at least 2 chars
  if (name.length < 2) return false
  
  // Must not be employment type
  if (/^(Full-Time|Part-Time|Contract|Remote|NEW)$/i.test(name)) return false
  
  // Must not be age indicator
  if (/^\d+d$/.test(name)) return false
  
  // Must not be a category
  if (CATEGORIES.includes(name)) return false
  
  return true
}

/**
 * Find matching URL for a job
 */
function findMatchingUrl(company: string, title: string, urlMap: Map<string, string>): string {
  const companySlug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  
  // Try exact match starting with company slug
  const entries = Array.from(urlMap.entries())
  for (const [urlSlug, fullUrl] of entries) {
    if (urlSlug.startsWith(companySlug)) {
      urlMap.delete(urlSlug) // Remove to avoid reuse
      return fullUrl
    }
  }
  
  // Try partial company match (at least first 5 chars)
  const shortCompanySlug = companySlug.slice(0, Math.max(5, companySlug.length))
  for (const [urlSlug, fullUrl] of entries) {
    if (urlSlug.startsWith(shortCompanySlug)) {
      urlMap.delete(urlSlug)
      return fullUrl
    }
  }
  
  // Fallback: generate URL
  return `${BASE_URL}/remote-job/${companySlug}-${titleSlug}`
}

/**
 * Check if a line is navigation/header content
 */
function isNavigationLine(line: string): boolean {
  const navPatterns = [
    'Remote100K',
    'Stop applying',
    'Meet JobCopilot',
    'Remote jobs from companies like',
    'Land your next',
    'Apply directly',
    'Find remote',
    '💻',
  ]
  
  for (const pattern of navPatterns) {
    if (line.includes(pattern)) return true
  }
  
  // Standalone category in navigation (not as part of job data)
  if (/^(Engineering|Marketing|Product|Data|Sales|Management|Design|Operations|All Other)$/.test(line)) {
    return true
  }
  
  return false
}

/**
 * Clean location string
 */
function cleanLocation(location: string): string {
  let cleaned = location
  
  // Remove category names
  for (const cat of CATEGORIES) {
    cleaned = cleaned.replace(new RegExp(`\\s*,?\\s*${cat}\\s*,?\\s*`, 'gi'), ', ')
  }
  
  // Clean up multiple commas and spaces
  cleaned = cleaned
    .replace(/,\s*,+/g, ',')     // Multiple commas
    .replace(/,\s*$/g, '')        // Trailing comma
    .replace(/^\s*,/g, '')        // Leading comma
    .replace(/\s+/g, ' ')         // Multiple spaces
    .trim()
  
  return cleaned || 'Remote'
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse salary text like "$164,000 - $246,000" or "£125,000" into min/max/currency
 */
function parseSalaryText(text: string): { min: number | null; max: number | null; currency: string } {
  if (!text) {
    return { min: null, max: null, currency: 'USD' }
  }

  // Detect currency
  let currency = 'USD'
  if (text.includes('£')) currency = 'GBP'
  else if (text.includes('€')) currency = 'EUR'
  else if (text.includes('CAD')) currency = 'CAD'
  else if (text.includes('AUD')) currency = 'AUD'

  // Match numbers
  const matches = text.match(/[\d,]+/g)
  if (!matches) return { min: null, max: null, currency }

  const numbers = matches
    .map(m => parseInt(m.replace(/,/g, ''), 10))
    .filter(n => !isNaN(n) && n > 10000) // Filter out small numbers (not salaries)
  
  if (numbers.length === 0) return { min: null, max: null, currency }
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0], currency }
  
  return { min: Math.min(...numbers), max: Math.max(...numbers), currency }
}

/**
 * Parse age text like "2d" or "New" to a Date
 */
function parseAgeToDate(ageText: string): Date | null {
  if (!ageText) {
    return null
  }

  const now = new Date()
  
  if (ageText.toLowerCase() === 'new') {
    return now
  }
  
  const daysMatch = ageText.match(/(\d+)d/)
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10)
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  }
  
  return null
}

/**
 * Generate a stable external ID from a URL
 */
function generateExternalId(url: string): string {
  try {
    const urlObj = new URL(url)
    // Extract the job slug from path like /remote-job/company-title
    const match = urlObj.pathname.match(/\/remote-job\/(.+)/)
    if (match) {
      return match[1]
    }
    return urlObj.pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home'
  } catch {
    return Buffer.from(url).toString('base64').slice(0, 32)
  }
}

/**
 * Delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// =============================================================================
// Exports
// =============================================================================

export { scrapeRemote100k, scrapeListingPage }