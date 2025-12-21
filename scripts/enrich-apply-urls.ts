// scripts/enrich-apply-urls.ts
// Extracts direct apply URLs from job board aggregator pages

import puppeteer from 'puppeteer'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BATCH_SIZE = 50
const DELAY_BETWEEN_REQUESTS = 2000 // 2 seconds

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface JobToEnrich {
  id: string
  url: string
  source: string
}

async function extractApplyUrl(page: any, url: string, source: string): Promise<string | null> {
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    await delay(2000)

    let applyUrl: string | null = null

    // Source-specific extraction logic
    if (source === 'board:remote100k') {
      applyUrl = await page.evaluate(() => {
        // Find "Apply Now" button - look for common ATS domains first
        const atsLinks = Array.from(document.querySelectorAll('a[href]')).filter((link) => {
          const href = (link as HTMLAnchorElement).href
          return href.includes('greenhouse.io') || 
                 href.includes('lever.co') || 
                 href.includes('ashbyhq.com') ||
                 href.includes('workday.com') ||
                 href.includes('myworkdayjobs.com')
        })
        
        if (atsLinks.length > 0) {
          return (atsLinks[0] as HTMLAnchorElement).href
        }
        
        // Fallback: find "Apply" button
        const applyButtons = Array.from(document.querySelectorAll('a, button')).filter((el) => {
          const text = el.textContent?.toLowerCase() || ''
          return text.includes('apply now') || text.includes('apply for this job')
        })
        
        if (applyButtons.length > 0) {
          const btn = applyButtons[0] as HTMLAnchorElement
          if (btn.href && !btn.href.includes('remote100k.com')) {
            return btn.href
          }
        }
        
        return null
      })
    } else if (source === 'board:remoteotter') {
      applyUrl = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'))
        for (const link of links) {
          const href = (link as HTMLAnchorElement).href
          if (href.includes('greenhouse.io') || href.includes('lever.co') || href.includes('ashbyhq.com')) {
            return href
          }
        }
        return null
      })
    } else if (source === 'board:realworkfromanywhere') {
      applyUrl = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'))
        for (const link of links) {
          const href = (link as HTMLAnchorElement).href
          if (href.includes('greenhouse.io') || href.includes('lever.co') || href.includes('ashbyhq.com')) {
            return href
          }
        }
        return null
      })
    } else if (source === 'board:remotive') {
      applyUrl = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'))
        for (const link of links) {
          const href = (link as HTMLAnchorElement).href
          if (href.includes('greenhouse.io') || href.includes('lever.co') || href.includes('ashbyhq.com')) {
            return href
          }
        }
        return null
      })
    }

    return applyUrl

  } catch (err) {
    console.error(`❌ Error extracting apply URL from ${url}:`, err)
    return null
  }
}

async function enrichApplyUrls(sources: string[], dryRun = false) {
  console.log(`\n🚀 Starting apply URL enrichment for sources: ${sources.join(', ')}`)
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}\n`)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    for (const source of sources) {
      console.log(`\n📋 Processing source: ${source}`)

      // Get jobs that need enrichment
      const jobs = await prisma.job.findMany({
        where: {
          source,
          applyUrl: {
            contains: source.replace('board:', ''),
          },
        },
        select: {
          id: true,
          url: true,
          source: true,
        },
        take: BATCH_SIZE,
      })

      console.log(`Found ${jobs.length} jobs to enrich`)

      if (jobs.length === 0) continue

      const page = await browser.newPage()
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      )

      let enriched = 0
      let failed = 0

      for (const job of jobs) {
        console.log(`Processing: ${job.url}`)

        const directUrl = await extractApplyUrl(page, job.url, job.source)

        if (directUrl) {
          console.log(`  ✅ Found: ${directUrl}`)

          if (!dryRun) {
            await prisma.job.update({
              where: { id: job.id },
              data: { applyUrl: directUrl },
            })
          }

          enriched++
        } else {
          console.log(`  ❌ No direct URL found`)
          failed++
        }

        await delay(DELAY_BETWEEN_REQUESTS)
      }

      await page.close()

      console.log(`\n✅ ${source}: Enriched ${enriched}, Failed ${failed}`)
    }

  } finally {
    await browser.close()
    await prisma.$disconnect()
  }
}

// Run enrichment
const sources = [
  'board:remote100k',
  // 'board:remoteotter', // TODO: Fix scraper - storing category pages instead of job URLs // Disabled: scraper has bugs
  'board:realworkfromanywhere',
  'board:remotive',
]

const dryRun = process.argv.includes('--dry-run')

enrichApplyUrls(sources, dryRun)
  .then(() => {
    console.log('\n✅ Enrichment complete!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  })
