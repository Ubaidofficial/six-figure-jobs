// lib/scrapers/generic.ts
// Scrapes generic career pages for companies without ATS
import puppeteer from 'puppeteer'
import type { Page } from 'puppeteer'
import { PrismaClient } from '@prisma/client'
import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'

const prisma = new PrismaClient()

const CAREER_PAGE_KEYWORDS = [
  'careers',
  'jobs',
  'join',
  'work-with-us',
  'opportunities',
  'hiring',
  'positions',
  'openings',
]

export default async function scrapeGenericSources() {
  console.log('[GenericSources] Starting scrape...')

  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  }

  try {
    const sources = await prisma.companySource.findMany({
      where: {
        sourceType: 'generic_careers_page',
        isActive: true,
      },
      include: {
        company: {
          select: {
            name: true,
            website: true,
          },
        },
      },
      take: 50,
    })

    if (!sources.length) {
      console.log('[GenericSources] No generic sources found')
      return stats
    }

    console.log(`[GenericSources] Found ${sources.length} sources to scrape`)

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    for (const source of sources) {
      const page = await browser.newPage()

      try {
        console.log(`   -> Scraping ${source.url}`)

        await page.goto(source.url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })

        const jobs = await scanPageForJobs(page)

        if (jobs.length > 0) {
          console.log(`   -> Found ${jobs.length} potential jobs`)

          for (const job of jobs) {
            const description = await scrapeJobDescription(browser, job.url)

            const result = await ingestJob({
              externalId: Buffer.from(job.url).toString('base64').slice(0, 32),
              title: job.title,
              rawCompanyName: source.company.name,
              companyWebsiteUrl: source.company.website,
              url: job.url,
              applyUrl: job.url,
              source: makeBoardSource('generic_career_page'),
              descriptionHtml: description || undefined,
              postedAt: new Date(),
              isRemote: true,
            })

            if (result.status === 'created') stats.created++
            else if (result.status === 'updated') stats.updated++
            else stats.skipped++
          }
        }

        await prisma.companySource.update({
          where: { id: source.id },
          data: { lastScrapedAt: new Date(), scrapeStatus: 'success' },
        })
      } catch (err) {
        console.error(`   -> Error scraping ${source.url}:`, err)
        stats.errors++

        await prisma.companySource.update({
          where: { id: source.id },
          data: { 
            scrapeStatus: 'error', 
            scrapeError: String(err).slice(0, 100) 
          },
        })
      } finally {
        await page.close()
      }
    }

    await browser.close()
  } catch (err) {
    console.error('[GenericSources] Fatal error:', err)
    stats.errors++
  } finally {
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
    const jobs: Array<{ title: string; url: string }> = []
    const links = Array.from(document.querySelectorAll('a[href]'))

    for (const link of links) {
      const href = (link as HTMLAnchorElement).href
      const text = link.textContent?.toLowerCase() || ''

      const isJobLink = keywords.some((kw) => 
        href.toLowerCase().includes(kw) || text.includes(kw)
      )

      if (isJobLink && !jobs.find((j) => j.url === href)) {
        jobs.push({
          title: link.textContent?.trim() || 'Untitled Position',
          url: href,
        })
      }
    }

    return jobs.slice(0, 50)
  }, CAREER_PAGE_KEYWORDS)
}

async function scrapeJobDescription(browser: any, url: string): Promise<string | null> {
  const page = await browser.newPage()
  
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    const description = await page.evaluate(() => {
      const selectors = [
        '.job-description',
        '#job-description',
        '[class*="description"]',
        '[class*="content"]',
        'main',
        'article',
      ]

      for (const selector of selectors) {
        const elem = document.querySelector(selector)
        if (elem && elem.textContent && elem.textContent.length > 200) {
          return elem.innerHTML
        }
      }

      return document.body.innerHTML
    })

    return description
  } catch (err) {
    console.error(`   -> Error fetching description from ${url}:`, err)
    return null
  } finally {
    await page.close()
  }
}
