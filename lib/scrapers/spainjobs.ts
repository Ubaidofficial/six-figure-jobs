// lib/scrapers/spainjobs.ts
//
// spainjobs.io, an English-language board for Spain (89,000+ live jobs on 2026-11-14). Its pages are server-rendered and
// robots.txt allows them (it disallows /api/, /jobs/search? and a few others). Reading all of it would mean thousands of
// 400 KB pages, so this reads only its salary-filtered listings ("EUR 75k+", "EUR 100k+": about 94 jobs on 2026-11-14), whose
// cards show the pay, and then the page of each job we do not hold yet. The listings have no pagination for a bot (the
// "load more" uses the disallowed /api/), so each gives its 12 newest; run daily, that is the day's new high-paying jobs.
//
// The apply link is the employer's own (a Comeet, Lever... link on the job page) and is saved as given. Pay is EUR; the
// central salary gate decides what is published (EUR 80k at the top of the range).
import * as cheerio from 'cheerio/slim'

import { ingestBoardJob } from '../jobs/ingestBoardJob'
import { prisma } from '../prisma'
import { addBoardIngestResult, emptyStats, errorStats, type ScraperStats } from './scraperStats'
import { detectATS, getCompanyJobsUrl, toAtsProvider } from './utils/detectATS'
import { makePoliteGetter, SourceBlocked, type Getter } from './utils/politeFetch'

export const SPAINJOBS_BOARD = 'spainjobs'
const BASE = 'https://www.spainjobs.io'
export const LISTINGS = ['/jobs/100k', '/jobs/75k', '/jobs/75k/madrid', '/jobs/75k/barcelona', '/jobs/75k/valencia'] as const
const MAX_DETAIL_PAGES = 60
const GAP_MS = 1500

const clean = (s: string | undefined | null) => (s ?? '').replace(/\s+/g, ' ').trim()

export type SpainCard = { externalId: string; path: string; title: string; company: string; salaryText: string; location: string | null }

/** The job cards on a salary-filtered listing page. */
export function parseSpainListing(html: string): SpainCard[] {
  const $ = cheerio.load(html)
  const cards: SpainCard[] = []
  $('article').each((_i, el) => {
    const card = $(el)
    const link = card.find('h3.job-card-title a').first()
    const path = link.attr('href') ?? ''
    const externalId = path.split('/').pop() ?? ''
    const text = clean(card.text())
    const salary = text.match(/€\s?[\d.,]+k?(?:\s?[–-]\s?€?\s?[\d.,]+k?)?/i)?.[0]
    const company = clean(card.find('span[translate="no"]').first().text())
    const title = clean(link.text())
    if (!/^\/companies\/[^/]+\/[^/]+$/.test(path) || !externalId || !title || !company || !salary) return
    const location = clean(card.find('span[class="text-ink"]').first().text()) || null
    cards.push({ externalId, path, title, company, salaryText: clean(salary), location })
  })
  return cards
}

/** A job page: its description and the employer's apply link. */
export function parseSpainDetail(html: string): { descriptionHtml: string | null; applyUrl: string | null } {
  const $ = cheerio.load(html)
  const own = /(^|\.)(spainjobs|portugaljobs|nljobs)\.io$/
  const applyUrl =
    $('a[target="_blank"][href^="http"]')
      .map((_i, a) => $(a).attr('href') ?? '')
      .get()
      .find((href) => {
        try {
          return !own.test(new URL(href).hostname.replace(/^www\./, ''))
        } catch {
          return false
        }
      }) ?? null
  // Entities are kept as written: re-encoding "€" or "$" would hide the pay from the salary parser.
  const prose = cheerio.load(html, { xml: { xmlMode: false, decodeEntities: false } })
  const blocks = prose('div.prose').map((_i, el) => prose(el).html() ?? '').get().filter((b) => clean(b))
  return { descriptionHtml: blocks.length ? blocks.join('\n') : null, applyUrl }
}

export async function collectSpainJobs(opts: { get: Getter; known?: ReadonlySet<string>; maxDetailPages?: number }) {
  const known = opts.known ?? new Set<string>()
  const budget = opts.maxDetailPages ?? MAX_DETAIL_PAGES
  const seen = new Set<string>()
  const jobs: Array<SpainCard & { descriptionHtml: string; applyUrl: string | null }> = []
  let detailPages = 0
  let blocked: string | null = null
  try {
    for (const listing of LISTINGS) {
      const html = await opts.get(`${BASE}${listing}`)
      if (!html) continue
      for (const card of parseSpainListing(html)) {
        if (seen.has(card.externalId) || known.has(card.externalId)) continue
        seen.add(card.externalId)
        if (detailPages >= budget) continue
        detailPages++
        const page = await opts.get(`${BASE}${card.path}`)
        const detail = page ? parseSpainDetail(page) : null
        if (!detail?.descriptionHtml) continue
        jobs.push({ ...card, descriptionHtml: detail.descriptionHtml, applyUrl: detail.applyUrl })
      }
    }
  } catch (err) {
    if (!(err instanceof SourceBlocked)) throw err
    blocked = err.message
  }
  return { jobs, detailPages, blocked }
}

export default async function scrapeSpainJobs(): Promise<ScraperStats> {
  console.log('[SpainJobs] Starting scrape...')
  const stats = emptyStats()
  try {
    const stored = await prisma.job.findMany({ where: { source: `board:${SPAINJOBS_BOARD}` }, select: { externalId: true } })
    const known = new Set(stored.map((j) => j.externalId).filter((id): id is string => Boolean(id)))
    const { jobs, detailPages, blocked } = await collectSpainJobs({ get: makePoliteGetter({ gapMs: GAP_MS }), known })
    for (const job of jobs) {
      const url = `${BASE}${job.path}`
      const applyUrl = job.applyUrl ?? url
      const atsType = detectATS(applyUrl)
      const provider = toAtsProvider(atsType)
      const result = await ingestBoardJob(SPAINJOBS_BOARD, {
        externalId: job.externalId,
        title: job.title,
        url,
        applyUrl,
        rawCompanyName: job.company,
        locationText: job.location,
        isRemote: job.location && /^remote\b/i.test(job.location) ? true : null,
        descriptionHtml: job.descriptionHtml,
        explicitAtsProvider: provider,
        explicitAtsUrl: provider ? getCompanyJobsUrl(applyUrl, atsType) : null,
        raw: { sourceBoard: SPAINJOBS_BOARD, salaryText: job.salaryText },
      })
      addBoardIngestResult(stats, result)
    }
    console.log(`[SpainJobs] ✓ ${detailPages} job pages, ${stats.created} new${blocked ? `; STOPPED: ${blocked}` : ''}`)
    if (blocked) stats.error = `SpainJobs stopped the run: ${blocked}`
    return stats
  } catch (error) {
    console.error('[SpainJobs] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
