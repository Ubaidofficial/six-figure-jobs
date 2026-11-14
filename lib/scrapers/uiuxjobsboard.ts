// lib/scrapers/uiuxjobsboard.ts
//
// uiuxjobsboard.com, a design-jobs board. Server-rendered; robots.txt allows everything but /hire/success and names one
// sitemap. That sitemap lists about 2,000 job pages (ids rise over time), so this takes the highest ids we do not hold
// yet, up to a per-run cap, and keeps only jobs whose page states pay (it prints pay inside the description). The page's
// apply button is the employer's own link (Lever, Greenhouse...), saved as given.
import * as cheerio from 'cheerio/slim'

import { ingestBoardJob } from '../jobs/ingestBoardJob'
import { extractCompensationSnippet } from '../normalizers/salary'
import { prisma } from '../prisma'
import { addBoardIngestResult, emptyStats, errorStats, type ScraperStats } from './scraperStats'
import { detectATS, getCompanyJobsUrl, toAtsProvider } from './utils/detectATS'
import { makePoliteGetter, SourceBlocked, type Getter } from './utils/politeFetch'

export const UIUX_BOARD = 'uiuxjobsboard'
const SITEMAP = 'https://uiuxjobsboard.com/sitemaps/1.xml'
const MAX_PAGES = 120
const GAP_MS = 1500

/** Job page URLs from the sitemap, highest id first. */
export function parseUiuxSitemap(xml: string): Array<{ id: string; url: string }> {
  return [...xml.matchAll(/<loc>(https:\/\/uiuxjobsboard\.com\/job\/(\d+)-[^<]+)<\/loc>/g)]
    .map((m) => ({ id: m[2], url: m[1] }))
    .sort((a, b) => Number(b.id) - Number(a.id))
}

export type UiuxJob = { title: string; company: string; location: string | null; remote: boolean; postedAt: Date | null; validThrough: Date | null; employmentType: string | null; descriptionHtml: string; applyUrl: string | null }

/** A job page: JSON-LD for the facts, the page body for the description, the primary button for the employer's link. */
export function parseUiuxJob(html: string): UiuxJob | null {
  const $ = cheerio.load(html)
  let ld: any = null
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const data = JSON.parse($(el).contents().text())
      if (data?.['@type'] === 'JobPosting') ld = data
    } catch {
      /* not JSON */
    }
  })
  const description = cheerio.load(html, { xml: { xmlMode: false, decodeEntities: false } })('.job-description').first().html()
  const title = String(ld?.title ?? '').trim()
  const company = String(ld?.hiringOrganization?.name ?? '').trim()
  if (!ld || !title || !company || !description?.trim()) return null
  const pageTitle = $('title').first().text() // "Remote Product Designer at Skyward in United States | ..."
  const location = pageTitle.match(/ in ([^|]+?)(?:\s*\||\s*-\s|$)/)?.[1]?.trim() ?? null
  const date = (v: unknown) => (v && Number.isFinite(new Date(String(v)).getTime()) ? new Date(String(v)) : null)
  const apply = $('a.btn-primary[target="_blank"][href^="http"]').first().attr('href') ?? null
  return {
    title,
    company,
    location,
    remote: /^remote\b/i.test(pageTitle.trim()),
    postedAt: date(ld.datePosted),
    validThrough: date(ld.validThrough),
    employmentType: Array.isArray(ld.employmentType) ? String(ld.employmentType[0] ?? '') || null : null,
    descriptionHtml: description.trim(),
    applyUrl: apply,
  }
}

export async function collectUiuxJobs(opts: { get: Getter; known?: ReadonlySet<string>; maxPages?: number }) {
  const known = opts.known ?? new Set<string>()
  const jobs: Array<UiuxJob & { id: string; url: string }> = []
  let pages = 0
  let blocked: string | null = null
  try {
    const sitemap = await opts.get(SITEMAP)
    for (const entry of sitemap ? parseUiuxSitemap(sitemap) : []) {
      if (known.has(entry.id)) continue
      if (pages >= (opts.maxPages ?? MAX_PAGES)) break
      pages++
      const page = await opts.get(entry.url)
      const job = page ? parseUiuxJob(page) : null
      // Only jobs that state pay are kept; the others could never pass the salary gate.
      if (job && extractCompensationSnippet(job.descriptionHtml.replace(/<[^>]+>/g, ' '))) jobs.push({ ...job, ...entry })
    }
  } catch (err) {
    if (!(err instanceof SourceBlocked)) throw err
    blocked = err.message
  }
  return { jobs, pages, blocked }
}

export default async function scrapeUiuxJobsBoard(): Promise<ScraperStats> {
  console.log('[UIUXJobsBoard] Starting scrape...')
  const stats = emptyStats()
  try {
    const stored = await prisma.job.findMany({ where: { source: `board:${UIUX_BOARD}` }, select: { externalId: true } })
    const known = new Set(stored.map((j) => j.externalId).filter((id): id is string => Boolean(id)))
    const { jobs, pages, blocked } = await collectUiuxJobs({ get: makePoliteGetter({ gapMs: GAP_MS }), known })
    for (const job of jobs) {
      const applyUrl = job.applyUrl ?? job.url
      const atsType = detectATS(applyUrl)
      const provider = toAtsProvider(atsType)
      const result = await ingestBoardJob(UIUX_BOARD, {
        externalId: job.id,
        title: job.title,
        url: job.url,
        applyUrl,
        rawCompanyName: job.company,
        locationText: job.location,
        isRemote: job.remote ? true : null,
        employmentType: job.employmentType,
        postedAt: job.postedAt,
        descriptionHtml: job.descriptionHtml,
        explicitAtsProvider: provider,
        explicitAtsUrl: provider ? getCompanyJobsUrl(applyUrl, atsType) : null,
        raw: { sourceBoard: UIUX_BOARD },
      })
      addBoardIngestResult(stats, result)
    }
    console.log(`[UIUXJobsBoard] ✓ ${pages} pages, ${jobs.length} with pay, ${stats.created} new${blocked ? `; STOPPED: ${blocked}` : ''}`)
    if (blocked) stats.error = `UIUX Jobs Board stopped the run: ${blocked}`
    return stats
  } catch (error) {
    console.error('[UIUXJobsBoard] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
