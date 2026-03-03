// scripts/testRemote100k.ts
// Test script for the Remote100k scraper

import { format as __format } from 'node:util'
import puppeteer from 'puppeteer'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const BOARD_NAME = 'remote100k'
const BASE_URL = 'https://remote100k.com'
const TEST_URL = `${BASE_URL}/remote-jobs/engineering`

const CATEGORIES = [
  'Engineering', 'Marketing', 'Product', 'Data', 'Sales', 
  'Management', 'Design', 'Operations', 'All Other', 'Data Science'
]

interface ParsedJob {
  title: string
  company: string
  location: string
  category: string
  salaryText: string
  salaryMin: number | null
  salaryMax: number | null
  currency: string
  employmentType: string
  ageText: string
  url: string
}

async function testScraper() {
  __slog(`[TEST] Starting Remote100k scraper test...`)
  __slog(`[TEST] URL: ${TEST_URL}`)
  __slog('')

  let browser

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')

    __slog(`[TEST] Loading page...`)
    await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 3000))

    __slog(`[TEST] Page loaded. Extracting content...`)
    __slog('')

    const pageText = await page.evaluate(() => document.body.innerText)
    
    // Get job URLs - use the element's href property (resolved) not getAttribute
    const jobUrls = await page.evaluate(() => {
      const urls: string[] = []
      document.querySelectorAll('a[href*="/remote-job/"]').forEach(link => {
        // Use .href property which gives the fully resolved URL
        const fullUrl = (link as HTMLAnchorElement).href
        if (fullUrl && fullUrl.includes('/remote-job/') && !urls.includes(fullUrl)) {
          urls.push(fullUrl)
        }
      })
      return urls
    })

    __slog(`[TEST] Found ${jobUrls.length} job URLs`)
    if (jobUrls.length > 0) {
      __slog(`[TEST] Sample URL: ${jobUrls[0]}`)
    }
    __slog('')

    const jobs = parseJobsFromText(pageText, jobUrls)

    __slog(`[TEST] Parsed ${jobs.length} jobs:`)
    __slog('='.repeat(100))
    __slog('')

    jobs.slice(0, 25).forEach((job, i) => {
      __slog(`Job ${i + 1}:`)
      __slog(`  Title:     ${job.title}`)
      __slog(`  Company:   ${job.company}`)
      __slog(`  Location:  ${job.location}`)
      __slog(`  Category:  ${job.category}`)
      __slog(`  Salary:    ${job.salaryText} → $${job.salaryMin?.toLocaleString() || '?'} - $${job.salaryMax?.toLocaleString() || '?'} ${job.currency}`)
      __slog(`  Type:      ${job.employmentType}`)
      __slog(`  Age:       ${job.ageText || 'N/A'}`)
      __slog(`  URL:       ${job.url}`)
      __slog('')
    })

    if (jobs.length > 25) {
      __slog(`... and ${jobs.length - 25} more jobs`)
    }

    __slog('')
    __slog('='.repeat(100))
    __slog('[TEST] Summary:')
    __slog(`  Total jobs parsed: ${jobs.length}`)
    __slog(`  Jobs with company: ${jobs.filter(j => j.company && j.company !== 'Unknown').length}`)
    __slog(`  Jobs with salary: ${jobs.filter(j => j.salaryMin).length}`)
    __slog(`  Jobs with clean location: ${jobs.filter(j => j.location && !j.location.includes('Engineering') && !j.location.includes(',,')).length}`)
    __slog(`  Jobs with valid URL: ${jobs.filter(j => j.url.startsWith('https://remote100k.com/remote-job/') && !j.url.includes('..')).length}`)
    
    const issues = jobs.filter(j => 
      !j.company || 
      j.company === 'Unknown' || 
      j.location.includes('Engineering') ||
      j.location.includes(',,') ||
      j.title.includes('Full-Time') ||
      j.url.includes('..')
    )
    if (issues.length > 0) {
      __slog(`  ⚠️  Jobs with parsing issues: ${issues.length}`)
      issues.slice(0, 3).forEach((j, i) => {
        __slog(`    Issue ${i+1}: title="${j.title.slice(0,30)}..." url="${j.url.slice(0,50)}..."`)
      })
    } else {
      __slog(`  ✅ No parsing issues detected!`)
    }

  } catch (err) {
    __serr(`[TEST] Error:`, err)
  } finally {
    if (browser) {
      await browser.close()
    }
  }

  __slog('')
  __slog(`[TEST] Done!`)
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
    
    const locationParts: string[] = []
    let category = ''
    for (let j = remoteIdx + 1; j < salaryLineIdx; j++) {
      const l = lines[j]
      if (CATEGORIES.includes(l)) {
        category = l
        break
      } else if (l && !isNavigationLine(l) && l !== ',') {
        locationParts.push(l)
      }
    }
    
    const location = cleanLocation(locationParts.join(', '))
    const salaryText = lines[salaryLineIdx]
    const salary = parseSalaryText(salaryText)
    
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
    
    const url = findMatchingUrl(company, title, urlMap)
    
    jobs.push({
      title,
      company,
      location: location || 'Remote',
      category,
      salaryText,
      salaryMin: salary.min,
      salaryMax: salary.max,
      currency: salary.currency,
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
  
  for (const [urlSlug, fullUrl] of urlMap.entries()) {
    if (urlSlug.startsWith(companySlug)) {
      urlMap.delete(urlSlug)
      return fullUrl
    }
  }
  
  const shortCompanySlug = companySlug.slice(0, Math.max(5, companySlug.length))
  for (const [urlSlug, fullUrl] of urlMap.entries()) {
    if (urlSlug.startsWith(shortCompanySlug)) {
      urlMap.delete(urlSlug)
      return fullUrl
    }
  }
  
  return `${BASE_URL}/remote-job/${companySlug}-${titleSlug}`
}

function isNavigationLine(line: string): boolean {
  const navPatterns = ['Remote100K', 'Stop applying', 'Meet JobCopilot', 'Remote jobs from companies like', 'Land your next', 'Apply directly', 'Find remote', '💻']
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
  cleaned = cleaned
    .replace(/,\s*,+/g, ',')
    .replace(/,\s*$/g, '')
    .replace(/^\s*,/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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

testScraper()