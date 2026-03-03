import axios from 'axios'
import * as cheerio from 'cheerio'

import type { ScraperStats } from './scraperStats'
import { detectATS, toAtsProvider } from './utils/detectATS'
import { extractApplyDestinationFromHtml } from './utils/extractApplyLink'
import { saveCompanyATS } from './utils/saveCompanyATS'

const BOARD_NAME = 'remote100k'
const BASE_URL = 'https://remote100k.com'

const CATEGORY_PAGES = [
  '/remote-jobs/engineering',
  '/remote-jobs/data-science',
  '/remote-jobs/product',
  '/remote-jobs/marketing',
  '/remote-jobs/sales',
  '/remote-jobs/design',
  '/remote-jobs/management',
  '/remote-jobs/operations',
  '/remote-jobs/all-other',
]

function normalizeWhitespace(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function guessCompanyFromSlug(jobUrl: string): string | null {
  try {
    const u = new URL(jobUrl)
    const slug = u.pathname.split('/').filter(Boolean).pop() || ''
    if (!slug) return null
    const parts = slug.split('-').filter(Boolean)
    if (parts.length === 0) return null

    // Stop once we hit common job words (slug format is often "<company>-<job-title...>")
    const STOP_WORDS = new Set([
      'senior',
      'staff',
      'principal',
      'lead',
      'junior',
      'sr',
      'jr',
      'engineer',
      'engineering',
      'developer',
      'software',
      'frontend',
      'backend',
      'full',
      'stack',
      'product',
      'manager',
      'design',
      'data',
      'scientist',
      'analyst',
      'director',
      'vp',
      'head',
    ])

    const companyParts: string[] = []
    for (const p of parts) {
      if (STOP_WORDS.has(p)) break
      companyParts.push(p)
      if (companyParts.length >= 3) break
    }

    const raw = companyParts.length ? companyParts.join(' ') : parts[0]
    const name = raw
      .split(' ')
      .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
      .join(' ')
    return name || null
  } catch {
    return null
  }
}

function extractCompanyNameFromJobHtml(html: string, jobUrl: string): string | null {
  try {
    const $ = cheerio.load(html)

    const metaTitle =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text()

    const t = normalizeWhitespace(metaTitle || '')

    // Common patterns: "Role at Company", "Company — Role", "Role @ Company"
    const atMatch = t.match(/\bat\s+(.+?)(?:\s*[|•\-–—]\s*.*)?$/i)
    if (atMatch?.[1]) {
      const company = normalizeWhitespace(atMatch[1])
      if (company && company.length <= 80) return company
    }

    const atSymbolMatch = t.match(/\s@\s(.+?)(?:\s*[|•\-–—]\s*.*)?$/i)
    if (atSymbolMatch?.[1]) {
      const company = normalizeWhitespace(atSymbolMatch[1])
      if (company && company.length <= 80) return company
    }

    const dashMatch = t.split(/[\-–—|•]/).map((s) => normalizeWhitespace(s)).filter(Boolean)
    if (dashMatch.length >= 2) {
      // Prefer the segment that looks like a company (shorter, no "remote")
      const candidates = dashMatch
        .slice(0, 3)
        .filter((s) => s.length >= 2 && s.length <= 80 && !/remote|worldwide/i.test(s))
      if (candidates.length) return candidates[0]
    }

    // Heuristic: look for "Company" label in visible text.
    const bodyText = normalizeWhitespace($('body').text())
    const labelMatch = bodyText.match(/\bCompany\s*:?\s*([A-Za-z0-9&.,'() \-]{2,80})\b/)
    if (labelMatch?.[1]) {
      return normalizeWhitespace(labelMatch[1])
    }

    return guessCompanyFromSlug(jobUrl)
  } catch {
    return guessCompanyFromSlug(jobUrl)
  }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    timeout: 15000,
    responseType: 'text',
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 400,
  })

  return typeof res.data === 'string' ? res.data : ''
}

function extractJobUrlsFromListingHtml(html: string, listingUrl: string): string[] {
  const urls = new Set<string>()
  try {
    const $ = cheerio.load(html)
    $('a[href]').each((_i, el) => {
      const href = $(el).attr('href')
      if (!href) return
      if (!href.includes('/remote-job/')) return
      try {
        const u = new URL(href, listingUrl)
        if (u.hostname.replace(/^www\./, '').toLowerCase() !== 'remote100k.com') return
        urls.add(u.toString())
      } catch {
        // ignore
      }
    })
  } catch {
    // ignore
  }
  return Array.from(urls)
}

async function discoverCompanyFromJobUrl(
  jobUrl: string,
): Promise<{ companyName: string | null; applyUrl: string | null }> {
  const html = await fetchHtml(jobUrl)
  if (!html) return { companyName: null, applyUrl: null }

  const companyName = extractCompanyNameFromJobHtml(html, jobUrl)
  const applyUrl = extractApplyDestinationFromHtml(html, jobUrl)

  return { companyName, applyUrl }
}

export async function discoverRemote100kCompanies(): Promise<
  ScraperStats & { discovered?: number; errors?: number }
> {
  console.log('[Remote100k-Companies] Starting company discovery...')

  const stats: ScraperStats & { discovered?: number; errors?: number } = {
    created: 0,
    updated: 0,
    skipped: 0,
  }

  let discovered = 0
  let errors = 0

  try {
    // Try a lightweight "all jobs" listing first, then fall back to category listings.
    const seedListingUrls = [`${BASE_URL}/jobs`, ...CATEGORY_PAGES.map((p) => `${BASE_URL}${p}`)]

    const jobUrls: string[] = []
    const seen = new Set<string>()

    for (const listingUrl of seedListingUrls) {
      try {
        const html = await fetchHtml(listingUrl)
        if (!html) continue
        const found = extractJobUrlsFromListingHtml(html, listingUrl)
        for (const u of found) {
          if (seen.has(u)) continue
          seen.add(u)
          jobUrls.push(u)
        }
        if (jobUrls.length >= 250) break
      } catch {
        continue
      }
    }

    if (jobUrls.length === 0) {
      console.warn('[Remote100k-Companies] No job URLs found (listing markup may have changed).')
      return { ...stats, discovered, errors }
    }

    for (const jobUrl of jobUrls) {
      try {
        const { companyName, applyUrl } = await discoverCompanyFromJobUrl(jobUrl)
        if (!companyName || !applyUrl) {
          stats.skipped++
          continue
        }

        // Only store CompanyATS mappings when we have a recognizable ATS provider.
        const atsType = detectATS(applyUrl)
        const provider = toAtsProvider(atsType)
        if (!provider) {
          stats.skipped++
          continue
        }

        await saveCompanyATS(companyName, applyUrl, BOARD_NAME)
        discovered++
      } catch {
        errors++
        stats.skipped++
      }
    }

    stats.created = discovered
    ;(stats as any).discovered = discovered
    ;(stats as any).errors = errors

    console.log(`[Remote100k-Companies] ✓ ${discovered} companies, ${stats.skipped} skipped`)
    return stats
  } catch (err: any) {
    errors++
    console.error('[Remote100k-Companies] Error:', err?.message || err)
    ;(stats as any).errors = errors
    return stats
  }
}

