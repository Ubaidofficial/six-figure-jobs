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
const DETAIL_FETCH_DELAY_MS = 350
const DETAIL_FETCH_TIMEOUT_MS = 15000
const MAX_DETAIL_FETCHES_TOTAL = Number(process.env.BUILTIN_DETAIL_FETCH_LIMIT ?? 150)

type JobDetail = {
  descriptionHtml: string | null
  salaryText: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  salaryInterval: string | null
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function detectCurrencyFromText(text: string | null): string | null {
  if (!text) return null
  const t = text.toLowerCase()
  if (t.includes('usd') || t.includes('us$')) return 'USD'
  if (t.includes('cad') || t.includes('c$') || t.includes('ca$')) return 'CAD'
  if (t.includes('aud') || t.includes('a$') || t.includes('au$')) return 'AUD'
  if (t.includes('nzd') || t.includes('nz$')) return 'NZD'
  if (t.includes('sgd') || t.includes('s$')) return 'SGD'
  if (t.includes('eur') || t.includes('€')) return 'EUR'
  if (t.includes('gbp') || t.includes('£')) return 'GBP'
  if (t.includes('chf')) return 'CHF'
  if (t.includes('inr') || t.includes('₹')) return 'INR'
  if (t.includes('$')) return 'USD'
  return null
}

function detectIntervalFromText(text: string | null): string | null {
  if (!text) return null
  const t = text.toLowerCase()
  if (/hour|hr|hourly|\/\s*h/.test(t)) return 'hour'
  if (/day|daily|\/\s*d/.test(t)) return 'day'
  if (/week|weekly|\/\s*w/.test(t)) return 'week'
  if (/month|monthly|\/\s*m/.test(t)) return 'month'
  if (/year|annual|annually|\/\s*y/.test(t)) return 'year'
  return null
}

function extractJobPostingFromJsonLd($: cheerio.CheerioAPI): Record<string, any> | null {
  const scripts = $('script[type="application/ld+json"]')
  for (const el of scripts.toArray()) {
    const raw = $(el).contents().text().trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      const found = findJobPosting(parsed)
      if (found) return found
    } catch {
      continue
    }
  }
  return null
}

function findJobPosting(node: any): Record<string, any> | null {
  if (!node) return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item)
      if (found) return found
    }
    return null
  }
  if (typeof node !== 'object') return null

  const type = node['@type']
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) {
    return node
  }

  if (node['@graph']) {
    const found = findJobPosting(node['@graph'])
    if (found) return found
  }

  for (const value of Object.values(node)) {
    if (typeof value === 'object' && value !== null) {
      const found = findJobPosting(value)
      if (found) return found
    }
  }

  return null
}

function normalizeSchemaInterval(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = String(raw).toLowerCase()
  if (v.startsWith('year') || v === 'annual' || v === 'annually' || v === 'pa') return 'year'
  if (v.startsWith('month') || v === 'pm') return 'month'
  if (v.startsWith('week') || v === 'pw') return 'week'
  if (v.startsWith('day') || v === 'pd') return 'day'
  if (v.startsWith('hour') || v === 'ph') return 'hour'
  return null
}

function toNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '')
    if (!cleaned) return null
    const num = Number(cleaned)
    return Number.isFinite(num) ? num : null
  }
  return null
}

function buildSalaryText(
  currency: string | null,
  min: number | null,
  max: number | null,
  interval: string | null,
): string | null {
  if (!currency || (!min && !max)) return null
  const fmt = (v: number) => Math.round(v).toLocaleString()
  const range =
    min != null && max != null && min !== max
      ? `${fmt(min)} - ${fmt(max)}`
      : `${fmt(min ?? max ?? 0)}`
  const suffix = interval ? ` / ${interval}` : ''
  return `${currency} ${range}${suffix}`
}

function parseSchemaSalary(baseSalary: any): JobDetail | null {
  if (!baseSalary) return null
  if (Array.isArray(baseSalary)) {
    for (const entry of baseSalary) {
      const parsed = parseSchemaSalary(entry)
      if (parsed) return parsed
    }
    return null
  }
  if (typeof baseSalary === 'string') {
    const salaryText = baseSalary.trim()
    if (!salaryText || !/\d/.test(salaryText)) return null
    const min = parseSalary(salaryText, false)
    const max = parseSalary(salaryText, true)
    const salaryCurrency = detectCurrencyFromText(salaryText)
    const salaryInterval = detectIntervalFromText(salaryText) ?? 'year'
    if (!salaryCurrency || (!min && !max)) return null
    return {
      descriptionHtml: null,
      salaryText,
      salaryMin: min,
      salaryMax: max,
      salaryCurrency,
      salaryInterval,
    }
  }
  if (typeof baseSalary === 'object') {
    const currency =
      baseSalary.currency ||
      baseSalary?.value?.currency ||
      baseSalary?.value?.currencyCode ||
      null
    if (!currency) return null

    const valueNode = baseSalary.value ?? baseSalary
    let min = toNumber(valueNode.minValue ?? valueNode.lowValue ?? valueNode.min)
    let max = toNumber(valueNode.maxValue ?? valueNode.highValue ?? valueNode.max)
    const single = toNumber(valueNode.value ?? valueNode.amount)
    if (min == null && max == null && single != null) {
      min = single
      max = single
    }

    if (min == null && max == null) return null

    const interval = normalizeSchemaInterval(valueNode.unitText ?? baseSalary.unitText) ?? 'year'
    const salaryText = buildSalaryText(String(currency), min, max, interval)

    return {
      descriptionHtml: null,
      salaryText,
      salaryMin: min,
      salaryMax: max,
      salaryCurrency: String(currency),
      salaryInterval: interval,
    }
  }

  return null
}

