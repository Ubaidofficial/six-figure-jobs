// lib/scrapers/workingnomads.ts
//
// Working Nomads' public JSON feed (https://www.workingnomads.com/api/exposed_jobs/). A small feed (about 30 jobs on
// 2026-11-14) with no salary field: pay appears only inside the description, so only jobs whose description states pay are
// kept. The feed publishes no terms (read 2026-11-14). The apply link is the feed's own `/job/go/<id>/` redirect, used as
// given, and the button reads "Apply on Working Nomads" (boardNameFor).
import { ingestBoardJob } from '../jobs/ingestBoardJob'
import { extractCompensationSnippet } from '../normalizers/salary'
import { addBoardIngestResult, emptyStats, errorStats, type ScraperStats } from './scraperStats'

export const WORKINGNOMADS_BOARD = 'workingnomads'
const API_URL = 'https://www.workingnomads.com/api/exposed_jobs/'

export type WorkingNomadsJob = {
  externalId: string
  title: string
  company: string
  url: string
  location: string | null
  postedAt: Date | null
  descriptionHtml: string
  skills: string[]
}

/** The feed's jobs that state pay in their description, in our shape. */
export function parseWorkingNomads(json: unknown): WorkingNomadsJob[] {
  const out: WorkingNomadsJob[] = []
  for (const j of Array.isArray(json) ? json : []) {
    const url = String(j?.url ?? '').trim()
    const externalId = url.match(/\/job\/go\/(\d+)/)?.[1]
    const title = String(j?.title ?? '').trim()
    const company = String(j?.company_name ?? '').trim()
    const descriptionHtml = typeof j?.description === 'string' ? j.description : ''
    if (!externalId || !title || !company || !descriptionHtml) continue
    if (!extractCompensationSnippet(descriptionHtml.replace(/<[^>]+>/g, ' '))) continue
    const posted = j.pub_date ? new Date(j.pub_date) : null
    out.push({
      externalId,
      title,
      company,
      url,
      location: String(j.location ?? '').trim() || null,
      postedAt: posted && Number.isFinite(posted.getTime()) ? posted : null,
      descriptionHtml,
      skills: String(j.tags ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
    })
  }
  return out
}

export default async function scrapeWorkingNomads(): Promise<ScraperStats> {
  console.log('[WorkingNomads] Starting scrape...')
  const stats = emptyStats()
  try {
    const res = await fetch(API_URL, {
      headers: { 'User-Agent': 'SixFigureJobsBot/1.0 (+https://www.6figjobs.com)', Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return errorStats(new Error(`Working Nomads HTTP ${res.status}`))
    for (const job of parseWorkingNomads(await res.json())) {
      const result = await ingestBoardJob(WORKINGNOMADS_BOARD, {
        externalId: job.externalId,
        title: job.title,
        url: job.url,
        applyUrl: job.url,
        rawCompanyName: job.company,
        locationText: job.location,
        isRemote: true,
        postedAt: job.postedAt,
        descriptionHtml: job.descriptionHtml,
        skills: job.skills,
        raw: { sourceBoard: WORKINGNOMADS_BOARD },
      })
      addBoardIngestResult(stats, result)
    }
    console.log(`[WorkingNomads] ✓ ${stats.created} new, ${stats.updated} updated`)
    return stats
  } catch (error) {
    console.error('[WorkingNomads] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
