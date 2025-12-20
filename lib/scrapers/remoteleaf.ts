// lib/scrapers/remoteleaf.ts
// Scrapes jobs from https://remoteleaf.com/remote-jobs
import axios from 'axios'
import * as cheerio from 'cheerio'

import { upsertBoardJob } from './_boardHelpers'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'

const BOARD = 'remoteleaf'
const BASE_URL = 'https://remoteleaf.com'
const LIST_URL = `${BASE_URL}/remote-jobs`

function absolute(href: string): string {
  if (href.startsWith('http')) return href
  return `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`
}

export default async function scrapeRemoteLeaf(): Promise<ScraperStats> {
  console.log('[RemoteLeaf] Starting scrape...')

  try {
    const response = await axios.get(LIST_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 6FigJobs/1.0)' },
      timeout: 30000,
    })

    const $ = cheerio.load(response.data)
    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    const jobLinks = new Map<string, any>()

    // Heuristic: a link containing "/remote-jobs/" or "/jobs/" is likely a job detail link.
    $('a[href]').each((_i, el) => {
      const href = $(el).attr('href')
      if (!href) return
      if (!href.includes('job') && !href.includes('remote-jobs')) return
      if (href.startsWith('#')) return
      if (href.includes('remote-jobs') && href === '/remote-jobs') return

      const normalized = href.split('#')[0]
      if (!jobLinks.has(normalized)) jobLinks.set(normalized, el)
    })

    for (const [href, el] of jobLinks) {
      try {
        const $el = $(el)
        const card = $el.closest('.job-listing, .job, article, li, div')

        const title =
          card.find('.title, .job-title, h3, h2').first().text().trim() ||
          $el.find('.title, .job-title, h3, h2').first().text().trim() ||
          $el.text().trim().split('\n')[0]?.trim() ||
          ''

        const company =
          card.find('.company, .company-name').first().text().trim() ||
          $el.find('.company, .company-name').first().text().trim() ||
          ''

        if (!title || !company) {
          stats.skipped++
          continue
        }

        const salaryText =
          card.find('.salary, [data-salary]').first().text().trim() ||
          $el.find('.salary, [data-salary]').first().text().trim() ||
          null

        const url = absolute(href)
        const externalId = url.replace(BASE_URL, '').replace(/^\/+/, '').split('?')[0] || url

        const result = await upsertBoardJob({
          board: BOARD,
          externalId,
          title,
          company,
          applyUrl: url,
          salaryText,
          remote: true,
        })

        addBoardIngestResult(stats, result)
      } catch (err) {
        console.error('[RemoteLeaf] Job parse/ingest failed:', err)
        stats.skipped++
      }
    }

    console.log(`[RemoteLeaf] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[RemoteLeaf] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
