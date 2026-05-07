// lib/scrapers/realworkfromanywhere.ts
import * as cheerio from 'cheerio'
import { upsertBoardJob } from './_boardHelpers'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'
import { detectATS, getCompanyJobsUrl, isExternalToHost, toAtsProvider } from './utils/detectATS'
import { saveCompanyATS } from './utils/saveCompanyATS'

const BOARD = 'realworkfromanywhere'
const BASE_URL = 'https://www.realworkfromanywhere.com'

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SixFigureJobsBot/1.0)' },
    })
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

function absolute(url: string) {
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

function extractDescription($: cheerio.CheerioAPI): string | null {
  const selectors = [
    '.job-description', '.job-content', '.description', '#job-description',
    'article .content', 'main article', '.post-content', 'main',
  ]
  for (const sel of selectors) {
    const $el = $(sel).first()
    if (!$el.length) continue
    const text = $el.text().replace(/\s+/g, ' ').trim()
    if (text.length >= 200) return $el.html() || null
  }
  return null
}

function extractSalary($: cheerio.CheerioAPI): string | null {
  const text = $('body').text()
  const m = text.match(/\$\s*[\d,]+\s*[kK]?\s*[-–]\s*\$?\s*[\d,]+\s*[kK]?|\$\s*[\d,]+\s*[kK]?\s*(?:per\s+year|\/\s*yr?|annual)/i)
  return m ? m[0].trim() : null
}

export async function scrapeRealWorkFromAnywhere(): Promise<ScraperStats> {
  console.log('[RealWorkFromAnywhere] Starting scrape...')

  try {
    const html = await fetchHtml(BASE_URL + '/')
    if (!html) throw new Error('Failed to fetch homepage')

    const $ = cheerio.load(html)
    const jobHrefs = new Set<string>()

    $('a[href^="/jobs/"]').each((_i, el) => {
      const href = $(el).attr('href')
      if (!href) return
      jobHrefs.add(href.split('#')[0].split('?')[0])
    })

    console.log(`[RWFA] Found ${jobHrefs.size} job links on homepage`)

    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    for (const href of jobHrefs) {
      try {
        const url = absolute(href)
        const jobHtml = await fetchHtml(url)
        if (!jobHtml) { stats.skipped++; continue }

        const $$ = cheerio.load(jobHtml)
        const h1Text = $$('h1').first().text().trim()
        if (!h1Text) { stats.skipped++; continue }

        let company = 'Unknown company'
        let title = h1Text
        if (h1Text.includes(':')) {
          const colonIdx = h1Text.indexOf(':')
          company = h1Text.slice(0, colonIdx).trim() || company
          title = h1Text.slice(colonIdx + 1).trim() || title
        }

        let location: string | null = null
        $$('.job-header, .job-meta, main').first().find('p, li, span').each((_j, node) => {
          const t = $$(node).text().trim()
          if (t && /worldwide|anywhere|remote|europe|usa|uk|canada/i.test(t) && !location) {
            location = t.slice(0, 100)
          }
        })

        const descriptionHtml = extractDescription($$)
        const salaryText = extractSalary($$)

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

        const externalId = href.replace(/^\/jobs\//, '').replace(/\/$/, '')
        const result = await upsertBoardJob({
          board: BOARD,
          externalId,
          title,
          company,
          url,
          applyUrl: applyHref,
          location,
          descriptionHtml,
          salaryText,
          remote: true,
          explicitAtsProvider,
          explicitAtsUrl,
        })
        addBoardIngestResult(stats, result)

        await new Promise((r) => setTimeout(r, 150))
      } catch (err) {
        console.error(`[RWFA] Error scraping job ${href}`, err)
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
