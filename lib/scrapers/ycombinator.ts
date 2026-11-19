// lib/scrapers/ycombinator.ts
//
// Y Combinator's job board (ycombinator.com/jobs, the public face of Work at a Startup). robots.txt allows the job pages
// (it disallows only /companies?…, which the old scraper read and which now returns HTML). The board's sitemap
// (/jobs/sitemap) lists every open job page, about 7,000 across about 1,700 companies, each with a last-modified date.
//
// Most of those jobs were posted months or years ago, and the site shows a job only while its posting date is recent
// (MAX_DISPLAY_AGE_DAYS), so a run reads only companies with a job we do not hold that changed in the last 30 days
// (a job posted in that window cannot have an older last-modified date), newest first, up to a cap. One company jobs
// page (/companies/<slug>/jobs) carries all its postings with YC's pay range and a "created N days ago" age; only
// postings created within about 30 days whose pay can pass the gate get a job-page request, for the description and
// posting date (JobPosting JSON-LD). Pay comes from YC's range text, not the JSON-LD, whose currency says USD even
// for euro pay. The apply button needs a YC login, so the job's public YC page is saved as the apply link.
import * as cheerio from 'cheerio/slim'

import { ingestBoardJob } from '../jobs/ingestBoardJob'
import { getMinimumSalaryRejection } from '../jobs/salaryPublicationGate'
import { MAX_INGEST_AGE_DAYS } from '../ingest/jobAgeFilter'
import { parseSalaryFromText } from '../normalizers/salary'
import { prisma } from '../prisma'
import { addBoardIngestResult, emptyStats, errorStats, type ScraperStats } from './scraperStats'
import { makePoliteGetter, SourceBlocked, type Getter } from './utils/politeFetch'

export const YC_BOARD = 'ycombinator'
const BASE_URL = 'https://www.ycombinator.com'
const SITEMAP = `${BASE_URL}/jobs/sitemap`
// At most 160 requests at one a second plus 60 ingests: inside the 5-minute board budget of the pay-stating boards
// sync step (freehire-sync.yml), which runs about five times a day. Jobs are ingested as they are read, so a run cut
// short keeps what it found.
const MAX_COMPANY_PAGES = 100
const MAX_JOB_PAGES = 60
const GAP_MS = 1000

export type YcSitemapJob = { code: string; url: string; lastmod: string }

/** The short code YC puts first in a job's URL slug ("NHcBKbj" in /companies/whatnot/jobs/NHcBKbj-software-engineer). */
export function ycJobCode(url: string): string | null {
  return url.match(/\/companies\/[^/]+\/jobs\/([A-Za-z0-9]+)-/)?.[1] ?? null
}

/** Job pages from the sitemap, grouped by company slug. */
export function parseYcSitemap(xml: string): Map<string, YcSitemapJob[]> {
  const byCompany = new Map<string, YcSitemapJob[]>()
  const re = /<loc>(https:\/\/www\.ycombinator\.com\/companies\/([^/<]+)\/jobs\/([A-Za-z0-9]+)-[^<]*)<\/loc>\s*(?:<lastmod>([^<]*)<\/lastmod>)?/g
  for (const m of xml.matchAll(re)) {
    const list = byCompany.get(m[2]) ?? []
    list.push({ code: m[3], url: m[1], lastmod: (m[4] ?? '').trim() })
    byCompany.set(m[2], list)
  }
  return byCompany
}

/** The page's data, which YC renders into the root element's data-page attribute (Inertia.js). */
function pageProps(html: string): any | null {
  const raw = cheerio.load(html)('[data-page]').first().attr('data-page')
  if (!raw) return null
  try {
    return JSON.parse(raw)?.props ?? null
  } catch {
    return null
  }
}

/** True when YC's yearly pay range could pass our salary gate ("$200K - $275K", "€99K - €145K EUR"). */
export function ycPayPasses(salaryRange: unknown): boolean {
  const parsed = parseSalaryFromText(typeof salaryRange === 'string' ? salaryRange : null)
  if (!parsed || parsed.interval !== 'year') return false
  // "$" alone is read as USD for this check only; ingest settles the currency from the location.
  return !getMinimumSalaryRejection({ salaryMin: parsed.min, salaryMax: parsed.max, salaryCurrency: parsed.currency ?? 'USD' })
}

/** YC's relative age ("5 days", "about 2 hours", "3 months", "over 1 year"): false once it reads in months or years (30+ days). */
export function ycCreatedRecently(createdAt: unknown): boolean {
  return !/\b(month|year)s?\b/i.test(String(createdAt ?? ''))
}

export type YcPosting = { id: number; code: string; url: string; title: string; location: string | null; type: string | null; salaryRange: string }
export type YcCompany = { name: string; website: string | null; linkedinUrl: string | null }

/** A company's jobs page: the company and its recent postings whose pay can pass the gate. */
export function parseYcCompanyJobs(html: string): { company: YcCompany; postings: YcPosting[] } | null {
  const props = pageProps(html)
  const name = String(props?.company?.name ?? '').trim()
  if (!name || !Array.isArray(props?.jobPostings)) return null
  const postings: YcPosting[] = []
  for (const p of props.jobPostings) {
    const url = typeof p?.url === 'string' ? new URL(p.url, BASE_URL).toString() : ''
    const code = ycJobCode(url)
    const title = String(p?.title ?? '').trim()
    if (!code || !title || !Number.isInteger(p?.id) || !ycCreatedRecently(p.createdAt) || !ycPayPasses(p.salaryRange)) continue
    postings.push({ id: p.id, code, url, title, location: p.location?.trim() || null, type: p.type?.trim() || null, salaryRange: p.salaryRange.trim() })
  }
  return {
    company: { name, website: props.company.website?.trim() || null, linkedinUrl: props.company.linkedin_url?.trim() || null },
    postings,
  }
}

