import puppeteer from 'puppeteer'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function slugify(name: string): string {
  return name.toLowerCase().replace(/&/g, '-and-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function scrapeWeWorkRemotelyTop(): Promise<string[]> {
  console.log('\n=== Scraping WeWorkRemotely Top Companies ===')
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  
  await page.goto('https://weworkremotely.com/top-remote-companies', {
    waitUntil: 'networkidle2',
    timeout: 30000
  })
  
  await new Promise(r => setTimeout(r, 2000))
  
  const companies = await page.evaluate(() => {
    const results: string[] = []
    document.querySelectorAll('a[href*="/company/"]').forEach(link => {
      const name = link.textContent?.trim()
      if (name && name.length > 1 && name.length < 100) {
        results.push(name)
      }
    })
    // Also try other selectors
    document.querySelectorAll('.company-name, .company, h3, h4').forEach(el => {
      const name = el.textContent?.trim()
      if (name && name.length > 1 && name.length < 50 && !results.includes(name)) {
        results.push(name)
      }
    })
    return [...new Set(results)]
  })
  
  await browser.close()
  console.log('Found', companies.length, 'companies')
  return companies
}

async function scrapeHimalayas(): Promise<string[]> {
  console.log('\n=== Scraping Himalayas ===')
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  
  const allCompanies: string[] = []
  
  // Scrape multiple pages
  for (let i = 1; i <= 10; i++) {
    const url = i === 1 
      ? 'https://himalayas.app/companies' 
      : `https://himalayas.app/companies?page=${i}`
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
      await new Promise(r => setTimeout(r, 2000))
      
      const companies = await page.evaluate(() => {
        const results: string[] = []
        document.querySelectorAll('a[href*="/companies/"]').forEach(link => {
          const name = link.textContent?.trim()
          if (name && name.length > 1 && name.length < 100) {
            results.push(name)
          }
        })
        return results
      })
      
      allCompanies.push(...companies)
      console.log(`  Page ${i}: ${companies.length} companies`)
      
      if (companies.length === 0) break
    } catch (e) {
      break
    }
  }
  
  await browser.close()
  const unique = [...new Set(allCompanies)]
  console.log('Total unique:', unique.length)
  return unique
}

async function scrapeRemotive(): Promise<string[]> {
  console.log('\n=== Scraping Remotive ===')
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  
  await page.goto('https://remotive.com/remote-companies', {
    waitUntil: 'networkidle2',
    timeout: 30000
  })
  
  // Click "load more" multiple times
  for (let i = 0; i < 10; i++) {
    try {
      await page.click('button:has-text("More"), button:has-text("Load"), [class*="load-more"]')
      await new Promise(r => setTimeout(r, 2000))
    } catch {
      break
    }
  }
  
  const companies = await page.evaluate(() => {
    const results: string[] = []
    document.querySelectorAll('a[href*="/remote-company/"], .company-name, .company-card h3').forEach(el => {
      const name = el.textContent?.trim()
      if (name && name.length > 1 && name.length < 100) {
        results.push(name)
      }
    })
    return [...new Set(results)]
  })
  
  await browser.close()
  console.log('Found', companies.length, 'companies')
  return companies
}

async function scrapeLevelsFyi(): Promise<string[]> {
  console.log('\n=== Scraping Levels.fyi Remote ===')
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  
  await page.goto('https://www.levels.fyi/remote/', {
    waitUntil: 'networkidle2',
    timeout: 30000
  })
  
  await new Promise(r => setTimeout(r, 3000))
  
  // Scroll to load more
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await new Promise(r => setTimeout(r, 2000))
  }
  
  const companies = await page.evaluate(() => {
    const results: string[] = []
    document.querySelectorAll('a[href*="/company/"], .company-name, td a').forEach(el => {
      const name = el.textContent?.trim()
      if (name && name.length > 1 && name.length < 100) {
        results.push(name)
      }
    })
    return [...new Set(results)]
  })
  
  await browser.close()
  console.log('Found', companies.length, 'companies')
  return companies
}

// GitHub remote-jobs list - fetch raw README
async function scrapeGitHubList(): Promise<string[]> {
  console.log('\n=== Fetching GitHub remote-jobs list ===')
  
  const res = await fetch('https://raw.githubusercontent.com/remoteintech/remote-jobs/main/README.md')
  const text = await res.text()
  
  // Parse markdown table - company names are in first column
  const companies: string[] = []
  const lines = text.split('\n')
  
  for (const line of lines) {
    // Match markdown table rows: | Company Name | ... |
    const match = line.match(/^\|\s*\[([^\]]+)\]/)
    if (match && match[1]) {
      const name = match[1].trim()
      if (name.length > 1 && name.length < 100 && !name.includes('---')) {
        companies.push(name)
      }
    }
  }
  
  console.log('Found', companies.length, 'companies')
  return companies
}

async function main() {
  console.log('Scraping remote companies from multiple sources...\n')
  
  const allCompanies = new Set<string>()
  
  // Scrape each source
  try {
    const github = await scrapeGitHubList()
    github.forEach(c => allCompanies.add(c))
  } catch (e) { console.log('GitHub failed:', e) }
  
  try {
    const wwr = await scrapeWeWorkRemotelyTop()
    wwr.forEach(c => allCompanies.add(c))
  } catch (e) { console.log('WWR failed:', e) }
  
  try {
    const himalayas = await scrapeHimalayas()
    himalayas.forEach(c => allCompanies.add(c))
  } catch (e) { console.log('Himalayas failed:', e) }
  
  try {
    const remotive = await scrapeRemotive()
    remotive.forEach(c => allCompanies.add(c))
  } catch (e) { console.log('Remotive failed:', e) }
  
  try {
    const levels = await scrapeLevelsFyi()
    levels.forEach(c => allCompanies.add(c))
  } catch (e) { console.log('Levels.fyi failed:', e) }
  
  console.log('\n=== Total unique companies found:', allCompanies.size, '===\n')
  
  // Add to database
  let added = 0, existed = 0
  
  for (const name of allCompanies) {
    const slug = slugify(name)
    if (!slug || slug.length < 2) continue
    
    const existing = await prisma.company.findFirst({
      where: { OR: [{ slug }, { name }] }
    })
    
    if (existing) {
      existed++
      continue
    }
    
    await prisma.company.create({
      data: {
        name,
        slug,
        logoUrl: 'https://logo.clearbit.com/' + slug.replace(/-/g, '') + '.com',
      }
    })
    added++
  }
  
  const total = await prisma.company.count()
  console.log('\nResults:')
  console.log('  Already existed:', existed)
  console.log('  Newly added:', added)
  console.log('  Total companies:', total)
  
  await prisma.$disconnect()
}

main()
