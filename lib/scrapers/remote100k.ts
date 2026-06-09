// lib/scrapers/remote100k.ts
//
// Sitemap-driven Remote100k scraper. Replaces the previous Puppeteer-based
// version (668 lines, headless browser, 2 categories per run capped at the
// "Load More" button) with plain HTTP + JSON-LD parsing.
//
// Why this works:
//   1. https://remote100k.com/sitemap.xml is a flat urlset listing every job
//      URL — no need to interact with the "Load More" button.
//   2. Every /remote-job/[slug] page emits a complete schema.org JobPosting
//      JSON-LD with title, salary (min+max+currency), employer name,
//      employment type, datePosted, applicant location requirements, and
//      the canonical URL. No HTML parsing brittleness.
//   3. The external "Apply now" employer URL is in the page HTML (the
//      JSON-LD's `url` field points back to remote100k itself). We extract
//      it via a focused regex so users click straight through.
//
// Respects robots.txt: only hits public pages from the sitemap, never /api/.

import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'
import type { ScrapedJobInput, IngestStats } from '../ingest/types'
import type { ScraperStats } from './scraperStats'
import { fetchWithBackoff } from './utils/fetchWithBackoff'

const BOARD_NAME = 'remote100k'
const BASE_URL = 'https://remote100k.com'
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`

// Polite pacing — sitemap has ~1k URLs, we don't want to hammer the host.
const FETCH_CONCURRENCY = 4
const REQUEST_TIMEOUT_MS = 15_000

// Hard cap on detail-page fetches per run. Set high enough to catch every
// new job posted during a normal day, low enough to avoid burning the
// rate-limit budget when something goes wrong. Override via env if needed.
const MAX_DETAIL_FETCHES = Math.max(
  50,
  Number(process.env.REMOTE100K_MAX_DETAIL_FETCHES || '600'),
)

const USER_AGENT = 'SixFigureJobs/1.0 (+job-board-scraper)'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type RemoteJobPostingJsonLd = {
  '@context'?: string
  '@type'?: string
  title?: string
  description?: string
  identifier?: { '@type'?: string; name?: string; value?: string }
  datePosted?: string
  validThrough?: string
  employmentType?: string | string[]
  hiringOrganization?: { '@type'?: string; name?: string; sameAs?: string; logo?: string }
  jobLocationType?: string
  url?: string
  baseSalary?: {
    '@type'?: string
    currency?: string
    value?: {
      '@type'?: string
      minValue?: number
      maxValue?: number
      value?: number
      unitText?: string
    }
  }
  applicantLocationRequirements?:
    | { '@type'?: string; name?: string }
    | Array<{ '@type'?: string; name?: string }>
}

type JobDetailExtraction = {
  jsonLd: RemoteJobPostingJsonLd
  externalApplyUrl: string | null
  descriptionHtml: string | null
}

/* -------------------------------------------------------------------------- */
/* Sitemap discovery                                                          */
/* -------------------------------------------------------------------------- */

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

async function loadJobUrlsFromSitemap(): Promise<string[]> {
  const res = await fetchWithBackoff(SITEMAP_URL, {
    timeoutMs: REQUEST_TIMEOUT_MS,
    headers: { Accept: 'application/xml,text/xml,*/*', 'User-Agent': USER_AGENT },
    onRetry: (info) =>
      console.warn(
        `[${BOARD_NAME}] sitemap retry ${info.attempt}/${info.attempts} in ${info.delayMs}ms (${info.reason})`,
      ),
  })
  if (!res.ok) {
    throw new Error(`[${BOARD_NAME}] sitemap fetch failed: HTTP ${res.status}`)
  }
  const xml = await res.text()

  const urls = new Set<string>()
  const locRegex = /<loc>([^<]+)<\/loc>/g
  let match: RegExpExecArray | null
  while ((match = locRegex.exec(xml)) !== null) {
    const url = decodeEntities(match[1].trim())
    if (url.startsWith(`${BASE_URL}/remote-job/`)) {
      urls.add(url)
    }
  }
  return Array.from(urls)
}

/* -------------------------------------------------------------------------- */
/* Detail-page parsing                                                        */
/* -------------------------------------------------------------------------- */

const JSON_LD_REGEX =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

function findJobPostingJsonLd(html: string): RemoteJobPostingJsonLd | null {
  JSON_LD_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = JSON_LD_REGEX.exec(html)) !== null) {
    const body = match[1].trim()
    if (!body) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      continue
    }
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === 'object' && (item as any)['@type'] === 'JobPosting') {
          return item as RemoteJobPostingJsonLd
        }
      }
    } else if (parsed && typeof parsed === 'object' && (parsed as any)['@type'] === 'JobPosting') {
      return parsed as RemoteJobPostingJsonLd
    }
  }
  return null
}

// External apply URL is on the page but NOT in the JSON-LD — we want to
// link users directly to the employer ATS, not through the remote100k page.
// The site appends `?ref=remote100k` to the outbound link, which is a nice
// signal we can use to find it.
function findExternalApplyUrl(html: string): string | null {
  const refMatch = html.match(
    /href="(https?:\/\/[^"]+ref=remote100k[^"]*)"/i,
  )
  if (refMatch?.[1]) return decodeEntities(refMatch[1])

  // Fallback: look for known ATS hosts (greenhouse, lever, workday, ashby).
  const atsMatch = html.match(
    /href="(https?:\/\/(?:[a-z0-9.-]+\.)?(?:greenhouse\.io|lever\.co|ashbyhq\.com|workday(?:jobs)?\.com|smartrecruiters\.com|bamboohr\.com|recruitee\.com|workable\.com|breezy\.hr|teamtailor\.com|icims\.com|myworkdayjobs\.com)[^"]*)"/i,
  )
  if (atsMatch?.[1]) return decodeEntities(atsMatch[1])

  return null
}

// Snip a reasonable chunk of description HTML if available. The detail
// pages have a main content area we can try to capture conservatively.
function extractDescriptionHtml(html: string): string | null {
  // Look for the first <article> or a job-description container — fall back
  // to the meta description so we never store nothing.
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch?.[1]) {
    const trimmed = articleMatch[1].trim()
    if (trimmed.length > 200) return trimmed.slice(0, 20_000)
  }
  const metaDesc = html.match(/<meta name="description" content="([^"]+)"/i)
  if (metaDesc?.[1]) return `<p>${decodeEntities(metaDesc[1])}</p>`
  return null
}

async function fetchJobDetail(url: string): Promise<JobDetailExtraction | null> {
  const res = await fetchWithBackoff(url, {
    timeoutMs: REQUEST_TIMEOUT_MS,
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT },
    onRetry: (info) =>
      console.warn(
        `[${BOARD_NAME}] detail retry ${info.attempt}/${info.attempts} for ${info.url} in ${info.delayMs}ms (${info.reason})`,
      ),
  })
  if (!res.ok) {
    if (res.status === 404 || res.status === 410) return null
    throw new Error(`HTTP ${res.status}`)
  }
  const html = await res.text()
  const jsonLd = findJobPostingJsonLd(html)
  if (!jsonLd) return null

  return {
    jsonLd,
    externalApplyUrl: findExternalApplyUrl(html),
    descriptionHtml: extractDescriptionHtml(html),
  }
}

/* -------------------------------------------------------------------------- */
/* Mapping JobPosting -> ScrapedJobInput                                      */
/* -------------------------------------------------------------------------- */

function normalizeEmploymentType(input: string | string[] | undefined): string | null {
  if (!input) return null
  const value = Array.isArray(input) ? input[0] : input
  if (!value) return null
  // Schema.org uses FULL_TIME / PART_TIME / CONTRACTOR / TEMPORARY / INTERN.
  const map: Record<string, string> = {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    CONTRACTOR: 'Contract',
    TEMPORARY: 'Temporary',
    INTERN: 'Internship',
  }
  return map[String(value).toUpperCase().replace(/[\s-]+/g, '_')] ?? value
}

function asISODate(value: string | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function locationFromRequirements(
  req: RemoteJobPostingJsonLd['applicantLocationRequirements'],
): string | null {
  if (!req) return null
  if (Array.isArray(req)) {
    const names = req.map((r) => r.name).filter(Boolean) as string[]
    return names.length > 0 ? names.join(', ') : null
  }
  return req.name ?? null
}

function buildExternalId(url: string, jsonLd: RemoteJobPostingJsonLd): string {
  const slug = jsonLd.identifier?.value || url.split('/remote-job/').pop() || url
  return `remote100k:${slug}`
}

function jsonLdToScrapedJob(
  detailUrl: string,
  extraction: JobDetailExtraction,
): ScrapedJobInput | null {
  const { jsonLd, externalApplyUrl, descriptionHtml } = extraction
  const title = decodeEntities(jsonLd.title || '').trim()
  const company = decodeEntities(jsonLd.hiringOrganization?.name || '').trim()
  if (!title || !company) return null

  const salaryValue = jsonLd.baseSalary?.value
  const salaryMin =
    typeof salaryValue?.minValue === 'number'
      ? salaryValue.minValue
      : typeof salaryValue?.value === 'number'
        ? salaryValue.value
        : null
  const salaryMax =
    typeof salaryValue?.maxValue === 'number' ? salaryValue.maxValue : salaryMin

  const isRemote = (jsonLd.jobLocationType || '').toUpperCase() === 'TELECOMMUTE'
  const location = locationFromRequirements(jsonLd.applicantLocationRequirements)

  return {
    externalId: buildExternalId(detailUrl, jsonLd),
    title,
    source: makeBoardSource(BOARD_NAME),
    rawCompanyName: company,
    url: detailUrl,
    applyUrl: externalApplyUrl ?? detailUrl,
    locationText: location,
    isRemote,
    remoteRegion: location,
    salaryMin,
    salaryMax,
    salaryCurrency: jsonLd.baseSalary?.currency ?? null,
    salaryInterval:
      (salaryValue?.unitText || '').toUpperCase() === 'YEAR' ? 'YEAR' : null,
    salaryRaw:
      salaryMin != null || salaryMax != null
        ? `${salaryMin ?? ''}${salaryMax != null && salaryMax !== salaryMin ? ` - ${salaryMax}` : ''} ${jsonLd.baseSalary?.currency ?? ''}`.trim()
        : null,
    employmentType: normalizeEmploymentType(jsonLd.employmentType),
    descriptionHtml,
    postedAt: asISODate(jsonLd.datePosted),
    validThrough: asISODate(jsonLd.validThrough),
    raw: { jsonLd: jsonLd as unknown as Record<string, unknown> },
  }
}

/* -------------------------------------------------------------------------- */
/* Concurrency helper                                                         */
/* -------------------------------------------------------------------------- */

async function mapWithLimit<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

export default async function scrapeRemote100k(): Promise<ScraperStats> {
  console.log(`[${BOARD_NAME}] Starting sitemap-driven scrape...`)

  const stats: IngestStats = {
    created: 0,
    updated: 0,
    upgraded: 0,
    skipped: 0,
    errors: 0,
  }

  let allUrls: string[]
  try {
    allUrls = await loadJobUrlsFromSitemap()
  } catch (err) {
    console.error(`[${BOARD_NAME}] Sitemap fetch failed:`, err)
    return { created: 0, updated: 0, skipped: 1 }
  }
  console.log(`[${BOARD_NAME}] Sitemap returned ${allUrls.length} /remote-job URLs`)

  const urls = allUrls.slice(0, MAX_DETAIL_FETCHES)
  if (urls.length < allUrls.length) {
    console.log(
      `[${BOARD_NAME}] Capping at REMOTE100K_MAX_DETAIL_FETCHES=${MAX_DETAIL_FETCHES} (drop ${allUrls.length - urls.length})`,
    )
  }

  let processed = 0
  await mapWithLimit(
    urls,
    async (url) => {
      try {
        const extraction = await fetchJobDetail(url)
        if (!extraction) {
          stats.skipped += 1
          return
        }
        const job = jsonLdToScrapedJob(url, extraction)
        if (!job) {
          stats.skipped += 1
          return
        }
        const result = await ingestJob(job)
        if (result.status === 'error') {
          stats.errors += 1
        } else {
          stats[result.status] += 1
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[${BOARD_NAME}] error on ${url}: ${msg}`)
        stats.errors += 1
      } finally {
        processed += 1
        if (processed % 50 === 0) {
          console.log(
            `[${BOARD_NAME}] progress ${processed}/${urls.length}  created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} errors=${stats.errors}`,
          )
        }
      }
    },
    FETCH_CONCURRENCY,
  )

  console.log(
    `[${BOARD_NAME}] done — created=${stats.created} updated=${stats.updated} upgraded=${stats.upgraded} skipped=${stats.skipped} errors=${stats.errors}`,
  )

  return {
    created: stats.created,
    updated: stats.updated + stats.upgraded,
    skipped: stats.skipped + stats.errors,
  }
}
