// lib/scrapers/remoteyeah.ts
//
// Company discovery from RemoteYeah (remoteyeah.com). RemoteYeah is an aggregator, so its listings are not republished:
// each company it lists is looked up on its own website for a supported ATS board (Greenhouse, Lever, Ashby, ...) and
// the board is saved as a CompanyATS row. That table is an inventory: no scheduled job reads it, only the manual
// scripts/scrapeDirectATS.ts does (checked 2026-11-16). To have an employer's own board read every day, with the usual
// quality and salary gates, add it to DIRECT_EMPLOYERS (lib/constants/directEmployers.ts).
//
// Politeness: honest bot User-Agent, a gap between RemoteYeah requests, a hard stop on 401/403/429 (politeFetch), a cap
// of companies per run, and a time budget. The slice of the sitemap read rotates daily so every company gets a turn.
import * as cheerio from 'cheerio/slim'

import { prisma } from '../prisma'
import { normalizePublicCompanyWebsite } from '../companies/website'
import { companyKey } from './atsBoards'
import type { ScraperStats } from './scraperStats'
import {
  buildCareerCandidateUrls,
  extractLinkedCareerUrls,
  fetchHtmlPage,
  findSupportedAtsFromHtml,
} from './utils/companyCareersDiscovery'
import { makePoliteGetter, SourceBlocked } from './utils/politeFetch'
import { saveCompanyATS } from './utils/saveCompanyATS'

const BASE = 'https://remoteyeah.com'
const BOARD_NAME = 'remoteyeah'
const COMPANIES_SITEMAP = `${BASE}/sitemap-companies-1.xml`
const COMPANIES_PER_RUN = 100
const GAP_MS = 600
const TIME_BUDGET_MS = 8 * 60_000
/** Pages tried on an employer's site for an ATS link: home, then up to this many career pages. */
const MAX_CAREER_PAGES = 3
const DAY_MS = 86_400_000

/** Company page URLs (`/remote-companies/<slug>`) in a sitemap; the category pages (`/remote-companies`, ...) are left out. */
export function parseCompanyUrls(sitemapXml: string): string[] {
  const urls = new Set<string>()
  for (const m of String(sitemapXml || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    if (/^https:\/\/remoteyeah\.com\/remote-companies\/[a-z0-9][a-z0-9._-]*$/i.test(m[1])) urls.add(m[1])
  }
  return [...urls]
}

/** The name and own website of the company on a RemoteYeah company page, or null when either is missing. */
export function parseCompanyPage(html: string): { name: string; website: string } | null {
  const $ = cheerio.load(html || '')

  let name = ''
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const data = JSON.parse($(el).text())
      for (const node of Array.isArray(data) ? data : [data]) {
        if (node?.['@type'] !== 'BreadcrumbList') continue
        const last = [...(node.itemListElement || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)).pop()
        if (last?.name) name = String(last.name).trim()
      }
    } catch {
      // not JSON: ignore
    }
  })
  if (!name) name = $('h1').first().text().replace(/\s+/g, ' ').trim()

  // RemoteYeah tags the link to the company's own site with its utm/ref parameters; no other link carries them.
  let website: string | null = null
  $('a[href]').each((_i, el) => {
    if (website) return
    const href = String($(el).attr('href') || '')
    if (!/^https?:\/\//i.test(href) || !/[?&](?:utm_source|ref)=remoteyeah\.com\b/i.test(href)) return
    try {
      const u = new URL(href)
      u.search = ''
      website = normalizePublicCompanyWebsite(u.toString())
    } catch {
      // bad URL: ignore
    }
  })

  return name && website ? { name, website } : null
}

/** `cap` URLs starting at a position that moves on each day, wrapping around, so repeated runs cover the whole list. */
export function pickDailyBatch<T>(items: readonly T[], cap: number, now = Date.now()): T[] {
  if (items.length <= cap) return [...items]
  const start = (Math.floor(now / DAY_MS) * cap) % items.length
  return Array.from({ length: cap }, (_v, i) => items[(start + i) % items.length])
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const GENERIC_BOARD_TOKENS = new Set(['www', 'jobs', 'job', 'boards', 'jobboards', 'careers', 'career', 'apply', 'api', 'companies', 'en', 'us'])

function sameName(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) return false
  return a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)))
}

