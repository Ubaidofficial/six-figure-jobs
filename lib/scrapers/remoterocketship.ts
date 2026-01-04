// lib/scrapers/remoterocketship.ts
// RemoteRocketship → 100k+ jobs + company discovery + gentle 429 backoff.
//
// - Scrapes main listing with minSalary=100000 and hybrid/onsite enabled.
// - Uses ingestBoardJob so board jobs are *fallback* to ATS/company jobs.
// - Keeps requests light and respects 429 responses.

import * as cheerio from 'cheerio'
import { ingestBoardJob } from '../jobs/ingestBoardJob'
import { parseSalaryFromText } from '../normalizers/salary'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'
import { extractApplyDestinationFromHtml } from './utils/extractApplyLink'
import { detectATS, getCompanyJobsUrl, isExternalToHost, toAtsProvider } from './utils/detectATS'
import { saveCompanyATS } from './utils/saveCompanyATS'

const BOARD_NAME = 'remoterocketship'
const BASE_URL = 'https://www.remoterocketship.com'

const BASE_LISTING_URL =
  `${BASE_URL}/?sort=DateAdded&minSalary=100000` +
  `&showHybridJobs=true&showOnsiteJobs=true`

// Keep this very modest; RemoteRocketship is sensitive to scraping.
const MAX_PAGES = 1
const PAGE_DELAY_MS = 6000
const JOB_DETAIL_DELAY_MS = 1200

function extractDescriptionFromJobPageHtml(html: string): { html: string | null; text: string | null } {
  if (!html) return { html: null, text: null }

  const $ = cheerio.load(html)

  const selectors = [
    '[data-testid*="description"]',
    '[class*="description"]',
    '.job-description',
    'article',
    'main article',
    'main',
    '[role="main"]',
  ]

  for (const sel of selectors) {
    const $el = $(sel).first()
    const t = $el.text().replace(/\s+/g, ' ').trim()
    if ($el.length && t.length >= 500) {
      return { html: $.html($el.get(0)), text: t }
    }
  }

  // Fallback: find the largest "contenty" container in main.
  const candidates = $('main div, main section, main article, article, [role="main"] div, [role="main"] section')
  let bestHtml: string | null = null
  let bestText: string | null = null
  let bestScore = 0

  candidates.each((_i, el) => {
    const $el = $(el)
    const text = $el.text().replace(/\s+/g, ' ').trim()
    if (text.length < 500) return

    const pCount = $el.find('p').length
    const liCount = $el.find('li').length
    const linkCount = $el.find('a').length

    let score = text.length + pCount * 120 + liCount * 80
    if (linkCount > 20) score *= 0.2

    if (score > bestScore) {
      bestScore = score
      bestHtml = $.html($el.get(0))
      bestText = text
    }
  })

  return { html: bestHtml, text: bestText }
}

async function fetchWithBackoff(url: string, attempt = 1): Promise<Response | null> {
  const maxAttempts = 3
  const baseDelay = 4000
  const delayMs = baseDelay * attempt + Math.random() * 1500

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SixFigureJobs/1.0 (+remoterocketship-scraper)',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    })

    if (res.status === 429 || res.status >= 500) {
      console.warn(
        `[${BOARD_NAME}] HTTP ${res.status} for ${url} (attempt ${attempt}/${maxAttempts})`,
      )
      if (attempt >= maxAttempts) {
        console.warn(
          `[${BOARD_NAME}] Giving up on ${url} after ${attempt} attempts due to ${res.status}`,
        )
        return null
      }
      await new Promise((r) => setTimeout(r, delayMs))
      return fetchWithBackoff(url, attempt + 1)
    }

    if (!res.ok) {
      console.error(`[${BOARD_NAME}] HTTP ${res.status} for ${url}`)
      return null
    }

    return res
  } catch (err: any) {
    console.error(
      `[${BOARD_NAME}] Network error for ${url} (attempt ${attempt}):`,
      err?.message || err,
    )
    if (attempt >= maxAttempts) return null
    await new Promise((r) => setTimeout(r, delayMs))
    return fetchWithBackoff(url, attempt + 1)
  }
}

