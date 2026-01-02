import * as cheerio from 'cheerio'

import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'
import type { ScrapedJobInput } from '../ingest/types'
import { addIngestStatus, errorStats, type ScraperStats } from './scraperStats'
import { discoverApplyUrlFromPage } from './utils/discoverApplyUrl'
import { detectATS, getCompanyJobsUrl, isExternalToHost, toAtsProvider } from './utils/detectATS'
import { saveCompanyATS } from './utils/saveCompanyATS'

const BOARD_NAME = 'builtin'
const BASE_URL = 'https://builtin.com'

const CITIES = [
  'san-francisco',
  'austin',
  'los-angeles',
  'boston',
  'chicago',
]

const PAGE_DELAY_MS = 2000
const MAX_PAGES_PER_CITY = 10

async function fetchCityJobs(city: string): Promise<any[]> {
  const jobs: any[] = []
  const seenUrls = new Set<string>()

  for (let page = 1; page <= MAX_PAGES_PER_CITY; page++) {
    // BuiltIn city listings are under `/jobs/<city>` (not `/<city>/jobs`).
    // Example: https://builtin.com/jobs/san-francisco?salary_floor=100000&page=1
    const url = `${BASE_URL}/jobs/${city}?salary_floor=100000&page=${page}`

    console.log(`[BuiltIn] Fetching ${city} page ${page}`)

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.warn(`[BuiltIn] Failed ${city} page ${page}: ${res.status}`)
      break
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    const selectors = [
      '[data-id="job-card"]',
      '[id^="job-card-"]',
      '[data-id*="job-card"]',
    ]

    let foundOnPage = 0

    for (const selector of selectors) {
      const matches = $(selector)
      if (matches.length === 0) continue

      console.log(`[BuiltIn] Found ${matches.length} jobs on ${city} page ${page}`)

      matches.each((_i, el) => {
        const $el = $(el)

        let titleEl = $el.find('a[data-id="job-card-title"][href]').first()
        if (!titleEl.length) {
          titleEl = $el.find('a[href^="/job/"][href]').first()
        }

        const title = titleEl.text().trim()
        const href = titleEl.attr('href')

        if (!title || !href) return

        const jobUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
        if (seenUrls.has(jobUrl)) return
        seenUrls.add(jobUrl)

        const domId = $el.attr('id') || ''
        const idMatch = domId.match(/job-card-(\d+)/)
        const jobId = idMatch?.[1] || jobUrl.split('/').pop() || jobUrl

        const company =
          $el.find('a[data-id="company-title"] span').first().text().trim() ||
          $el.find('a[data-id="company-title"]').first().text().trim() ||
          $el.find('[class*="company"]').first().text().trim()

        const location =
          $el.find('[data-id*="location"]').first().text().trim() ||
          $el.find('[class*="location"]').first().text().trim() ||
          city

        const salary =
          $el.find('[data-id*="salary"]').first().text().trim() ||
          $el.find('[class*="salary"], [class*="compensation"]').first().text().trim() ||
          null

        jobs.push({
          id: jobId,
          title,
          company,
          location,
          salary,
          url: jobUrl,
          description: null,
          city,
          page,
        })

        foundOnPage++
      })

      // Use the first selector that yields results (BuiltIn changes markup often)
      break
    }

    if (foundOnPage === 0) {
      console.log(`[BuiltIn] No jobs found on ${city} page ${page}, stopping`)
      break
    }

    await new Promise((r) => setTimeout(r, PAGE_DELAY_MS))
  }

  return jobs
}

export default async function scrapeBuiltIn(): Promise<ScraperStats> {
  console.log('[BuiltIn] Starting scrape...')

  try {
    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    for (const city of CITIES) {
      try {
        const jobs = await fetchCityJobs(city)
        console.log(`[BuiltIn] ${city}: ${jobs.length} jobs`)

        for (const job of jobs) {
          const title = String(job?.title ?? '').trim()
          if (!title) {
            stats.skipped++
            continue
          }

          const salaryText =
            typeof job?.salary === 'string' && job.salary.trim() ? job.salary.trim() : null
          const salaryMin = parseSalary(salaryText, false)
          const salaryMax = parseSalary(salaryText, true)
          const salaryRaw = salaryText || 'USD 100000+ (BuiltIn salary_floor filter)'

          let applyUrl: string | null = job.url ?? null
          if (applyUrl && applyUrl.toLowerCase().includes('builtin.com')) {
            const discoveredApplyUrl = await discoverApplyUrlFromPage(applyUrl)
            if (discoveredApplyUrl) applyUrl = discoveredApplyUrl
          }

          const atsType = detectATS(applyUrl || '')
          const explicitAtsProvider = toAtsProvider(atsType)
          const explicitAtsUrl =
            explicitAtsProvider && applyUrl ? getCompanyJobsUrl(applyUrl, atsType) : null

          const companyName = String(job.company || '').trim()
          if (
            companyName &&
            explicitAtsProvider &&
            applyUrl &&
            isExternalToHost(applyUrl, 'builtin.com')
          ) {
            await saveCompanyATS(companyName, applyUrl, BOARD_NAME)
          }

          const scrapedJob: ScrapedJobInput = {
            externalId: `builtin-${String(job.id || job.url)}`,
            title,
            source: makeBoardSource(BOARD_NAME),
            rawCompanyName: job.company || 'Unknown',
            url: job.url,
            applyUrl,
            locationText: job.location || city,
            isRemote: Boolean(job.location?.toLowerCase?.().includes('remote')),

            descriptionHtml: job.description || null,
            descriptionText: stripHtml(job.description || ''),

            salaryRaw,
            salaryMin,
            salaryMax,
            salaryCurrency: 'USD',
            salaryInterval: 'year',

            employmentType: 'Full-time',
            postedAt: null,

            explicitAtsProvider,
            explicitAtsUrl,

            raw: job,
          }

          const result = await ingestJob(scrapedJob)
          addIngestStatus(stats, result.status)
        }
      } catch (err) {
        console.error(`[BuiltIn] Error for ${city}:`, err)
      }
    }

    console.log(`[BuiltIn] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[BuiltIn] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}

function parseSalary(text: string | null, isMax = false): number | null {
  if (!text) return null
  const matches = text.match(/\$?([\d,]+)\s*k?/gi)
  if (!matches) return null

  const numbers = matches
    .map((m) => parseInt(m.replace(/[^0-9]/g, ''), 10))
    .filter((n) => Number.isFinite(n) && n > 0)

  if (numbers.length === 0) return null

  // Normalize to annual dollars (handle "$120k" vs "$120,000")
  const vals = numbers.map((n) => (n < 1000 ? n * 1000 : n))
  return isMax ? Math.max(...vals) : Math.min(...vals)
}

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
