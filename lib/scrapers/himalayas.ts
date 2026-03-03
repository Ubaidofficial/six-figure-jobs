// lib/scrapers/himalayas.ts
// Scrapes jobs from https://himalayas.app/jobs/remote
import axios from 'axios'
import * as cheerio from 'cheerio'

import { upsertBoardJob } from './_boardHelpers'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'
import { detectATS, getCompanyJobsUrl, isExternalToHost, toAtsProvider } from './utils/detectATS'
import { discoverApplyUrlFromPage } from './utils/discoverApplyUrl'
import { saveCompanyATS } from './utils/saveCompanyATS'

const BOARD = 'himalayas'
const BASE_URL = 'https://himalayas.app'
const LIST_URL = `${BASE_URL}/jobs/remote`

function absolute(href: string): string {
  if (href.startsWith('http')) return href
  return `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`
}

export default async function scrapeHimalayas(): Promise<ScraperStats> {
  console.log('[Himalayas] Starting scrape...')

  try {
    const response = await axios.get(LIST_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 6FigJobs/1.0)' },
      timeout: 30000,
    })

    const $ = cheerio.load(response.data)
    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    // Heuristic job cards: a link to /jobs/... with a heading inside.
    const jobLinks = new Map<string, any>()

    $('a[href^="/jobs/"]').each((_i, el) => {
      const href = $(el).attr('href')
      if (!href) return
      if (href.startsWith('/jobs/remote')) return
      const normalized = href.split('#')[0]
      if (!jobLinks.has(normalized)) jobLinks.set(normalized, el)
    })

    for (const [href, el] of jobLinks) {
      try {
        const $el = $(el)
        const url = absolute(href)
        const externalId = href.replace(/^\/jobs\//, '').split('?')[0] || url

        const title =
          $el.find('.job-title, h3, h2').first().text().trim() ||
          $el.text().trim().split('\n')[0]?.trim() ||
          ''

        // Try to find a nearby company name
        const company =
          $el.find('.company-name, [data-company], .company').first().text().trim() ||
          $el.closest('article, li, div').find('.company-name, [data-company], .company').first().text().trim() ||
          ''

        if (!title || !company) {
          stats.skipped++
          continue
        }

        const location =
          $el.find('.location, [data-location]').first().text().trim() ||
          $el.closest('article, li, div').find('.location, [data-location]').first().text().trim() ||
          null

        let applyUrl = url
        const discoveredApplyUrl = await discoverApplyUrlFromPage(url)
        if (discoveredApplyUrl && isExternalToHost(discoveredApplyUrl, 'himalayas.app')) {
          applyUrl = discoveredApplyUrl
        }

        const atsType = detectATS(applyUrl)
        const explicitAtsProvider = toAtsProvider(atsType)
        const explicitAtsUrl = explicitAtsProvider ? getCompanyJobsUrl(applyUrl, atsType) : null

        if (company && isExternalToHost(applyUrl, 'himalayas.app')) {
          await saveCompanyATS(company, applyUrl, BOARD)
        }

        const result = await upsertBoardJob({
          board: BOARD,
          externalId,
          title,
          company,
          url,
          applyUrl,
          location,
          remote: true,
          explicitAtsProvider,
          explicitAtsUrl,
        })

        addBoardIngestResult(stats, result)
      } catch (err) {
        console.error('[Himalayas] Job parse/ingest failed:', err)
        stats.skipped++
      }
    }

    console.log(`[Himalayas] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[Himalayas] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
