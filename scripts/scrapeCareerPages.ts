import { PrismaClient } from '@prisma/client'
import puppeteer from 'puppeteer'
import { ingestJob } from '../lib/ingest/index.js'

const prisma = new PrismaClient()

const JOB_LINK_PATTERNS = [/\/jobs?\//i, /\/careers?\//i, /\/positions?\//i, /\/openings?\//i, /apply/i]
const CAREER_PATHS = ['/careers', '/jobs', '/about/careers', '/join-us', '/open-positions']

async function scrapeCareerPage(browser: any, website: string): Promise<{title: string, url: string, location?: string}[]> {
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
  const jobs: any[] = []
  const baseUrl = website.replace(/\/$/, '')
  
  try {
    for (const path of CAREER_PATHS) {
      try {
        await page.goto(baseUrl + path, { waitUntil: 'networkidle2', timeout: 12000 })
        await page.waitForSelector('a', { timeout: 3000 }).catch(() => {})
        
        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.innerText?.trim().slice(0, 200),
            href: a.href,
            location: a.closest('div, li, tr')?.querySelector('[class*="location"]')?.textContent?.trim()
          })).filter(l => l.text && l.href)
        })
        
        for (const link of links) {
          const isJob = JOB_LINK_PATTERNS.some(p => p.test(link.href)) ||
            /engineer|developer|manager|designer|analyst|director|lead|senior/i.test(link.text)
          if (isJob && link.text.length > 5 && link.text.length < 150 && 
              !jobs.some(j => j.url === link.href) &&
              !/(about|contact|blog|privacy|terms|sign|log)/i.test(link.text)) {
            jobs.push({ title: link.text, url: link.href, location: link.location })
          }
        }
        if (jobs.length > 0) break
      } catch { continue }
    }
  } finally { await page.close() }
  return jobs.slice(0, 50)
}

async function main() {
  const companies = await prisma.company.findMany({
    where: { atsUrl: null, website: { not: null }, name: { not: 'Add Your Company' } },
    take: 20
  })
  
  console.log(`\n🔍 Scraping ${companies.length} companies...\n`)
  const browser = await puppeteer.launch({ headless: true })
  let totalJobs = 0, success = 0
  
  for (const c of companies) {
    if (!c.website) continue
    process.stdout.write(`${c.name.slice(0, 25).padEnd(25)} `)
    try {
      const jobs = await scrapeCareerPage(browser, c.website)
      if (jobs.length > 0) {
        console.log(`✓ ${jobs.length} jobs`)
        success++
        for (const job of jobs) {
          try {
            const result = await ingestJob({
              externalId: `career-${Buffer.from(job.url).toString('base64').slice(0, 20)}`,
              title: job.title,
              rawCompanyName: c.name,  // Fixed!
              companyWebsiteUrl: c.website,
              locationText: job.location || 'Remote',
              url: job.url,
              applyUrl: job.url,
              descriptionText: null,
              descriptionHtml: null,
              postedAt: new Date(),
              source: 'board:career-page',
              isRemote: /remote/i.test(job.location || job.title),
              salaryMin: null,
              salaryMax: null,
              salaryCurrency: null,
              salaryInterval: null,
              employmentType: null
            })
            if (result.status === 'created') totalJobs++
          } catch (e) { console.log(`    Error: ${e}`) }
        }
      } else console.log('✗')
    } catch (e: any) { console.log(`✗ ${e.message?.slice(0, 30)}`) }
  }
  
  await browser.close()
  console.log(`\n✅ ${success} companies, ${totalJobs} NEW jobs ingested`)
  
  const total = await prisma.job.count({ where: { isExpired: false } })
  const careerJobs = await prisma.job.count({ where: { source: 'board:career-page' } })
  console.log(`Total: ${total} | Career page: ${careerJobs}\n`)
  
  await prisma.$disconnect()
}
main()
