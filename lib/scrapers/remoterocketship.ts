// lib/scrapers/remoterocketship.ts
// RemoteRocketship → 100k+ jobs + company discovery + gentle 429 backoff.
//
// - Scrapes main listing with minSalary=100000 and hybrid/onsite enabled.
// - Uses ingestBoardJob so board jobs are *fallback* to ATS/company jobs.
// - Keeps requests light and respects 429 responses.

import * as cheerio from 'cheerio'
import { ingestBoardJob } from '../jobs/ingestBoardJob'

const BOARD_NAME = 'remoterocketship'
const BASE_URL = 'https://www.remoterocketship.com'

const BASE_LISTING_URL =
  `${BASE_URL}/?sort=DateAdded&minSalary=100000` +
  `&showHybridJobs=true&showOnsiteJobs=true`

// Keep this modest; RemoteRocketship is sensitive to scraping.
const MAX_PAGES = 2
const PAGE_DELAY_MS = 5000

async function fetchWithBackoff(url: string, attempt = 1): Promise<Response | null> {
  const maxAttempts = 5
  const baseDelay = 2500
  const delayMs = baseDelay * attempt + Math.random() * 1000

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Remote100k/1.0 (+remoterocketship-scraper)',
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
  console.log('Scraping RemoteRocketship (100k+ jobs)…')

  let jobsNew = 0
  let jobsUpdated = 0
  let jobsSkipped = 0
  const companies = new Set<string>()
  const seenJobs = new Set<string>()

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${BASE_LISTING_URL}&page=${page}`

    const res = await fetchWithBackoff(url)
    if (!res) {
      if (page === 1) {
        console.warn(`[${BOARD_NAME}] Failed to fetch page 1, aborting.`)
      } else {
        console.warn(
          `[${BOARD_NAME}] Stopping pagination at page=${page} due to repeated failures.`,
        )
      }
      break
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    $('a[href*="/jobs/"]').each((_, el) => {
      const $link = $(el)
      const href = $link.attr('href')
      if (!href) return

      const jobUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
      if (seenJobs.has(jobUrl)) return
      seenJobs.add(jobUrl)

      const $card = $link.closest('article,li,div')

      const title =
        $card.find('h2,h3,[data-testid*="title"]').first().text().trim() ||
        $link.text().trim()
      if (!title) return

      const company =
        $card
          .find('.company-name, .company, [data-testid*="company"]')
          .first()
          .text()
          .trim() || null

      const locationText =
        $card
          .find(
            '.location, [data-testid*="location"], [class*="Location"], [class*="location"]',
          )
          .first()
          .text()
          .trim() || null

      const salaryText =
        $card
          .find(
            '.salary, [data-testid*="salary"], [class*="Salary"], [class*="salary"]',
          )
          .first()
          .text()
          .trim() || null

      let salaryMin: number | null = null
      let salaryMax: number | null = null
      let salaryCurrency: string | null = null
      let salaryInterval: string | null = 'year'

      if (!salaryText) {
        salaryMin = 100000
        salaryCurrency = 'USD'
      }

      const resultPromise = ingestBoardJob(BOARD_NAME, {
        externalId: jobUrl,
        title,
        url: jobUrl,
        rawCompanyName: company,
        locationText,
        salaryMin,
        salaryMax,
        salaryCurrency,
        salaryInterval,
        isRemote: true,
        employmentType: null,
        postedAt: null,
        updatedAt: null,
        descriptionHtml: null,
        descriptionText: salaryText || null,
        companyWebsiteUrl: null,
        applyUrl: jobUrl,
        explicitAtsProvider: null,
        explicitAtsUrl: null,
        raw: { url: jobUrl, title, company, locationText, salaryText },
      })

      resultPromise
        .then((result) => {
          if (company) companies.add(company)
          if (result === 'new') jobsNew++
          else if (result === 'updated') jobsUpdated++
          else jobsSkipped++
        })
        .catch((err) => {
          console.error(
            `[${BOARD_NAME}] Error ingesting job ${jobUrl}:`,
            err?.message || err,
          )
          jobsSkipped++
        })
    })

    if (page < MAX_PAGES) {
      await new Promise((r) => setTimeout(r, PAGE_DELAY_MS))
    }
  }

  console.log(
    `[${BOARD_NAME}] Done: jobsNew=${jobsNew}, jobsUpdated=${jobsUpdated}, jobsSkipped=${jobsSkipped}, uniqueCompanies=${companies.size}`,
  )

  return {
    jobsNew,
    jobsUpdated,
    jobsSkipped,
    companiesSeen: companies.size,
  }
}
