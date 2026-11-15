// lib/scrapers/jobicy.ts
//
// Jobicy's free JSON API (https://jobicy.com/api/jobs). Remote jobs only; many carry structured salary fields.
//
// Jobicy's terms, as its API notice states them (read 2026-11-14): credit Jobicy with a direct link to the source, and
// every application button goes to the listing URL the feed gives. So `url` and `applyUrl` here are both Jobicy's listing
// URL, the apply button reads "Apply on Jobicy" (boardNameFor), and nothing is rewritten to the employer. Direct employer
// links are a paid Jobicy feature. The feed asks for polite use: pages are 1.1 s apart, and a 429 ends the run.
import { ingestBoardJob } from '../jobs/ingestBoardJob'
import { extractCompensationSnippet } from '../normalizers/salary'
import { addBoardIngestResult, emptyStats, errorStats, type ScraperStats } from './scraperStats'

export const JOBICY_BOARD = 'jobicy'
const API_URL = 'https://jobicy.com/api/jobs'
const MAX_PAGES = 5
const PAGE_GAP_MS = 1100

export type JobicyJob = {
  externalId: string
  title: string
  company: string
  url: string
  location: string | null
  employmentType: string | null
  postedAt: Date | null
  descriptionHtml: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  salaryInterval: string | null
}

/** Jobicy writes lists as Python-style strings: "['Full-Time']". */
function firstListItem(value: unknown): string | null {
  const text = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
  return text.replace(/[[\]'"]/g, '').split(',')[0].trim() || null
}

const INTERVALS: Record<string, string> = { yearly: 'year', annual: 'year', monthly: 'month', weekly: 'week', daily: 'day', hourly: 'hour' }

const positiveNumber = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** The jobs in one API page that carry pay, in our shape. A job with no stated pay anywhere is left out. */
export function parseJobicyPage(json: any): JobicyJob[] {
  const out: JobicyJob[] = []
  for (const j of Array.isArray(json?.jobs) ? json.jobs : []) {
    const id = String(j?.id ?? '').trim()
    const title = String(j?.jobTitle ?? '').trim()
    const company = String(j?.companyName ?? '').trim()
    const url = String(j?.url ?? '').trim()
    if (!id || !title || !company || !/^https:\/\/jobicy\.com\//.test(url)) continue
    const salaryMin = positiveNumber(j.salaryMin)
    const salaryMax = positiveNumber(j.salaryMax)
    const descriptionHtml = typeof j.jobDescription === 'string' ? j.jobDescription : null
    const payInText = descriptionHtml ? extractCompensationSnippet(descriptionHtml.replace(/<[^>]+>/g, ' ')) : null
    if (!salaryMin && !salaryMax && !payInText) continue
    const posted = j.pubDate ? new Date(j.pubDate) : null
    out.push({
      externalId: id,
      title,
      company,
      url,
      location: String(j.jobGeo ?? '').trim() || null,
      employmentType: firstListItem(j.jobType),
      postedAt: posted && Number.isFinite(posted.getTime()) ? posted : null,
      descriptionHtml,
      salaryMin,
      salaryMax,
      salaryCurrency: String(j.salaryCurrency ?? '').trim().toUpperCase() || null,
      salaryInterval: INTERVALS[String(j.salaryPeriod ?? '').toLowerCase()] ?? null,
    })
  }
  return out
}

export default async function scrapeJobicy(): Promise<ScraperStats> {
  console.log('[Jobicy] Starting scrape...')
  const stats = emptyStats()
  try {
    let cursor: string | null = null
    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await new Promise((r) => setTimeout(r, PAGE_GAP_MS))
      const res: Response = await fetch(`${API_URL}?count=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, {
        headers: { 'User-Agent': 'SixFigureJobsBot/1.0 (+https://www.6figjobs.com)', Accept: 'application/json' },
        cache: 'no-store',
      })
      if (res.status === 429) {
        stats.error = 'Jobicy rate limit (429); stopped'
        break
      }
      if (!res.ok) return errorStats(new Error(`Jobicy HTTP ${res.status}`))
      const json: any = await res.json()
      for (const job of parseJobicyPage(json)) {
        const result = await ingestBoardJob(JOBICY_BOARD, {
          externalId: job.externalId,
          title: job.title,
          url: job.url,
          applyUrl: job.url,
          rawCompanyName: job.company,
          locationText: job.location,
          isRemote: true,
          employmentType: job.employmentType,
          postedAt: job.postedAt,
          descriptionHtml: job.descriptionHtml,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          salaryCurrency: job.salaryCurrency,
          salaryInterval: job.salaryInterval,
          raw: { sourceBoard: JOBICY_BOARD },
        })
        addBoardIngestResult(stats, result)
      }
      cursor = json?.hasMore && json?.nextCursor ? String(json.nextCursor) : null
      if (!cursor) break
    }
    console.log(`[Jobicy] ✓ ${stats.created} new, ${stats.updated} updated`)
    return stats
  } catch (error) {
    console.error('[Jobicy] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
