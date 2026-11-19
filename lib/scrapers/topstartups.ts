// lib/scrapers/topstartups.ts
//
// topstartups.io lists about 25,000 startup jobs, but its cards state no pay, so its jobs are not ingested. What it does
// give is each employer's own job link (Greenhouse, Ashby, Lever...), from which the company's whole board follows. This
// collects those boards so they can be added as Company rows with `atsProvider` and `atsUrl`, which the daily ATS scrape
// (daily-scrape.yml) reads; that scrape applies the usual salary gate to every posting.
//
// robots.txt disallows `/*?page=`, so only the first page of each filtered listing is read. The filtered listings come
// from the site's own sitemap (about 230: by role, location and market), each showing about 12 jobs. Links to an
// employer's own careers site (careers.example.com/jobs?gh_jid=...) do not name the board, so they are skipped.
import * as cheerio from 'cheerio/slim'

import { companySlug } from '../companies/europeanBoards'
import { detectAtsFromUrl } from '../normalizers/ats'
import type { AtsProvider } from './ats/types'
import { SourceBlocked, type Getter } from './utils/politeFetch'

const BASE_URL = 'https://topstartups.io'
export const TOPSTARTUPS_SITEMAP = `${BASE_URL}/sitemap.xml`

/** The job listing pages from the sitemap (/jobs/ and its filters), never a ?page= URL robots.txt disallows. */
export function parseTopStartupsSitemap(xml: string): string[] {
  const urls = new Set<string>()
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    let url: URL
    try {
      url = new URL(cheerio.load(m[1], null, false).text().trim())
    } catch {
      continue
    }
    if (url.hostname !== 'topstartups.io' || url.pathname !== '/jobs/' || url.searchParams.has('page')) continue
    urls.add(url.toString())
  }
  return [...urls]
}

export type TopStartupsBoard = { name: string; provider: AtsProvider; atsUrl: string }

/** The employers on one listing page whose job link names an applicant tracking board. */
export function parseTopStartupsJobs(html: string): TopStartupsBoard[] {
  const $ = cheerio.load(html)
  const boards: TopStartupsBoard[] = []
  $('.infinite-item').each((_i, card) => {
    const name = $(card).find('#startup-website-link h7').first().text().replace(/\s+/g, ' ').trim()
    const detected = detectAtsFromUrl($(card).find('a#apply-button').attr('href'))
    if (name && detected) boards.push({ name, provider: detected.provider, atsUrl: detected.atsUrl })
  })
  return boards
}

/** Every board on the listing pages, once each (by board URL, any letter case). Stops at the first block. */
export async function collectTopStartupsBoards(opts: { get: Getter; maxPages?: number }) {
  const boards = new Map<string, TopStartupsBoard>()
  let pages = 0
  let blocked: string | null = null
  try {
    const sitemap = await opts.get(TOPSTARTUPS_SITEMAP)
    for (const url of sitemap ? parseTopStartupsSitemap(sitemap) : []) {
      if (pages >= (opts.maxPages ?? Infinity)) break
      pages++
      const page = await opts.get(url)
      for (const board of page ? parseTopStartupsJobs(page) : []) {
        const key = board.atsUrl.toLowerCase()
        if (!boards.has(key)) boards.set(key, board)
      }
    }
  } catch (err) {
    if (!(err instanceof SourceBlocked)) throw err
    blocked = err.message
  }
  return { boards: [...boards.values()], pages, blocked }
}

export type ExistingCompany = { id: string; slug: string; name: string; atsProvider: string | null; atsUrl: string | null }

export type BoardPlan =
  | { action: 'create'; data: { name: string; slug: string; atsProvider: AtsProvider; atsUrl: string } }
  | { action: 'attach'; id: string; data: { atsProvider: AtsProvider; atsUrl: string } }
  | { action: 'skip'; reason: 'already-onboarded' | 'has-other-ats-settings' | 'no-slug' }

const sameBoard = (a: string | null | undefined, b: string) => detectAtsFromUrl(a)?.atsUrl.toLowerCase() === b.toLowerCase()

/** The existing row for a board: same board URL first, then same slug, then same name (any letter case). */
export function findExisting(board: TopStartupsBoard, rows: ExistingCompany[]): ExistingCompany | null {
  const slug = companySlug(board.name)
  return (
    rows.find((r) => sameBoard(r.atsUrl, board.atsUrl)) ??
    rows.find((r) => r.slug === slug) ??
    rows.find((r) => r.name.trim().toLowerCase() === board.name.toLowerCase()) ??
    null
  )
}

/** Create a company, attach the board to one without ATS settings, or leave alone a row that points elsewhere. */
export function planBoard(board: TopStartupsBoard, existing: ExistingCompany | null): BoardPlan {
  const { provider: atsProvider, atsUrl } = board
  if (!existing) {
    const slug = companySlug(board.name)
    return slug ? { action: 'create', data: { name: board.name, slug, atsProvider, atsUrl } } : { action: 'skip', reason: 'no-slug' }
  }
  if (sameBoard(existing.atsUrl, atsUrl)) return { action: 'skip', reason: 'already-onboarded' }
  if (existing.atsProvider || existing.atsUrl) return { action: 'skip', reason: 'has-other-ats-settings' }
  return { action: 'attach', id: existing.id, data: { atsProvider, atsUrl } }
}
