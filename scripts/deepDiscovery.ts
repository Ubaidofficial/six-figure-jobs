import puppeteer, { Browser, Page } from 'puppeteer'
import { prisma } from '../lib/prisma'
import { makeBoardSource } from '../lib/ingest/sourcePriority'

// =============================================================================
// Configuration
// =============================================================================

const MAX_CONCURRENT_PAGES = 1 // Keep it safe to avoid detection
const NAVIGATION_TIMEOUT = 30000
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const ATS_PATTERNS = [
  { provider: 'greenhouse', regex: /boards\.greenhouse\.io\/([^/"'?]+)/ },
  { provider: 'greenhouse', regex: /greenhouse\.io\/embed\/job_board\?for=([^&"']+)/ },
  { provider: 'lever', regex: /jobs\.lever\.co\/([^/"'?]+)/ },
  { provider: 'ashby', regex: /jobs\.ashbyhq\.com\/([^/"'?]+)/ },
  { provider: 'ashby', regex: /api\.ashbyhq\.com\/posting-api\/job-board\/([^/"'?]+)/ },
  { provider: 'workday', regex: /([^/"'?]+)\.wd1\.myworkdayjobs\.com/ },
  { provider: 'bamboo', regex: /([^/"'?]+)\.bamboohr\.com\/jobs/ },
]

// Keywords that suggest a link is a job posting
const JOB_TITLE_KEYWORDS = [
  'engineer', 'developer', 'manager', 'designer', 'product', 
  'sales', 'marketing', 'analyst', 'lead', 'head of', 'vp', 
  'director', 'counsel', 'recruiter', 'support', 'success'
]

// =============================================================================
// Main Script
// =============================================================================

async function main() {
  console.log('🚀 Starting Deep Company Discovery (Puppeteer + Generic Fallback)...')

  // 1. Get companies without a verified website or ATS
  const companies = await prisma.company.findMany({
    where: {
      atsProvider: null,
      name: { not: 'Add Your Company' }
    },
    take: 20, // Process in batches
    orderBy: { createdAt: 'desc' }
  })

  console.log(`📋 Scanning ${companies.length} companies...`)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  try {
    for (const company of companies) {
      const page = await browser.newPage()
      await page.setUserAgent(USER_AGENT)
      
      try {
        await processCompany(company, page)
      } catch (err) {
        console.error(`❌ Error processing ${company.name}:`, err)
      } finally {
        await page.close()
      }
      
      // Brief pause between companies
      await new Promise(r => setTimeout(r, 1000))
    }
  } finally {
    await browser.close()
  }
}

// =============================================================================
// Processing Logic
// =============================================================================

async function processCompany(company: any, page: Page) {
  process.stdout.write(`\n🔍 ${company.name}: `)

  // 1. Determine URLs to try
  const candidates: string[] = []
  if (company.website) {
    candidates.push(company.website)
    candidates.push(company.website.replace(/\/$/, '') + '/careers')
    candidates.push(company.website.replace(/\/$/, '') + '/jobs')
  } else {
    // Heuristic guessing
    const cleanName = company.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    candidates.push(`https://${cleanName}.com`)
    candidates.push(`https://${cleanName}.com/careers`)
    candidates.push(`https://${cleanName}.io`)
    candidates.push(`https://${cleanName}.app`)
  }

  let foundSomething = false

  for (const url of candidates) {
    if (foundSomething) break

    try {
      // Navigate to page
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      }).catch(() => null)

      if (!response || !response.ok()) continue

      // A. Check for ATS (Regex in HTML + Iframes)
      const atsResult = await detectATS(page)
      
      if (atsResult) {
        console.log(`✅ FOUND ATS: ${atsResult.provider} (${atsResult.slug})`)
        
        await prisma.company.update({
          where: { id: company.id },
          data: {
            website: getBaseUrl(url), // Update website if we guessed it
            atsProvider: atsResult.provider,
            atsSlug: atsResult.slug,
            atsUrl: url // Capture the careers page URL
          }
        })

        // Also save as a source for redundancy
        await prisma.companySource.upsert({
          where: { companyId_url: { companyId: company.id, url: url } },
          create: {
            companyId: company.id,
            url: url,
            sourceType: 'ats_careers_page',
            atsProvider: atsResult.provider,
            isActive: true
          },
          update: { atsProvider: atsResult.provider }
        })

        foundSomething = true
        continue
      }

      // B. Fallback: Generic Scraping (Look for job links)
      // Only do this if we are on a likely careers page (contains 'careers' or 'jobs' or we scanned the homepage)
      if (url.includes('careers') || url.includes('jobs') || candidates.indexOf(url) === 0) {
        const genericJobs = await scanGenericJobs(page)
        
        if (genericJobs.length > 0) {
          console.log(`✅ GENERIC SCRAPE: Found ${genericJobs.length} potential jobs on ${url}`)
          
          // 1. Save valid website
          await prisma.company.update({
            where: { id: company.id },
            data: { website: getBaseUrl(url) }
          })

          // 2. Register this URL as a custom source
          await prisma.companySource.upsert({
            where: { companyId_url: { companyId: company.id, url: url } },
            create: {
              companyId: company.id,
              url: url,
              sourceType: 'generic_careers_page',
              isActive: true,
              scrapeStatus: 'active'
            },
            update: { lastScrapedAt: new Date() }
          })

          // 3. Optional: Save the jobs directly (bootstrap)
          let newJobs = 0
          for (const job of genericJobs) {
             // Basic upsert logic (simplified for discovery)
             // In production, you'd use the full ingest function
             const exists = await prisma.job.findFirst({
               where: { companyId: company.id, title: job.title }
             })
             
             if (!exists) {
               await prisma.job.create({
                 data: {
                   id: crypto.randomUUID(),
                   title: job.title,
                   company: company.name,
                   companyId: company.id,
                   url: job.url,
                   applyUrl: job.url,
                   source: makeBoardSource('generic_discovery'),
                   descriptionHtml: 'Discovered via generic scrape',
                   postedAt: new Date(),
                   isHighSalary: false // Default, requires manual review or salary scraper
                 }
               })
               newJobs++
             }
          }
          console.log(`   -> Saved ${newJobs} new jobs to DB`)
          
          foundSomething = true
        }
      }

    } catch (err) {
      // Ignore navigation errors for guesses
    }
  }

  if (!foundSomething) {
    process.stdout.write('❌ No ATS or Job Links found')
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

async function detectATS(page: Page) {
  // 1. Check URL
  const url = page.url()
  for (const p of ATS_PATTERNS) {
    const match = url.match(p.regex)
    if (match && match[1]) return { provider: p.provider, slug: match[1] }
  }

  // 2. Check HTML Content
  const content = await page.content()
  for (const p of ATS_PATTERNS) {
    const match = content.match(p.regex)
    if (match && match[1]) return { provider: p.provider, slug: match[1] }
  }

  // 3. Check Iframes (Deep Check)
  const frames = page.frames()
  for (const frame of frames) {
    try {
      const frameUrl = frame.url()
      for (const p of ATS_PATTERNS) {
        const match = frameUrl.match(p.regex)
        if (match && match[1]) return { provider: p.provider, slug: match[1] }
      }
    } catch (e) {}
  }

  return null
}

async function scanGenericJobs(page: Page) {
  return await page.evaluate((keywords) => {
    const links = Array.from(document.querySelectorAll('a'))
    const results: { title: string, url: string }[] = []
    
    // Helper to check text
    const hasJobKeyword = (text: string) => {
      const t = text.toLowerCase()
      return keywords.some(k => t.includes(k))
    }

    // Helper to exclude nav links
    const isBadLink = (text: string) => {
      const t = text.toLowerCase()
      return t.includes('login') || t.includes('sign up') || t.includes('policy') || t.length > 100
    }

    links.forEach(link => {
      const text = link.innerText.trim()
      const href = link.href

      if (text && href && hasJobKeyword(text) && !isBadLink(text)) {
        // Avoid duplicates
        if (!results.find(r => r.url === href)) {
          results.push({ title: text, url: href })
        }
      }
    })

    return results
  }, JOB_TITLE_KEYWORDS)
}

function getBaseUrl(url: string) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.hostname}`
  } catch {
    return url
  }
}

main().catch(console.error)