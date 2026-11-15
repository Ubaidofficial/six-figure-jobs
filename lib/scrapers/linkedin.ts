// lib/scrapers/linkedin.ts
//
// LinkedIn's public, logged-out job pages ("guest" endpoints): no login, no cookies, no account. OFF unless
// LINKEDIN_SCRAPER_ENABLED=1.
//
// READ THIS FIRST. LinkedIn's User Agreement forbids automated collection, and it can and does block addresses and
// take legal action. Running this is a decision for the site's owner, who asked for it on 2026-11-14 after being told
// so. It is built to stay small and polite, not to get around anything:
//   - no login, no cookies, no proxies, no header rotation; one honest User-Agent;
//   - 3-7 s between requests (FTJA measured a 429 at 2 s: github.com/TaegyuJEONG/ftja, ftja/scrape.py);
//   - the FIRST 429 / 999 / auth wall ends the run; nothing retries or works around it;
//   - a posting's page is fetched only when its title contains the search words (LinkedIn matches by meaning, so most
//     results are not what was asked for) and only when it is not already stored, which is most of the saved requests;
//   - only postings that state pay are kept, and the central salary gate (lib/ingest) still decides what is published.
// Measured on 2026-11-14 (3 requests): the salary filter `f_SB2` is ignored for logged-out requests (the filtered and
// unfiltered result lists were identical), so pay cannot be asked for, only read from each posting.
//
// Pay is read from the posting's description ("The salary range is $263,600 - $395,400") and, if LinkedIn shows one, its
// own pay element. The pay element's class names are NOT verified (none of the pages seen had one); the description path is.
import * as cheerio from 'cheerio/slim'

import { ingestBoardJob } from '../jobs/ingestBoardJob'
import { extractCompensationSnippet } from '../normalizers/salary'
import { prisma } from '../prisma'
import { addBoardIngestResult, emptyStats, errorStats, type ScraperStats } from './scraperStats'

export const LINKEDIN_BOARD = 'linkedin'
const SEARCH_URL = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const DETAIL_URL = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting'
const PAGE_SIZE = 10
const GAP_MS: readonly [number, number] = [3000, 7000]
const USER_AGENT = 'SixFigureJobsBot/1.0 (+https://www.6figjobs.com)'

export type LinkedInCard = {
  id: string
  title: string
  company: string
  companyUrl: string | null
  location: string | null
  /** ISO date from the card, when it has one. */
  postedAt: string | null
  /** The card's own pay text, if LinkedIn printed one (class names unverified). */
  salaryText: string | null
  url: string
}

export type LinkedInDetail = {
  descriptionHtml: string | null
  employmentType: string | null
  seniority: string | null
  salaryText: string | null
  closed: boolean
}

const clean = (s: string | undefined | null) => (s ?? '').replace(/\s+/g, ' ').trim()

/** The cards of one search-results page. */
export function parseSearchCards(html: string): LinkedInCard[] {
  const $ = cheerio.load(html)
  const cards: LinkedInCard[] = []
  $('.base-card, .job-search-card').each((_i, el) => {
    const card = $(el)
    const id = String(card.attr('data-entity-urn') ?? '').split(':').pop() ?? ''
    const title = clean(card.find('.base-search-card__title').first().text())
    const company = clean(card.find('.base-search-card__subtitle').first().text())
    if (!/^\d+$/.test(id) || !title || !company) return
    const companyHref = card.find('.base-search-card__subtitle a').first().attr('href') ?? ''
    cards.push({
      id,
      title,
      company,
      companyUrl: companyHref ? companyHref.split('?')[0] : null,
      location: clean(card.find('.job-search-card__location').first().text()) || null,
      postedAt: card.find('time').first().attr('datetime') ?? null,
      salaryText: clean(card.find('.job-search-card__salary-info').first().text()) || null,
      url: `https://www.linkedin.com/jobs/view/${id}`,
    })
  })
  return cards
}