/**
 * True when the board's own name (its subdomain or first path segments, e.g. `serpapi` in jobs.lever.co/serpapi) is the
 * company's name or its website's name. A career page often links to a customer's or partner's board: the first ATS link
 * on a site is not evidence that the board is the company's (a SerpApi page linked Blue Bottle Coffee's Lever board).
 */
export function boardBelongsTo(boardUrl: string, companyName: string, website: string): boolean {
  let board: URL
  let site: URL
  try {
    board = new URL(boardUrl)
    site = new URL(website)
  } catch {
    return false
  }
  const wanted = [companyKey(companyName).replace(/ /g, ''), squash(site.hostname.replace(/^www\./i, '').split('.')[0])].filter(Boolean)
  const tokens = [board.hostname.split('.')[0], ...board.pathname.split('/').filter(Boolean).slice(0, 2)]
    .map(squash)
    .filter((t) => t && !GENERIC_BOARD_TOKENS.has(t))
  return tokens.some((t) => wanted.some((w) => sameName(t, w)))
}

/** A supported ATS board linked from the employer's home page or career pages that belongs to the company, or null. */
async function findBoard(company: { name: string; website: string }) {
  const [home, ...rest] = buildCareerCandidateUrls(company.website)
  const homePage = await fetchHtmlPage(home)
  const own = (hit: ReturnType<typeof findSupportedAtsFromHtml>) =>
    hit && boardBelongsTo(hit.url, company.name, company.website) ? hit : null
  if (homePage) {
    const hit = own(findSupportedAtsFromHtml(homePage.html, homePage.url))
    if (hit) return hit
  }
  const linked = homePage ? extractLinkedCareerUrls(homePage.html, homePage.url) : []
  for (const url of [...new Set([...linked, ...rest])].slice(0, MAX_CAREER_PAGES)) {
    const page = await fetchHtmlPage(url)
    const hit = page ? own(findSupportedAtsFromHtml(page.html, page.url)) : null
    if (hit) return hit
  }
  return null
}

export default async function scrapeRemoteYeah(): Promise<ScraperStats & { discovered?: number; checked?: number }> {
  console.log('[RemoteYeah] Starting company discovery...')
  const stats: ScraperStats & { discovered?: number; checked?: number } = { created: 0, updated: 0, skipped: 0 }
  const get = makePoliteGetter({ gapMs: GAP_MS })
  const startedAt = Date.now()

  try {
    const sitemap = await get(COMPANIES_SITEMAP)
    const batch = pickDailyBatch(parseCompanyUrls(sitemap ?? ''), COMPANIES_PER_RUN)
    if (!batch.length) {
      console.warn('[RemoteYeah] No company URLs in the sitemap (markup may have changed).')
      return stats
    }

    let checked = 0
    for (const companyUrl of batch) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break
      checked++
      const company = parseCompanyPage((await get(companyUrl)) ?? '')
      if (!company) {
        stats.skipped++
        continue
      }

      // Already known by name: the ATS scraper or the careers scraper has it.
      const known = await prisma.companyATS.findFirst({
        where: { companyName: { equals: company.name, mode: 'insensitive' } },
        select: { id: true },
      })
      if (known) {
        stats.skipped++
        continue
      }

      const board = await findBoard(company)
      if (!board) {
        stats.skipped++
        continue
      }

      const url = board.url.replace(/\/+$/, '')
      if (await prisma.companyATS.findFirst({ where: { atsUrl: { in: [url, `${url}/`] } }, select: { id: true } })) {
        stats.skipped++
        continue
      }

      await saveCompanyATS(company.name, board.url, BOARD_NAME)
      stats.created++
    }

    stats.checked = checked
    stats.discovered = stats.created
    console.log(`[RemoteYeah] ✓ checked ${checked}, new ATS boards ${stats.created}, skipped ${stats.skipped}`)
    return stats
  } catch (error) {
    if (error instanceof SourceBlocked) console.warn(`[RemoteYeah] Stopped: ${error.message}`)
    else console.error('[RemoteYeah] ❌ Scrape failed:', error)
    return { ...stats, error: error instanceof Error ? error.message : String(error) }
  }
}