/** A job page: the description (HTML) and posting date from its JobPosting JSON-LD. */
export function parseYcJobPage(html: string): { descriptionHtml: string; postedAt: Date | null } | null {
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
  const descriptionHtml = typeof ld?.description === 'string' ? ld.description.trim() : ''
  if (!descriptionHtml) return null
  const posted = ld.datePosted ? new Date(String(ld.datePosted)) : null
  return { descriptionHtml, postedAt: posted && Number.isFinite(posted.getTime()) ? posted : null }
}

export type YcJob = YcPosting & YcCompany & { descriptionHtml: string; postedAt: Date | null }

/**
 * Reads the board and hands each new job that can pass the gates to `onJob` as soon as it is read, so a run cut short
 * by the board time budget keeps what it found. `known` holds the codes of jobs we already store. Returns the codes of
 * every job the sitemap lists (all open jobs), whether read or not.
 */
export async function collectYcJobs(opts: {
  get: Getter
  onJob: (job: YcJob) => Promise<void>
  known?: ReadonlySet<string>
  now?: Date
  maxCompanyPages?: number
  maxJobPages?: number
}) {
  const known = opts.known ?? new Set<string>()
  const cutoff = new Date((opts.now ?? new Date()).getTime() - MAX_INGEST_AGE_DAYS * 86_400_000).toISOString().slice(0, 10)
  const live = new Set<string>()
  let companyPages = 0
  let jobPages = 0
  let found = 0
  let blocked: string | null = null
  try {
    const sitemap = await opts.get(SITEMAP)
    const byCompany = sitemap ? parseYcSitemap(sitemap) : new Map<string, YcSitemapJob[]>()
    const pending: Array<{ slug: string; lastmod: string }> = []
    for (const [slug, list] of byCompany) {
      for (const j of list) live.add(j.code)
      const fresh = list.filter((j) => !known.has(j.code) && j.lastmod >= cutoff)
      if (fresh.length) pending.push({ slug, lastmod: fresh.reduce((max, j) => (j.lastmod > max ? j.lastmod : max), '') })
    }
    pending.sort((a, b) => b.lastmod.localeCompare(a.lastmod))
    for (const { slug } of pending) {
      if (companyPages >= (opts.maxCompanyPages ?? MAX_COMPANY_PAGES) || jobPages >= (opts.maxJobPages ?? MAX_JOB_PAGES)) break
      companyPages++
      const page = await opts.get(`${BASE_URL}/companies/${slug}/jobs`)
      const parsed = page ? parseYcCompanyJobs(page) : null
      for (const posting of parsed?.postings ?? []) {
        if (known.has(posting.code) || !live.has(posting.code)) continue
        if (jobPages >= (opts.maxJobPages ?? MAX_JOB_PAGES)) break
        jobPages++
        const jobPage = await opts.get(posting.url)
        const detail = jobPage ? parseYcJobPage(jobPage) : null
        if (!detail) continue
        found++
        await opts.onJob({ ...posting, ...parsed!.company, ...detail })
      }
    }
  } catch (err) {
    if (!(err instanceof SourceBlocked)) throw err
    blocked = err.message
  }
  return { live, companyPages, jobPages, found, blocked }
}

export default async function scrapeYCombinator(): Promise<ScraperStats> {
  console.log('[YCombinator] Starting scrape...')
  const stats = emptyStats()
  try {
    const stored = await prisma.job.findMany({ where: { source: `board:${YC_BOARD}`, isExpired: false }, select: { id: true, url: true } })
    const storedByCode = new Map<string, string>()
    for (const job of stored) {
      const code = job.url ? ycJobCode(job.url) : null
      if (code) storedByCode.set(code, job.id)
    }
    const { live, companyPages, jobPages, found, blocked } = await collectYcJobs({
      get: makePoliteGetter({ gapMs: GAP_MS }),
      known: new Set(storedByCode.keys()),
      onJob: async (job) => {
        const result = await ingestBoardJob(YC_BOARD, {
          externalId: `yc-${job.id}`,
          title: job.title,
          url: job.url,
          applyUrl: job.url,
          rawCompanyName: job.name,
          companyWebsiteUrl: job.website,
          companyLinkedInUrl: job.linkedinUrl,
          locationText: job.location,
          isRemote: job.location && /\bremote\b/i.test(job.location) ? true : null,
          employmentType: job.type,
          postedAt: job.postedAt,
          descriptionHtml: job.descriptionHtml,
          raw: { sourceBoard: YC_BOARD, salaryText: job.salaryRange },
        })
        addBoardIngestResult(stats, result)
      },
    })

    // Jobs we hold that the sitemap still lists are still open: keep them from the 7-day expiry (lib/jobs/expiry.ts).
    // An unreadable sitemap (live is empty) refreshes nothing, so those jobs expire as usual if it stays unreadable.
    const stillOpen = [...storedByCode].filter(([code]) => live.has(code)).map(([, id]) => id)
    if (stillOpen.length && process.env.SCRAPE_DRY_RUN !== '1' && process.env.DRY_RUN !== '1') {
      const now = new Date()
      await prisma.job.updateMany({ where: { id: { in: stillOpen } }, data: { lastSeenAt: now, updatedAt: now } })
    }

    console.log(
      `[YCombinator] ✓ ${live.size} open jobs listed, ${companyPages} company pages, ${jobPages} job pages, ${found} new with pay, ${stats.created} created, ${stillOpen.length} held jobs still open${blocked ? `; STOPPED: ${blocked}` : ''}`,
    )
    if (blocked) stats.error = `Y Combinator stopped the run: ${blocked}`
    return stats
  } catch (error) {
    console.error('[YCombinator] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