/** One posting's page: description, criteria, and any pay element. */
export function parseJobDetail(html: string): LinkedInDetail {
  const $ = cheerio.load(html)
  const criteria = new Map<string, string>()
  $('.description__job-criteria-item').each((_i, el) => {
    criteria.set(clean($(el).find('.description__job-criteria-subheader').text()).toLowerCase(), clean($(el).find('.description__job-criteria-text').text()))
  })
  // Without entity decoding, so `html()` returns the text as written: with it, cheerio re-encodes "$" as "&#x24;", and
  // the salary parser in lib/ingest reads this HTML, so no pay would be found.
  const description = cheerio.load(html, { xml: { xmlMode: false, decodeEntities: false } })('.show-more-less-html__markup').first().html()
  return {
    descriptionHtml: description ? description.trim() : null,
    employmentType: criteria.get('employment type') ?? null,
    seniority: criteria.get('seniority level') ?? null,
    salaryText: clean($('.compensation__salary, .salary.compensation__salary').first().text()) || null,
    closed: /no longer accepting applications/i.test($('body').text()),
  }
}

/** LinkedIn matches by meaning; keep a result only when its title has every word of the search. */
export function titleHasSearchWords(title: string, query: string): boolean {
  const words = query.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length >= 3)
  const t = title.toLowerCase()
  return words.every((w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.+#]/g, '\\$&')}`).test(t))
}

export type LinkedInOptions = {
  queries: string[]
  locations: string[]
  /** Search pages per query and location (10 results each). */
  maxPages: number
  /** Only postings from the last this-many hours. */
  hoursOld: number
  /** Most requests (searches and posting pages together) in one run; the run ends cleanly when it is reached. */
  maxRequests: number
  /** Posting ids already stored: their pages are not fetched. */
  knownIds?: ReadonlySet<string>
  /** Swappable for tests. */
  fetchImpl?: (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{ status: number; text(): Promise<string> }>
  sleep?: (ms: number) => Promise<void>
}

/** A posting that states pay. `salaryText` is LinkedIn's own pay text when it printed one; otherwise null and the pay is in the description (ingest reads it from there). */
export type LinkedInPosting = Omit<LinkedInCard, 'salaryText'> & Omit<LinkedInDetail, 'salaryText'> & { salaryText: string | null }

/** Raised for the signals that mean "stop": rate limit, block, auth wall. */
export class LinkedInBlocked extends Error {}

/** Raised when the run's request cap is reached: a normal end, not a failure. */
class RequestBudgetReached extends Error {}

export function readOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): LinkedInOptions {
  const list = (v: string | undefined, fallback: string[]) => (v ? v.split('|').map((s) => s.trim()).filter(Boolean) : fallback)
  return {
    queries: list(env.LINKEDIN_QUERIES, ['staff software engineer', 'principal engineer', 'engineering manager', 'machine learning engineer', 'data scientist', 'product manager']),
    locations: list(env.LINKEDIN_LOCATIONS, ['United States']),
    maxPages: Number(env.LINKEDIN_MAX_PAGES) || 3,
    hoursOld: Number(env.LINKEDIN_HOURS_OLD) || 168,
    maxRequests: Number(env.LINKEDIN_MAX_REQUESTS) || 120,
  }
}

/**
 * Searches and reads postings, returning only those that state pay. Reads the network and parses; touches no database.
 * Stops quietly at the first sign LinkedIn does not want the request (LinkedInBlocked is caught and reported in `blocked`).
 */
export async function collectLinkedInPostings(opts: LinkedInOptions): Promise<{ postings: LinkedInPosting[]; requests: number; blocked: string | null; budgetReached: boolean }> {
  const fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init))
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const known = opts.knownIds ?? new Set<string>()
  const seen = new Set<string>()
  const postings: LinkedInPosting[] = []
  let requests = 0

  const get = async (url: string): Promise<string> => {
    if (requests >= opts.maxRequests) throw new RequestBudgetReached()
    if (requests > 0) await sleep(GAP_MS[0] + Math.random() * (GAP_MS[1] - GAP_MS[0]))
    requests++
    const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, signal: AbortSignal.timeout(20_000) })
    if (res.status === 429 || res.status === 999 || res.status === 403 || res.status === 401) throw new LinkedInBlocked(`HTTP ${res.status}`)
    if (res.status >= 400) return ''
    const text = await res.text()
    if (/authwall|uas\/login/i.test(text.slice(0, 4000))) throw new LinkedInBlocked('auth wall')
    return text
  }

  try {
    for (const query of opts.queries) {
      for (const location of opts.locations) {
        for (let page = 0; page < opts.maxPages; page++) {
          const params = new URLSearchParams({ keywords: query, location, f_TPR: `r${opts.hoursOld * 3600}`, start: String(page * PAGE_SIZE) })
          const cards = parseSearchCards(await get(`${SEARCH_URL}?${params}`))
          if (!cards.length) break
          for (const card of cards) {
            if (seen.has(card.id) || known.has(card.id) || !titleHasSearchWords(card.title, query)) continue
            seen.add(card.id)
            const detail = parseJobDetail(await get(`${DETAIL_URL}/${card.id}`))
            if (detail.closed || !detail.descriptionHtml) continue
            const statedPay = clean(card.salaryText || detail.salaryText) || null
            const payInText = extractCompensationSnippet(detail.descriptionHtml.replace(/<[^>]+>/g, ' '))
            if (!statedPay && !payInText) continue // no stated pay: not kept, not stored
            postings.push({ ...card, ...detail, salaryText: statedPay })
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof LinkedInBlocked) return { postings, requests, blocked: err.message, budgetReached: false }
    if (err instanceof RequestBudgetReached) return { postings, requests, blocked: null, budgetReached: true }
    throw err
  }
  return { postings, requests, blocked: null, budgetReached: false }
}

/** Registered in lib/scrapers/boardRegistry.ts. Does nothing unless LINKEDIN_SCRAPER_ENABLED=1. */
export default async function scrapeLinkedIn(): Promise<ScraperStats> {
  if (process.env.LINKEDIN_SCRAPER_ENABLED !== '1') return emptyStats()
  console.log('[LinkedIn] Starting scrape (guest pages)...')
  const stats = emptyStats()
  try {
    const stored = await prisma.job.findMany({ where: { source: `board:${LINKEDIN_BOARD}` }, select: { externalId: true } })
    const { postings, requests, blocked, budgetReached } = await collectLinkedInPostings({
      ...readOptionsFromEnv(),
      knownIds: new Set(stored.map((j) => j.externalId).filter((id): id is string => Boolean(id))),
    })
    for (const p of postings) {
      const result = await ingestBoardJob(LINKEDIN_BOARD, {
        externalId: p.id,
        title: p.title,
        url: p.url,
        applyUrl: p.url,
        rawCompanyName: p.company,
        companyLinkedInUrl: p.companyUrl,
        locationText: p.location,
        employmentType: p.employmentType,
        postedAt: p.postedAt ? new Date(p.postedAt) : null,
        descriptionHtml: p.descriptionHtml,
        raw: { sourceBoard: LINKEDIN_BOARD, salaryText: p.salaryText, seniority: p.seniority },
      })
      addBoardIngestResult(stats, result)
    }
    console.log(`[LinkedIn] ✓ ${requests} requests, ${postings.length} postings with pay, ${stats.created} new${blocked ? `; STOPPED EARLY: ${blocked}` : budgetReached ? '; request cap reached' : ''}`)
    if (blocked) stats.error = `LinkedIn stopped the run: ${blocked}`
    return stats
  } catch (error) {
    console.error('[LinkedIn] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
