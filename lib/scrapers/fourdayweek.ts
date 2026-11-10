// lib/scrapers/fourdayweek.ts
//
// Imports 4dayweek.io's four-day-week listings (reduced hours at full pay) from its free public API, through the normal
// board ingest, so the salary gate decides which ones the site keeps (about 50 of 643 paid $100k+ on 2026-11-09).
// Until 2026-11-09 this read the HTML list page, whose markup had changed so that it found no jobs at all.
// Only listings labelled `4_day_week` are read (lib/jobs/fourDayWeek.ts explains the labels).

import { ingestBoardJob, type BoardJobInput } from '../jobs/ingestBoardJob'
import { fetchFourDayWeekJobs, isReducedHoursFourDayWeek, type FourDayWeekApiJob } from '../jobs/fourDayWeek'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'

const BOARD = '4dayweek'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Inline Markdown (bold, italic, links) on already escaped text. */
function inline(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s"<>]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
}

/** The listing descriptions are Markdown: headings, paragraphs and bullet lists become HTML; anything else is text. */
export function markdownToHtml(md: string | null | undefined): string | null {
  const text = String(md ?? '').replace(/\r\n?/g, '\n').trim()
  if (!text) return null
  const out: string[] = []
  let list: string[] = []
  let para: string[] = []
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(escapeHtml(para.join(' ')))}</p>`)
    para = []
  }
  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li>${inline(escapeHtml(li))}</li>`).join('')}</ul>`)
    list = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    const bullet = /^[-*+]\s+(.*)$/.exec(line)
    if (!line) {
      flushPara()
      flushList()
    } else if (heading) {
      flushPara()
      flushList()
      out.push(`<h3>${inline(escapeHtml(heading[1]))}</h3>`)
    } else if (bullet) {
      flushPara()
      list.push(bullet[1])
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return out.join('\n')
}

/** "Remote - United States", "Milan, Italy", "London, United Kingdom; Berlin, Germany", or null. */
export function fourDayWeekLocationText(job: Pick<FourDayWeekApiJob, 'locations' | 'work_arrangement'>): string | null {
  const places = (job.locations ?? [])
    .map((l) => [l.city, l.country].filter((x): x is string => Boolean(x && x.trim())).join(', '))
    .filter(Boolean)
  if (job.work_arrangement === 'remote') return places.length ? `Remote - ${places.join(' / ')}` : 'Remote'
  return places.length ? places.join('; ') : null
}

/** One listing as a board job; null for one that is not a four-day week or has no title, URL or company. */
export function mapFourDayWeekJob(job: FourDayWeekApiJob): BoardJobInput | null {
  if (!isReducedHoursFourDayWeek(job) || !job.title || !job.url || !job.company?.name) return null
  // Pay is given in minor units (cents); only yearly pay is passed on, the gate needs an annual figure.
  const yearly = (job.salary_period ?? 'year') === 'year'
  const amount = (v: number | null | undefined) => (yearly && typeof v === 'number' && v > 0 ? Math.round(v / 100) : null)
  return {
    externalId: job.id,
    title: job.title.trim(),
    url: job.url,
    applyUrl: job.url,
    rawCompanyName: job.company.name.trim(),
    companyWebsiteUrl: job.company.website ?? null,
    locationText: fourDayWeekLocationText(job),
    isRemote: job.work_arrangement === 'remote',
    salaryMin: amount(job.salary_min),
    salaryMax: amount(job.salary_max),
    salaryCurrency: job.salary_currency ?? null,
    salaryInterval: 'year',
    postedAt: job.posted_at ? new Date(job.posted_at) : null,
    descriptionHtml: markdownToHtml(job.description),
    sourceRef: job.url.split('/job/').pop() || null,
    skills: (job.skills ?? []).map((s) => s.slug).filter(Boolean),
  }
}

export async function scrapeFourDayWeek(opts: { dryRun?: boolean } = {}): Promise<ScraperStats> {
  console.log('[4DayWeek] Reading four-day-week listings from the public API...')
  try {
    const listings = await fetchFourDayWeekJobs()
    const inputs = listings.map(mapFourDayWeekJob).filter((j): j is BoardJobInput => j !== null)
    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }
    console.log(`[4DayWeek] ${listings.length} four-day-week listings, ${inputs.length} mappable`)
    if (opts.dryRun) {
      for (const j of inputs.slice(0, 5)) console.log(`    e.g. ${j.title} | ${j.rawCompanyName} | ${j.salaryMin ?? '-'} ${j.salaryCurrency ?? ''} | ${j.locationText ?? '-'}`)
      return { ...stats, skipped: inputs.length }
    }
    for (const input of inputs) addBoardIngestResult(stats, await ingestBoardJob(BOARD, input))
    console.log(`[4DayWeek] created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`)
    return stats
  } catch (error) {
    console.error('[4DayWeek] failed:', error)
    return errorStats(error)
  }
}
