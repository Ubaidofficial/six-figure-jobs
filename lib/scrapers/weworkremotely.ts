// lib/scrapers/weworkremotely.ts
import * as cheerio from 'cheerio'
import type { ScrapedJobInput } from '../ingest/types'
import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'
import { addIngestStatus, errorStats, type ScraperStats } from './scraperStats'
import { discoverApplyUrlFromPage } from './utils/discoverApplyUrl'
import { detectATS, getCompanyJobsUrl, isExternalToHost, toAtsProvider } from './utils/detectATS'
import { saveCompanyATS } from './utils/saveCompanyATS'

const BOARD_NAME = 'weworkremotely'
const BASE_URL = 'https://weworkremotely.com'

async function fetchJobDescription(jobUrl: string): Promise<string | null> {
  try {
    const res = await fetch(jobUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    
    const html = await res.text()
    const $ = cheerio.load(html)
    
    // WWR puts job description in .listing-container
    const descHtml = $('.listing-container').html()
    return descHtml || null
  } catch (err) {
    console.warn(`[WWR] Failed to fetch description from ${jobUrl}:`, err)
    return null
  }
}

export async function fetchWeWorkRemotelyJobs(): Promise<ScrapedJobInput[]> {
  const jobs: ScrapedJobInput[] = []
  const res = await fetch(BASE_URL + '/remote-100k-or-more-salary-jobs', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.warn(`[WeWorkRemotely] HTTP ${res.status} for listing page`)
    return []
  }
  const html = await res.text()
  const $ = cheerio.load(html)
  
  const listings: Array<{ title: string; company: string; location: string; url: string; externalId: string }> = []
  
  $('li.new-listing-container').each((_, el) => {
    const $el = $(el)
    const $link = $el.find('a.listing-link--unlocked').first()
    const href = $link.attr('href')
    if (!href) return
    const title = $el.find('.new-listing__header__title').text().trim()
    if (!title) return
    const company = $el.find('.new-listing__company-name').text().trim().replace(/\s+/g, ' ')
    const location = $el.find('.new-listing__company-headquarters').text().trim()
    const url = href.startsWith('http') ? href : BASE_URL + href
    const externalId = href.split('/').pop() || String(Date.now())
    
    listings.push({ title, company, location, url, externalId })
  })
  
  console.log(`[WWR] Found ${listings.length} listings, fetching descriptions...`)
  
  // Fetch descriptions in parallel (with rate limiting)
  for (const listing of listings) {
    const descriptionHtml = await fetchJobDescription(listing.url)
    
    jobs.push({
      source: makeBoardSource(BOARD_NAME),
      externalId: listing.externalId,
      title: listing.title,
      rawCompanyName: listing.company || 'Unknown',
      locationText: listing.location || 'Remote',
      url: listing.url,
      salaryMin: 100_000,
      salaryMax: null,
      salaryCurrency: 'USD',
      salaryInterval: 'year',
      salaryRaw: '$100,000 or more USD',
      isRemote: true,
      descriptionHtml,
    })
    
    // Rate limit: 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log(`[WWR] Extracted ${jobs.filter(j => j.descriptionHtml).length}/${jobs.length} descriptions`)
  return jobs
}

export default async function scrapeWeWorkRemotely(): Promise<ScraperStats> {
  console.log('[WeWorkRemotely] Starting scrape...')
  try {
    const jobs = await fetchWeWorkRemotelyJobs()
    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }
    for (const job of jobs) {
      try {
        let applyUrl = job.url
        if (applyUrl && applyUrl.toLowerCase().includes('weworkremotely.com')) {
          const discoveredApplyUrl = await discoverApplyUrlFromPage(applyUrl)
          if (discoveredApplyUrl) applyUrl = discoveredApplyUrl
        }
        const atsType = detectATS(applyUrl || '')
        const explicitAtsProvider = toAtsProvider(atsType)
        const explicitAtsUrl =
          explicitAtsProvider && applyUrl ? getCompanyJobsUrl(applyUrl, atsType) : null
        const companyName = job.rawCompanyName || ''
        if (companyName && applyUrl && isExternalToHost(applyUrl, 'weworkremotely.com')) {
          await saveCompanyATS(companyName, applyUrl, BOARD_NAME)
        }
        const result = await ingestJob({
          ...job,
          applyUrl: applyUrl ?? job.applyUrl,
          explicitAtsProvider,
          explicitAtsUrl,
        })
        addIngestStatus(stats, result.status)
      } catch (err) {
        console.error('[WeWorkRemotely] Job ingest failed:', err)
        stats.skipped++
      }
    }
    console.log(`[WeWorkRemotely] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[WeWorkRemotely] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