export default async function scrapeRemoteRocketship() {
  console.log('[RemoteRocketship] Starting scrape...')

  try {
    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }
    const seenJobs = new Set<string>()

    type Parsed = {
      jobUrl: string
      title: string
      company: string | null
      locationText: string | null
      salaryText: string | null
    }

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${BASE_LISTING_URL}&page=${page}`

      const res = await fetchWithBackoff(url)
      if (!res) {
        if (page === 1) {
          console.warn(`[${BOARD_NAME}] Failed to fetch page 1 (rate limited), skipping this run.`)
        } else {
          console.warn(`[${BOARD_NAME}] Stopping pagination at page=${page} due to repeated failures.`)
        }
        break
      }

      const html = await res.text()
      const $ = cheerio.load(html)

      const parsedJobs: Parsed[] = []

      $('a[href*="/jobs/"]').each((_, el) => {
        const $link = $(el)
        const href = $link.attr('href')
        if (!href) return

        const jobUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
        if (seenJobs.has(jobUrl)) return
        seenJobs.add(jobUrl)

        const $card = $link.closest('article,li,div')

        const title =
          $card.find('h2,h3,[data-testid*="title"]').first().text().trim() || $link.text().trim()
        if (!title) return

        const company =
          $card.find('.company-name, .company, [data-testid*="company"]').first().text().trim() ||
          null

        const locationText =
          $card
            .find('.location, [data-testid*="location"], [class*="Location"], [class*="location"]')
            .first()
            .text()
            .trim() || null

        const salaryText =
          $card
            .find('.salary, [data-testid*="salary"], [class*="Salary"], [class*="salary"]')
            .first()
            .text()
            .trim() || null

        parsedJobs.push({ jobUrl, title, company, locationText, salaryText })
      })

      for (const j of parsedJobs) {
        try {
          let descriptionHtml: string | null = null
          let descriptionText: string | null = null
          let applyUrl: string = j.jobUrl

          // RemoteRocketship doesn't expose description in list view; fetch detail page (lightly).
          const detailRes = await fetchWithBackoff(j.jobUrl)
          if (detailRes) {
            const detailHtml = await detailRes.text()
            const extracted = extractDescriptionFromJobPageHtml(detailHtml)
            descriptionHtml = extracted.html
            descriptionText = extracted.text

            const discoveredApplyUrl = extractApplyDestinationFromHtml(detailHtml, j.jobUrl)
            if (discoveredApplyUrl && isExternalToHost(discoveredApplyUrl, 'remoterocketship.com')) {
              applyUrl = discoveredApplyUrl
              if (j.company) {
                await saveCompanyATS(j.company, discoveredApplyUrl, BOARD_NAME)
              }
            }
          }

          // Parse salary from the listing chip if present.
          const parsedSalary = j.salaryText ? parseSalaryFromText(j.salaryText) : null
          const atsType = detectATS(applyUrl)
          const explicitAtsProvider = toAtsProvider(atsType)
          const explicitAtsUrl = explicitAtsProvider ? getCompanyJobsUrl(applyUrl, atsType) : null

          const result = await ingestBoardJob(BOARD_NAME, {
            externalId: j.jobUrl,
            title: j.title,
            url: j.jobUrl,
            rawCompanyName: j.company,
            locationText: j.locationText,
            salaryMin: parsedSalary?.min ?? null,
            salaryMax: parsedSalary?.max ?? null,
            salaryCurrency: parsedSalary?.currency ?? null,
            salaryInterval: parsedSalary?.interval ?? 'year',
            isRemote: true,
            employmentType: null,
            postedAt: null,
            updatedAt: null,
            descriptionHtml,
            descriptionText,
            companyWebsiteUrl: null,
            applyUrl,
            explicitAtsProvider,
            explicitAtsUrl,
            raw: j,
          })
          addBoardIngestResult(stats, result)
        } catch (err: any) {
          console.error(`[${BOARD_NAME}] Error ingesting job ${j.jobUrl}:`, err?.message || err)
          stats.skipped++
        }

        await new Promise((r) => setTimeout(r, JOB_DETAIL_DELAY_MS))
      }

      if (page < MAX_PAGES) {
        await new Promise((r) => setTimeout(r, PAGE_DELAY_MS))
      }
    }

    console.log(`[RemoteRocketship] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[RemoteRocketship] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