function extractSalaryTextFromDom($: cheerio.CheerioAPI): string | null {
  const salaryText =
    $('[data-id*="salary"], [data-testid*="salary"], [class*="salary"], [class*="compensation"], [class*="pay"]')
      .first()
      .text()
      .trim() || null
  if (!salaryText || !/\d/.test(salaryText)) return null
  return salaryText
}

function selectBestDescriptionHtml($: cheerio.CheerioAPI): string | null {
  const selectors = ['article', 'main article', 'main', '[class*="job-description"]', '#job-description']
  let bestHtml: string | null = null
  let bestLen = 0

  for (const sel of selectors) {
    const el = $(sel).first()
    if (!el.length) continue
    const textLen = el.text().replace(/\s+/g, ' ').trim().length
    if (textLen < 200 || textLen > 80_000) continue
    if (textLen > bestLen) {
      bestLen = textLen
      bestHtml = el.html() || null
    }
  }

  return bestHtml
}

async function fetchJobDetails(jobUrl: string): Promise<JobDetail | null> {
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), DETAIL_FETCH_TIMEOUT_MS)
    const res = await fetch(jobUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(id)

    if (!res.ok) return null

    const html = await res.text()
    if (
      html.toLowerCase().includes('attention required') ||
      html.toLowerCase().includes('cf-browser-verification')
    ) {
      return null
    }

    const $ = cheerio.load(html)
    const jobPosting = extractJobPostingFromJsonLd($)

    let descriptionHtml: string | null = null
    let salaryText: string | null = null
    let salaryMin: number | null = null
    let salaryMax: number | null = null
    let salaryCurrency: string | null = null
    let salaryInterval: string | null = null

    if (jobPosting) {
      if (typeof jobPosting.description === 'string') {
        descriptionHtml = jobPosting.description
      }
      const salaryData = parseSchemaSalary(jobPosting.baseSalary)
      if (salaryData) {
        salaryText = salaryData.salaryText
        salaryMin = salaryData.salaryMin
        salaryMax = salaryData.salaryMax
        salaryCurrency = salaryData.salaryCurrency
        salaryInterval = salaryData.salaryInterval
      }
    }

    if (!descriptionHtml) {
      descriptionHtml = selectBestDescriptionHtml($)
    }

    if (!salaryText) {
      salaryText = extractSalaryTextFromDom($)
    }

    if (!salaryMin && !salaryMax && salaryText) {
      salaryMin = parseSalary(salaryText, false)
      salaryMax = parseSalary(salaryText, true)
    }

    if (!salaryCurrency && salaryText) {
      salaryCurrency = detectCurrencyFromText(salaryText)
    }

    if (!salaryInterval && salaryText) {
      salaryInterval = detectIntervalFromText(salaryText) ?? 'year'
    }

    return {
      descriptionHtml,
      salaryText,
      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryInterval,
    }
  } catch (err) {
    console.warn(`[BuiltIn] Failed to fetch job details for ${jobUrl}:`, err)
    return null
  }
}

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
    const detailCache = new Map<string, JobDetail | null>()
    let detailFetches = 0

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

          let salaryText =
            typeof job?.salary === 'string' && job.salary.trim() ? job.salary.trim() : null
          let salaryMin = parseSalary(salaryText, false)
          let salaryMax = parseSalary(salaryText, true)
          let salaryCurrency = salaryText ? detectCurrencyFromText(salaryText) ?? 'USD' : null
          let salaryInterval = salaryText ? detectIntervalFromText(salaryText) ?? 'year' : null

          let descriptionHtml: string | null = job.description || null

          if ((!salaryMin && !salaryMax) || !descriptionHtml) {
            if (detailFetches < MAX_DETAIL_FETCHES_TOTAL) {
              detailFetches += 1
              const cached = detailCache.has(job.url) ? detailCache.get(job.url) : undefined
              const detail = cached ?? (await fetchJobDetails(job.url))
              if (!detailCache.has(job.url)) detailCache.set(job.url, detail ?? null)

              if (detail) {
                if (!descriptionHtml && detail.descriptionHtml) {
                  descriptionHtml = detail.descriptionHtml
                }

                if (!salaryText && detail.salaryText) {
                  salaryText = detail.salaryText
                }

                if ((!salaryMin && !salaryMax) && (detail.salaryMin || detail.salaryMax)) {
                  salaryMin = detail.salaryMin
                  salaryMax = detail.salaryMax
                }

                if (!salaryCurrency && detail.salaryCurrency) {
                  salaryCurrency = detail.salaryCurrency
                }

                if (!salaryInterval && detail.salaryInterval) {
                  salaryInterval = detail.salaryInterval
                }
              }

              await sleep(DETAIL_FETCH_DELAY_MS)
            }
          }

          if (!salaryMin && !salaryMax && salaryText) {
            salaryMin = parseSalary(salaryText, false)
            salaryMax = parseSalary(salaryText, true)
          }

          if (!salaryCurrency && salaryText) {
            salaryCurrency = detectCurrencyFromText(salaryText) ?? 'USD'
          }

          if (!salaryInterval && salaryText) {
            salaryInterval = detectIntervalFromText(salaryText) ?? 'year'
          }

          if (!salaryMin && !salaryMax && !salaryText) {
            stats.skipped++
            continue
          }

          const salaryRaw = salaryText || null

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

            descriptionHtml,
            descriptionText: stripHtml(descriptionHtml || ''),

            salaryRaw,
            salaryMin,
            salaryMax,
            salaryCurrency,
            salaryInterval,

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
