// lib/scrapers/realworkfromanywhere.ts
import * as cheerio from 'cheerio'
import { upsertBoardJob } from './_boardHelpers'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'
import { detectATS, getCompanyJobsUrl, isExternalToHost, toAtsProvider } from './utils/detectATS'
import { saveCompanyATS } from './utils/saveCompanyATS'

const BOARD = 'realworkfromanywhere'
const BASE_URL = 'https://www.realworkfromanywhere.com'

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SixFigureJobsBot/1.0)',
    },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }
  return res.text()
}

function absolute(url: string) {
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

export async function scrapeRealWorkFromAnywhere(): Promise<ScraperStats> {
  console.log('[RealWorkFromAnywhere] Starting scrape...')

  try {
    const html = await fetchHtml(BASE_URL + '/')
    const $ = cheerio.load(html)

    const jobHrefs = new Set<string>()

    $('a[href^="/jobs/"]').each((_i, el) => {
      const href = $(el).attr('href')
      if (!href) return
      // Avoid nav / footer duplicates later by Set
      jobHrefs.add(href.split('#')[0])
    })

    console.log(`  Found ${jobHrefs.size} job links on homepage`)

    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    for (const href of jobHrefs) {
      try {
        const url = absolute(href)
        const jobHtml = await fetchHtml(url)
        const $$ = cheerio.load(jobHtml)

        // H1 usually looks like: "White Bridge LTD: Junior Crypto Analyst & Trader …"
        const h1Text = $$('h1').first().text().trim()

        if (!h1Text) {
          console.log(`    ⚠️ No H1 for ${url}, skipping`)
          stats.skipped++
          continue
        }

        let company = 'Unknown company'
        let title = h1Text

        if (h1Text.includes(':')) {
          const [before, after] = h1Text.split(':', 2)
          company = before.trim() || company
          title = after.trim() || title
        }

        // Location is often somewhere near the top – grab the first "Worldwide"/"Remote"/etc line heuristically
        let location: string | null = null
        $$('.job-header, .job-meta, main')
          .first()
          .find('p, li, span')
          .each((_j, node) => {
            const t = $$(node).text().trim()
            if (!t) return
            if (/worldwide|anywhere|remote|europe|usa|uk|canada/i.test(t) && !location) {
              location = t
            }
          })

        // Usually apply button links out to external careers site; fall back to detail URL
        const applyHref =
          $$('a[href^="https://"]')
            .filter((_i, el) => /apply|apply now|view job/i.test($$(el).text()))
            .first()
            .attr('href') || url

        const atsType = detectATS(applyHref)
        const explicitAtsProvider = toAtsProvider(atsType)
        const explicitAtsUrl = explicitAtsProvider ? getCompanyJobsUrl(applyHref, atsType) : null

        if (company && isExternalToHost(applyHref, 'realworkfromanywhere.com')) {
          await saveCompanyATS(company, applyHref, BOARD)
        }

        const externalId = href.replace(/^\/jobs\//, '')
        const result = await upsertBoardJob({
          board: BOARD,
          externalId,
          title,
          company,
          url,
          applyUrl: applyHref,
          location,
          explicitAtsProvider,
          explicitAtsUrl,
        })
        addBoardIngestResult(stats, result)
      } catch (err) {
        console.error(`    ❌ Error scraping job ${href}`, err)
        stats.skipped++
      }
    }

    console.log(`[RealWorkFromAnywhere] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[RealWorkFromAnywhere] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
