// lib/scrapers/otta.ts
//
// Otta scraper with API-first strategy:
// 1) REST API: https://api.otta.com/jobs?salary_min=100000
// 2) JSON page: https://otta.com/jobs?format=json&salary_min=100000
// 3) HTML (cheerio) fallback as last resort

import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'
import type { ScrapedJobInput } from '../ingest/types'
import { addIngestStatus, errorStats, type ScraperStats } from './scraperStats'

const BOARD_NAME = 'otta'
const USER_AGENT = 'SixFigureJobs/1.0 (+job-board-scraper)'
const TIMEOUT_MS = 15000

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(id)
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  } finally {
    clearTimeout(id)
  }
}

async function fetchOttaJobs(): Promise<any[]> {
  // TRY 1: API endpoint
  try {
    const apiUrl = 'https://api.otta.com/jobs?salary_min=100000&limit=1000'
    const data = await fetchJson(apiUrl)
    console.log('[Otta] ✓ Using API endpoint')
    return data?.jobs || data?.results || []
  } catch (err) {
    console.log('[Otta] API failed, trying JSON endpoint')
  }

  // TRY 2: JSON format parameter
  try {
    const jsonUrl = 'https://otta.com/jobs?format=json&salary_min=100000'
    const data = await fetchJson(jsonUrl)
    console.log('[Otta] ✓ Using JSON endpoint')
    return data?.jobs || data?.results || []
  } catch (err) {
    console.log('[Otta] JSON endpoint failed, trying HTML')
  }

  // TRY 3: HTML scraping (last resort)
  const htmlUrl = 'https://otta.com/jobs?salary_min=100000'
  console.log('[Otta] ⚠️ Using HTML scraping (slower)')
  const html = await fetchText(htmlUrl)

  const cheerio = await import('cheerio')
  const $ = cheerio.load(html)

  const jobs: any[] = []

  const selectors = [
    '[data-testid*="job-card"]',
    '.job-card',
    'article[class*="job"]',
    '[class*="JobCard"]',
  ]

  for (const selector of selectors) {
    const matches = $(selector)
    if (matches.length === 0) continue

    console.log(`[Otta] Found ${matches.length} jobs with selector: ${selector}`)

    matches.each((_i, el) => {
      const $el = $(el)
      const href = $el.find('a').first().attr('href') || null

      jobs.push({
        id: $el.attr('data-job-id') || $el.attr('id') || href,
        title: $el.find('h2, h3, [class*="title"]').first().text().trim(),
        company: $el.find('[class*="company"]').first().text().trim(),
        location: $el.find('[class*="location"]').first().text().trim(),
        salary: $el.find('[class*="salary"]').first().text().trim(),
        url: href,
        description:
          $el.find('.job-description, [class*="description"], [class*="Description"]')
            .first()
            .html() || null,
      })
    })

    break
  }

  return jobs
}

export default async function scrapeOtta(): Promise<ScraperStats> {
  console.log('[Otta] Starting scrape...')

  try {
    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    const jobs = await fetchOttaJobs()
    console.log(`[Otta] Found ${jobs.length} jobs`)

    for (const job of jobs) {
      const title = String(job?.title ?? '').trim()
      if (!title) {
        stats.skipped++
        continue
      }

      const externalId = String(job?.id || job?.url || '')
      if (!externalId) {
        stats.skipped++
        continue
      }

      const rawUrl = job?.url
      const url =
        typeof rawUrl === 'string'
          ? rawUrl.startsWith('http')
            ? rawUrl
            : `https://otta.com${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`
          : null

      const applyUrl =
        typeof job?.applyUrl === 'string'
          ? job.applyUrl
          : typeof rawUrl === 'string'
          ? url
          : null

      const locationText =
        (typeof job?.location === 'string' && job.location.trim()) ? job.location.trim() : 'Remote'
      const isRemote =
        Boolean(job?.remote) ||
        (typeof locationText === 'string' && locationText.toLowerCase().includes('remote'))

      const descriptionHtml =
        typeof job?.description === 'string' ? job.description : null
      const descriptionText = descriptionHtml ? stripHtml(descriptionHtml) : null

      const salaryText =
        typeof job?.salary === 'string'
          ? job.salary
          : typeof job?.salaryText === 'string'
          ? job.salaryText
          : null

      const salaryCurrency = detectCurrency(salaryText)
      const salaryMin = parseSalary(job?.salaryMin ?? salaryText, false)
      const salaryMax = parseSalary(job?.salaryMax ?? salaryText, true)

      const scrapedJob: ScrapedJobInput = {
        externalId,
        title,
        source: makeBoardSource(BOARD_NAME),
        rawCompanyName: job?.company || job?.companyName || 'Unknown',
        url,
        applyUrl,
        locationText,
        isRemote,

        // Full descriptions for AI
        descriptionHtml,
        descriptionText,

        salaryMin,
        salaryMax,
        salaryCurrency,
        salaryInterval: 'year',

        employmentType: 'Full-time',
        postedAt: job?.postedAt ? new Date(job.postedAt) : null,

        raw: job,
      }

      try {
        const result = await ingestJob(scrapedJob)
        addIngestStatus(stats, result.status)
      } catch (err) {
        console.error('[Otta] Job ingest failed:', err)
        stats.skipped++
      }
    }

    console.log(`[Otta] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[Otta] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}

function parseSalary(
  text: string | number | null | undefined,
  isMax: boolean = false,
): number | null {
  if (text == null) return null

  if (typeof text === 'number') {
    // Heuristic: some APIs return annual (e.g., 120000), some return "k" (e.g., 120)
    const n = Number(text)
    if (!Number.isFinite(n) || n <= 0) return null
    return n >= 1000 ? Math.round(n) : Math.round(n * 1000)
  }

  const s = String(text)
  if (!s.trim()) return null

  const matches = s.match(/[£€$]?([\d,]+)\s*k?/gi)
  if (!matches) return null

  const numbers = matches
    .map((m) => parseInt(m.replace(/[^0-9]/g, ''), 10))
    .filter((n) => Number.isFinite(n) && n > 0)

  if (numbers.length === 0) return null

  // If values look like "k" (e.g., 120), convert to annual dollars/euros/pounds.
  const normalized = numbers.map((n) => (n < 1000 ? n * 1000 : n))

  return isMax ? Math.max(...normalized) : Math.min(...normalized)
}

function detectCurrency(text: string | null): string {
  if (!text) return 'USD'
  if (text.includes('£')) return 'GBP'
  if (text.includes('€')) return 'EUR'
  return 'USD'
}

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

