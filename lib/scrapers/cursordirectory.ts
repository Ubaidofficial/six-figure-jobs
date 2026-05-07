// lib/scrapers/cursordirectory.ts
// Scrapes jobs from https://cursor.directory/jobs
// Single-page SSR site backed by Supabase — no public API, no pagination.
// All active jobs load on one page (~20-50 listings).

import axios from 'axios'
import * as cheerio from 'cheerio'
import { upsertBoardJob } from './_boardHelpers'
import { addBoardIngestResult, type ScraperStats } from './scraperStats'

const BOARD = 'cursordirectory'
const BASE_URL = 'https://cursor.directory'
const LIST_URL = `${BASE_URL}/jobs`

export default async function scrapeCursorDirectory(): Promise<ScraperStats> {
  console.log('[CursorDirectory] Starting scrape...')

  const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

  let html: string
  try {
    const res = await axios.get(LIST_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 30_000,
    })
    html = res.data as string
  } catch (err) {
    console.error('[CursorDirectory] Fetch failed:', err)
    return { ...stats, error: String(err) }
  }

  const $ = cheerio.load(html)

  // The page has two sections: a featured carousel (top) and a main list.
  // Job cards share the same border/rounded structure. We target cards that
  // have both a job-title link and a company name, and skip anything that
  // looks like UI chrome.

  interface JobCard {
    title: string
    company: string
    applyUrl: string
    location: string | null
    workplace: string | null
    description: string | null
    externalId: string
  }

  const seen = new Set<string>()
  const cards: JobCard[] = []

  // Strategy: find all <a> elements whose href contains a "utm_source=cursor.directory"
  // OR point externally — these are the "View" / title links for each job.
  // Walk up to the card container and extract sibling data.
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href.startsWith('http') && !href.startsWith('//')) return
    if (href.includes('cursor.directory') && !href.includes('utm_source')) return

    // Find the enclosing card — it's a div with border-border class
    const card = $(el).closest('div[class*="border-border"]')
    if (!card.length) return

    // Title: look for a prominent heading link inside the card
    let title = ''
    let titleApplyUrl = ''

    // The title is usually in an h3 that is NOT the company h3
    card.find('h3 a[href], h2 a[href]').each((_j, a) => {
      const text = $(a).text().trim()
      const linkHref = $(a).attr('href') ?? ''
      if (text && text.length > 5 && linkHref.startsWith('http') && !seen.has(linkHref + text)) {
        title = text
        titleApplyUrl = linkHref
      }
    })

    if (!title) return

    const applyUrl = titleApplyUrl || href
    // Remove UTM params to get clean URL for dedup key
    let cleanUrl = applyUrl
    try {
      const u = new URL(applyUrl)
      u.searchParams.delete('utm_source')
      u.searchParams.delete('utm_medium')
      u.searchParams.delete('utm_campaign')
      cleanUrl = u.toString()
    } catch { /* keep original */ }

    const key = title + '|' + cleanUrl
    if (seen.has(key)) return
    seen.add(key)

    // Company: smaller muted heading
    const company = card.find('h3[class*="muted"] a, h3[class*="font-mono"] a').first().text().trim()
      || card.find('[class*="muted"] a').first().text().trim()
      || card.find('a[href*="cursor.directory/companies"]').first().text().trim()
      || ''

    // Description: muted paragraph
    const description = card.find('p[class*="muted"], p[class*="text-sm"]').first().text().trim() || null

    // Metadata spans (location, workplace, experience)
    const metaSpans: string[] = []
    card.find('span[class*="line-clamp"], span[class*="text-xs"]').each((_k, s) => {
      const t = $(s).text().trim()
      if (t && t.length > 1 && !t.includes('·') && metaSpans.length < 4) metaSpans.push(t)
    })

    // Heuristic: workplace is the last meta span if it contains known values
    const WORKPLACE_VALS = ['remote', 'on site', 'onsite', 'hybrid', 'office']
    let location: string | null = null
    let workplace: string | null = null
    for (const s of metaSpans) {
      if (WORKPLACE_VALS.some(v => s.toLowerCase().includes(v))) {
        workplace = s
      } else if (!location && s.length > 2 && !/^\d/.test(s)) {
        location = s
      }
    }

    const externalId = `cursordirectory-${Buffer.from(title + company).toString('base64url').slice(0, 32)}`

    cards.push({ title, company, applyUrl: cleanUrl, location, workplace, description, externalId })
  })

  console.log(`[CursorDirectory] Found ${cards.length} job cards`)

  for (const card of cards) {
    if (!card.title || !card.company) {
      stats.skipped++
      continue
    }

    try {
      const result = await upsertBoardJob({
        board: BOARD,
        externalId: card.externalId,
        title: card.title,
        company: card.company,
        url: card.applyUrl,
        applyUrl: card.applyUrl,
        location: card.location,
        remote: card.workplace?.toLowerCase().includes('remote') ?? false,
        descriptionHtml: card.description ? `<p>${card.description}</p>` : null,
      })
      addBoardIngestResult(stats, result)
    } catch (err) {
      stats.skipped++
      console.error(`[CursorDirectory] Error ingesting "${card.title}":`, err)
    }
  }

  console.log(`[CursorDirectory] Done — created:${stats.created} updated:${stats.updated} skipped:${stats.skipped}`)
  return stats
}
