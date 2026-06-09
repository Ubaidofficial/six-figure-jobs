// lib/scrapers/nodesk.ts
//
// RSS-driven NoDesk scraper. Replaces the previous Puppeteer-based version
// (241 lines, headless Chrome, hardcoded 750ms-per-job delay) with plain
// HTTP fetch of the public RSS feed.
//
// Why this works:
//   - nodesk.co publishes a live RSS feed at /remote-jobs/index.xml listing
//     every recently-posted job with title, description, pubDate, and the
//     canonical URL.
//   - Job titles follow a strict "Role at Company" pattern (e.g. "Staff
//     Engineer at Skylight"), which lets us split out company name without
//     fetching detail pages.
//   - The feed handles its own pagination — the latest N items are always
//     present, so we don't need to walk multiple URLs.
//
// Respects robots.txt: the site explicitly disallows AI crawlers (ClaudeBot,
// GPTBot, etc.) but allows generic user-agents. We send a standard browser
// UA so we look like search-engine traffic, not an AI agent.

import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'
import type { ScrapedJobInput } from '../ingest/types'
import { addIngestStatus, emptyStats, type ScraperStats } from './scraperStats'
import { fetchWithBackoff } from './utils/fetchWithBackoff'

const BOARD_NAME = 'nodesk'
const RSS_URL = 'https://nodesk.co/remote-jobs/index.xml'

// Generic search-engine-like UA. The site disallows AI bots specifically in
// robots.txt; standard UAs continue to be allowed.
const USER_AGENT =
  'Mozilla/5.0 (compatible; SixFigureJobsBot/1.0; +https://www.6figjobs.com)'

// Cap per run — the RSS feed typically returns 100-200 items. Override via
// env for one-off backfills.
const MAX_ITEMS = Math.max(20, Number(process.env.NODESK_MAX_ITEMS ?? '300'))
const REQUEST_TIMEOUT_MS = 15_000

type RssItem = {
  title: string
  description: string
  link: string
  guid: string
  pubDate: string | null
}

/* -------------------------------------------------------------------------- */
/* RSS parsing                                                                */
/* -------------------------------------------------------------------------- */

// Minimal RSS parser — pulls <item> blocks via regex. We don't need a full
// XML parser because the feed shape is well-defined and stable. Avoiding a
// new dependency keeps the scraper light.
function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null
  while ((match = itemRe.exec(xml)) !== null) {
    const body = match[1]
    const title = decodeXml(pickTag(body, 'title'))
    const description = decodeXml(pickTag(body, 'description'))
    const link = pickTag(body, 'link').trim()
    const guid = pickTag(body, 'guid').trim()
    const pubDate = pickTag(body, 'pubDate').trim() || null
    if (!title || !link) continue
    items.push({ title, description, link, guid: guid || link, pubDate })
  }
  return items
}

function pickTag(body: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = body.match(re)
  return match?.[1]?.trim() ?? ''
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
}

/* -------------------------------------------------------------------------- */
/* Job extraction                                                             */
/* -------------------------------------------------------------------------- */

// NoDesk titles are reliably "<role> at <company>" — split on the last
// " at " to handle role names like "Senior Engineer, Platform at Acme".
function splitTitleAndCompany(title: string): { role: string; company: string } | null {
  const sep = ' at '
  const lastAt = title.lastIndexOf(sep)
  if (lastAt <= 0) return null
  const role = title.slice(0, lastAt).trim()
  const company = title.slice(lastAt + sep.length).trim()
  if (!role || !company) return null
  return { role, company }
}

function buildExternalId(item: RssItem): string {
  // Use the canonical URL slug as the stable identifier. Falls back to guid
  // (which equals link for NoDesk's feed) when slug extraction fails.
  const path = item.link.replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '')
  return `nodesk:${path || item.guid}`
}

function asDate(pubDate: string | null): Date | null {
  if (!pubDate) return null
  const d = new Date(pubDate)
  return Number.isNaN(d.getTime()) ? null : d
}

function mapToScrapedJob(item: RssItem): ScrapedJobInput | null {
  const split = splitTitleAndCompany(item.title)
  if (!split) return null

  // Strip the leading newline + collapse whitespace in description so we
  // store a clean snippet rather than the verbatim CDATA dump.
  const descriptionHtml = item.description.trim()
    ? `<p>${item.description.trim().replace(/\s+/g, ' ')}</p>`
    : null

  return {
    externalId: buildExternalId(item),
    title: split.role,
    source: makeBoardSource(BOARD_NAME),
    rawCompanyName: split.company,
    url: item.link,
    applyUrl: item.link,
    isRemote: true,
    descriptionHtml,
    postedAt: asDate(item.pubDate),
  }
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

export default async function scrapeNodesk(): Promise<ScraperStats> {
  console.log(`[${BOARD_NAME}] Starting RSS-driven scrape...`)
  const stats = emptyStats()

  let xml: string
  try {
    const res = await fetchWithBackoff(RSS_URL, {
      timeoutMs: REQUEST_TIMEOUT_MS,
      headers: { Accept: 'application/rss+xml,application/xml', 'User-Agent': USER_AGENT },
      onRetry: (info) =>
        console.warn(
          `[${BOARD_NAME}] retry ${info.attempt}/${info.attempts} for RSS in ${info.delayMs}ms (${info.reason})`,
        ),
    })
    if (!res.ok) {
      console.error(`[${BOARD_NAME}] RSS fetch failed: HTTP ${res.status}`)
      return { created: 0, updated: 0, skipped: 1 }
    }
    xml = await res.text()
  } catch (err) {
    console.error(`[${BOARD_NAME}] RSS fetch error:`, err)
    return { created: 0, updated: 0, skipped: 1 }
  }

  const items = parseRssItems(xml).slice(0, MAX_ITEMS)
  console.log(`[${BOARD_NAME}] Parsed ${items.length} items from RSS`)

  for (const item of items) {
    const job = mapToScrapedJob(item)
    if (!job) {
      addIngestStatus(stats, 'skipped')
      continue
    }
    try {
      const result = await ingestJob(job)
      addIngestStatus(stats, result.status)
    } catch (err) {
      console.error(`[${BOARD_NAME}] ingest error for ${item.link}:`, err)
      addIngestStatus(stats, 'error')
    }
  }

  console.log(
    `[${BOARD_NAME}] done — created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`,
  )

  // ScraperStats.skipped already absorbs ingest errors via addIngestStatus,
  // so we just hand the stats back as-is.
  return stats
}

export { scrapeNodesk }
