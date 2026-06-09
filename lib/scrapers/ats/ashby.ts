// lib/scrapers/ats/ashby.ts

import type { ATSResult, AtsJob } from './types'
import * as cheerio from 'cheerio'
import { fetchWithBackoff, fetchJsonWithBackoff } from '../utils/fetchWithBackoff'

/**
 * Ashby no longer exposes careers.json for most companies.
 * The ONLY stable source is the HTML job listings on:
 *
 *   https://jobs.ashbyhq.com/<company>
 *
 * Jobs are embedded in HTML:
 *   - <a data-job-id="xxxx" href="/company/job/xxxxx">...</a>
 *   - Embedded script[type="application/ld+json"]
 */

const USER_AGENT = 'SixFigureJobs/1.0 (+job-board-scraper)'
const TIMEOUT_MS = 15000

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractCompanySlug(atsUrl: string): string | null {
  try {
    const u = new URL(atsUrl)
    const parts = u.pathname.split('/').filter(Boolean)
    return parts[0] ?? null
  } catch {
    return null
  }
}

function normalizeTextValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number') return String(value)
  return null
}

function collectSalaryRawFromPayload(payload: any): string | null {
  const values = [
    payload?.compensation,
    payload?.compensationText,
    payload?.compensationTierSummary,
    payload?.compensationRange,
    payload?.salary,
    payload?.salaryText,
    payload?.salaryRange,
    payload?.pay,
    payload?.payRange,
  ]
    .map(normalizeTextValue)
    .filter((value): value is string => Boolean(value))

  return values.length ? Array.from(new Set(values)).join(' | ') : null
}

// Ashby-tagged wrappers around the shared scraper fetch helper. Previously
// these were blind linear-backoff loops that ignored Retry-After on 429/503.
async function fetchTextWithRetry(
  url: string,
  attempts = 4,
  timeoutMs = TIMEOUT_MS,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const res = await fetchWithBackoff(url, {
    attempts,
    timeoutMs,
    headers: { 'User-Agent': USER_AGENT, ...extraHeaders },
    onRetry: (info) =>
      console.warn(
        `[Ashby] retry ${info.attempt}/${info.attempts} for ${info.url} in ${info.delayMs}ms (${info.reason})`,
      ),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res.text()
}

async function fetchJsonWithRetry<T>(
  url: string,
  attempts = 4,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  return fetchJsonWithBackoff<T>(url, {
    attempts,
    timeoutMs,
    headers: { 'User-Agent': USER_AGENT },
    onRetry: (info) =>
      console.warn(
        `[Ashby] retry ${info.attempt}/${info.attempts} for ${info.url} in ${info.delayMs}ms (${info.reason})`,
      ),
  })
}

function extractApiJobArray(json: any): any[] | null {
  if (!json) return null
  if (Array.isArray(json)) return json
  if (Array.isArray(json.jobs)) return json.jobs
  if (Array.isArray(json.jobPostings)) return json.jobPostings
  if (Array.isArray(json.jobBoard?.jobPostings)) return json.jobBoard.jobPostings
  if (json.data && Array.isArray(json.data.jobs)) return json.data.jobs
  return null
}

function extractJsonObjectAfterMarker(text: string, marker: string): any | null {
  const markerIndex = text.indexOf(marker)
  if (markerIndex < 0) return null

  const start = text.indexOf('{', markerIndex + marker.length)
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }

  return null
}

function collectEmbeddedAshbyPostings(appData: any): any[] | null {
  const direct = extractApiJobArray(appData)
  if (direct) return direct

  const board = appData?.jobBoard
  if (!board) return null

  const postings: any[] = []
  if (Array.isArray(board.jobPostings)) postings.push(...board.jobPostings)

  if (Array.isArray(board.teams)) {
    for (const team of board.teams) {
      if (Array.isArray(team?.jobPostings)) postings.push(...team.jobPostings)
      if (Array.isArray(team?.jobs)) postings.push(...team.jobs)
    }
  }

  return postings
}

function processApiJobs(
  jsonJobs: any[],
  meta: { apiUrl: string; htmlUrl: string },
): AtsJob[] {
  const jobs: AtsJob[] = []

  for (const p of jsonJobs) {
    const externalId = String(
      p?.id ?? p?.jobId ?? p?.externalId ?? p?.slug ?? p?.jobUrl ?? '',
    )
    if (!externalId) continue

    const title = p?.title ?? p?.name ?? 'Untitled'
    const url: string =
      p?.jobUrl ?? p?.url ?? p?.hostedUrl ?? p?.applyUrl ?? meta.htmlUrl

    const locationText: string | null =
      p?.location ?? p?.locationName ?? p?.locationText ?? null

    const isRemoteVal = p?.isRemote
    const remoteHint =
      typeof isRemoteVal === 'boolean'
        ? isRemoteVal
        : locationText?.toLowerCase().includes('remote') ?? false

    const descriptionHtml: string | null =
      p?.descriptionHtml ?? p?.description ?? null

    const descriptionText: string | null =
      p?.descriptionPlain ??
      (descriptionHtml ? stripHtml(descriptionHtml) : null)

    const postedAt =
      p?.publishedAt || p?.datePosted
        ? new Date(p.publishedAt || p.datePosted)
        : null
    const updatedAt =
      p?.updatedAt || p?.dateModified
        ? new Date(p.updatedAt || p.dateModified)
        : postedAt

    const salaryRaw = collectSalaryRawFromPayload(p)

    jobs.push({
      externalId,
      title,
      url,
      locationText,
      remote: remoteHint ? true : null,

      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryInterval: null,
      salaryRaw,

      employmentType: p?.employmentType ?? null,
      descriptionHtml,

      roleSlug: null,
      baseRoleSlug: null,
      seniority: null,
      discipline: null,
      isManager: false,

      postedAt,
      updatedAt,
      raw: {
        ...p,
        _source: 'api',
        _apiUrl: meta.apiUrl,
        _descriptionLength: (descriptionHtml || '').length,
        _sixFigureJobs: {
          descriptionText,
          salaryRaw,
        },
      },
    })
  }

  return jobs
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let idx = 0

  const workers = new Array(Math.max(1, Math.min(limit, items.length)))
    .fill(0)
    .map(async () => {
      while (idx < items.length) {
        const i = idx++
        out[i] = await fn(items[i], i)
      }
    })

  await Promise.all(workers)
  return out
}

export async function scrapeAshby(atsUrl: string): Promise<AtsJob[]> {
  const clean = atsUrl.replace(/\/$/, '')
  const htmlUrl = clean

  const companySlug = extractCompanySlug(htmlUrl)

  // Try potential API endpoints before HTML parsing
  const apiUrls = [
    `${htmlUrl}/api/jobs`,
    `${htmlUrl}?format=json`,
    htmlUrl.replace('jobs.ashbyhq.com', 'api.ashbyhq.com') + '/postings',
  ]

  if (companySlug) {
    const slugCandidates = new Set<string>([
      companySlug,
      companySlug.toLowerCase(),
    ])

    for (const slug of slugCandidates) {
      apiUrls.unshift(`https://api.ashbyhq.com/posting-api/job-board/${slug}`)
    }
  }

  for (const apiUrl of apiUrls) {
    try {
      const json = await fetchJsonWithRetry<any>(apiUrl, 3, TIMEOUT_MS)
      const jsonJobs = extractApiJobArray(json)
      if (jsonJobs && jsonJobs.length > 0) {
        console.log(`[Ashby] ✓ Found API: ${apiUrl} with ${jsonJobs.length} jobs`)
        return processApiJobs(jsonJobs, { apiUrl, htmlUrl })
      }
    } catch {
      continue
    }
  }

  // HTML fallback (debug-heavy)
  const htmlCandidates = [htmlUrl, `${htmlUrl}/jobs`]
  console.log(`[Ashby] Fetching ${htmlUrl}`)
  let html = ''
  try {
    for (const candidate of htmlCandidates) {
      try {
        const candidateHtml = await fetchTextWithRetry(candidate, 3, TIMEOUT_MS, {
          Accept: 'text/html,application/xhtml+xml',
        })
        if (candidateHtml && candidateHtml.length > html.length) {
          html = candidateHtml
        }
      } catch {
        // ignore and try next candidate
      }
    }
    if (!html) {
      throw new Error('Empty HTML response')
    }
    console.log(`[Ashby] HTML length: ${html.length} chars`)
  } catch (err: any) {
    console.warn(`[Ashby] Network error fetching ${htmlUrl}: ${err?.message || err}`)
    throw new Error(`[Ashby] Network error fetching ${htmlUrl}: ${err?.message || err}`)
  }

  const $ = cheerio.load(html)
  const jobs: AtsJob[] = []

  console.log(`[Ashby] Found ${$('script[type="application/ld+json"]').length} LD+JSON scripts`)
  console.log(`[Ashby] Found ${$('a[data-job-id]').length} job cards with data-job-id`)
  console.log(`[Ashby] Found ${$('a[href*="/job/"]').length} job links with /job/`)
  console.log(`[Ashby] Found ${$('a[href*="/jobs/"]').length} job links with /jobs/`)
  console.log(`[Ashby] Found ${$('[class*="JobPosting"]').length} JobPosting components`)

  const appData = extractJsonObjectAfterMarker(html, 'window.__appData')
  const embeddedPostings = collectEmbeddedAshbyPostings(appData)
  if (embeddedPostings && embeddedPostings.length > 0) {
    console.log(`[Ashby] Extracted ${embeddedPostings.length} jobs via embedded app data (${atsUrl})`)
    return processApiJobs(embeddedPostings, {
      apiUrl: `${htmlUrl}#__appData`,
      htmlUrl,
    })
  }

  if (appData?.jobBoard && embeddedPostings && embeddedPostings.length === 0) {
    console.log(`[Ashby] No open positions in embedded app data for ${atsUrl}`)
    return []
  }

  // Check for "Load More" or pagination
  const hasLoadMore =
    $('button:contains("Load more"), button:contains("Show more")').length > 0
  const hasPagination =
    $('[class*="pagination"], [aria-label*="pagination"]').length > 0
  if (hasLoadMore || hasPagination) {
    console.warn(`[Ashby] ⚠️ Page has pagination but we're not handling it`)
    console.warn(`[Ashby] Consider using Puppeteer to click "Load More"`)
  }

  // 1) Try structured data first (Ashby embeds LD+JSON)
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')

      if (Array.isArray(json) || json['@type'] === 'JobPosting') {
        const items = Array.isArray(json) ? json : [json]

        for (const p of items) {
          if (p['@type'] !== 'JobPosting') continue

          const externalId =
            p.identifier?.value ||
            p.identifier ||
            p.url?.split('/').pop() ||
            null

          const salary = p.baseSalary || {}
          let salaryMin = salary.minValue ?? salary.value?.minValue ?? null
          let salaryMax = salary.maxValue ?? salary.value?.maxValue ?? null
          const salaryCurrency = salary.currency || salary.value?.currency || null
          const salaryInterval = salary.unitText || salary.value?.unitText || null

          // ═══════════════════════════════════════════════════════════════
          // CRITICAL FIX: Ashby ALWAYS provides salary in CENTS
          // ALWAYS divide by 100 to convert cents to dollars
          // ═══════════════════════════════════════════════════════════════
          if (salaryMin != null) {
            salaryMin = Math.round(salaryMin / 100)
          }
          if (salaryMax != null) {
            salaryMax = Math.round(salaryMax / 100)
          }

          const postedAt = p.datePosted ? new Date(p.datePosted) : null
          const updatedAt = p.dateModified ? new Date(p.dateModified) : postedAt

          const descriptionHtml = p.description || null
          const descriptionText = descriptionHtml ? stripHtml(descriptionHtml) : null

          jobs.push({
            externalId: String(externalId || ''),
            title: p.title ?? 'Untitled',
            url: p.url ?? htmlUrl,
            locationText: p.jobLocation?.address?.addressLocality ?? p.jobLocation?.name ?? null,
            remote:
              p.jobLocation?.name?.toLowerCase().includes('remote') ||
              p.jobLocation?.address?.addressLocality?.toLowerCase().includes('remote')
                ? true
                : null,

            salaryMin: salaryMin != null ? Number(salaryMin) : null,
            salaryMax: salaryMax != null ? Number(salaryMax) : null,
            salaryCurrency,
            salaryInterval,

            employmentType: p.employmentType ?? null,
            descriptionHtml,

            roleSlug: null,
            baseRoleSlug: null,
            seniority: null,
            discipline: null,
            isManager: false,

            postedAt,
            updatedAt,
            raw: {
              ...p,
              _source: 'ld+json',
              _descriptionLength: (descriptionHtml || '').length,
              _sixFigureJobs: {
                descriptionText,
              },
            },
          })
        }
      }
    } catch {
      // ignore bad JSON
    }
  })

  if (jobs.length > 0) {
    console.log(`[Ashby] Extracted ${jobs.length} jobs via LD+JSON (${atsUrl})`)
    return jobs
  }

  // 2) Fallback to HTML job cards / links (try multiple selectors)
  const selectors = [
    'a[data-job-id]',
    'a[href*="/job/"]',
    'a[href*="/jobs/"]',
    '[class*="JobPosting"]',
    '[data-testid*="job"]',
    'div[class*="job-card"]',
    '.ashby-job-posting',
  ]

  let matches: cheerio.Cheerio<any> | null = null
  for (const selector of selectors) {
    const m = $(selector)
    if (m.length > 0) {
      console.log(`[Ashby] ✓ Found ${m.length} jobs using: ${selector}`)
      matches = m
      break
    }
  }

  if (!matches || matches.length === 0) {
    const noJobs =
      /\bno\s+open\s+positions\b/i.test(html) ||
      /\bno\s+job\s+openings\b/i.test(html) ||
      /\bno\s+openings\b/i.test(html) ||
      /\bno\s+positions\b/i.test(html)

    if (noJobs) {
      console.log(`[Ashby] No open positions for ${atsUrl}`)
      return []
    }

    console.warn(`[Ashby] ⚠️ No jobs detected for ${atsUrl} (possible scraper breakage)`)
    throw new Error(`[Ashby] No job postings detected (possible markup change): ${atsUrl}`)
  }

  // Extract job URLs from matches, then fetch each job page for full description.
  const jobLinks: Array<{
    url: string
    externalId: string
    title: string
    locationText: string | null
    compText: string | null
  }> = []

  const seen = new Set<string>()
  matches.each((_i: number, el: any) => {
    const elem = $(el)
    const anchor = elem.is('a') ? elem : elem.find('a').first()
    const href = anchor.attr('href') || elem.attr('href')
    if (!href) return

    const jobUrl = href.startsWith('http')
      ? href
      : `${clean}${href.startsWith('/') ? '' : '/'}${href}`

    if (seen.has(jobUrl)) return
    seen.add(jobUrl)

    const jobId =
      elem.attr('data-job-id') ||
      anchor.attr('data-job-id') ||
      jobUrl.split('/').filter(Boolean).pop() ||
      jobUrl

    const title =
      elem.find('[data-job-title]').text().trim() ||
      anchor.find('[data-job-title]').text().trim() ||
      elem.find('h1,h2,h3').first().text().trim() ||
      anchor.text().trim() ||
      elem.text().trim()

    if (!title) return

    const locationText =
      elem.find('[data-job-location]').text().trim() ||
      elem.find('[data-testid*="location"],[data-qa="job-location"],[class*="location"]')
        .first()
        .text()
        .trim() ||
      null

    const compText =
      elem.find('[data-job-compensation]').text().trim() ||
      elem.find('[class*="compensation"],[class*="salary"]').first().text().trim() ||
      null

    jobLinks.push({ url: jobUrl, externalId: String(jobId), title, locationText, compText })
  })

  // Fetch detail pages for descriptions (best-effort).
  const detailed = await mapLimit(jobLinks, 6, async (j) => {
    try {
      const jobHtml = await fetchTextWithRetry(j.url, 3, TIMEOUT_MS, {
        Accept: 'text/html,application/xhtml+xml',
      })
      const $$ = cheerio.load(jobHtml)

      // Prefer LD+JSON JobPosting on the job page
      let descriptionHtml: string | null = null
      let salaryMin: number | null = null
      let salaryMax: number | null = null
      let salaryCurrency: string | null = null
      let salaryInterval: string | null = null
      let employmentType: string | null = null
      let postedAt: Date | null = null
      let updatedAt: Date | null = null

      $$('script[type="application/ld+json"]').each((_k, el2) => {
        if (descriptionHtml) return
        try {
          const json = JSON.parse($$(el2).html() || '{}')
          const items = Array.isArray(json) ? json : [json]
          const posting = items.find((x) => x && x['@type'] === 'JobPosting')
          if (!posting) return

          descriptionHtml = posting.description || null
          employmentType = posting.employmentType ?? null
          postedAt = posting.datePosted ? new Date(posting.datePosted) : null
          updatedAt = posting.dateModified ? new Date(posting.dateModified) : postedAt

          const salary = posting.baseSalary || {}
          let sMin = salary.minValue ?? salary.value?.minValue ?? null
          let sMax = salary.maxValue ?? salary.value?.maxValue ?? null
          salaryCurrency = salary.currency || salary.value?.currency || null
          salaryInterval = salary.unitText || salary.value?.unitText || null

          if (sMin != null) sMin = Math.round(sMin / 100)
          if (sMax != null) sMax = Math.round(sMax / 100)
          salaryMin = sMin != null ? Number(sMin) : null
          salaryMax = sMax != null ? Number(sMax) : null
        } catch {
          // ignore bad JSON
        }
      })

      // HTML fallback for description containers
      if (!descriptionHtml) {
        const desc =
          $$('.job-description, [class*="job-description"], [class*="description"], [class*="Description"]')
            .first()
        descriptionHtml = desc.html() || null
      }

      const descriptionText =
        descriptionHtml ? stripHtml(descriptionHtml) : (jobHtml ? stripHtml(jobHtml).slice(0, 3000) : null)

      const locLower = (j.locationText || '').toLowerCase()
      const remote =
        locLower.includes('remote') || locLower.includes('anywhere') ? true : null

      return {
        externalId: j.externalId,
        title: j.title,
        url: j.url,
        locationText: j.locationText,
        remote,

        salaryMin,
        salaryMax,
        salaryCurrency,
        salaryInterval,
        salaryRaw: j.compText,

        employmentType,
        descriptionHtml,

        roleSlug: null,
        baseRoleSlug: null,
        seniority: null,
        discipline: null,
        isManager: false,

        postedAt,
        updatedAt,
        raw: {
          title: j.title,
          locationText: j.locationText,
          compText: j.compText,
          salaryRaw: j.compText,
          descriptionHtml,
          _source: 'html',
          _sixFigureJobs: {
            descriptionText,
            salaryRaw: j.compText,
          },
        },
      } satisfies AtsJob
    } catch {
      const locLower = (j.locationText || '').toLowerCase()
      const remote =
        locLower.includes('remote') || locLower.includes('anywhere') ? true : null

      return {
        externalId: j.externalId,
        title: j.title,
        url: j.url,
        locationText: j.locationText,
        remote,

        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryInterval: null,
        salaryRaw: j.compText,

        employmentType: null,
        descriptionHtml: null,

        roleSlug: null,
        baseRoleSlug: null,
        seniority: null,
        discipline: null,
        isManager: false,

        postedAt: null,
        updatedAt: null,
        raw: {
          title: j.title,
          locationText: j.locationText,
          compText: j.compText,
          salaryRaw: j.compText,
          _source: 'html',
        },
      } satisfies AtsJob
    }
  })

  const outJobs = detailed.filter(Boolean) as AtsJob[]
  console.log(`[Ashby] Extracted ${outJobs.length} jobs from HTML (${atsUrl})`)

  if (outJobs.length === 0) {
    const noJobs =
      /\bno\s+open\s+positions\b/i.test(html) ||
      /\bno\s+job\s+openings\b/i.test(html) ||
      /\bno\s+openings\b/i.test(html) ||
      /\bno\s+positions\b/i.test(html)

    if (!noJobs) {
      throw new Error(`[Ashby] Extracted 0 jobs (possible markup change): ${atsUrl}`)
    }
  }

  return outJobs
}

export async function scrapeAshbyResult(atsUrl: string): Promise<ATSResult> {
  const clean = atsUrl.replace(/\/$/, '')
  const companySlug = extractCompanySlug(clean)

  try {
    const jobs = await scrapeAshby(atsUrl)
    return {
      success: true,
      source: 'ashby',
      company: companySlug ?? undefined,
      atsUrl,
      jobs,
    }
  } catch (err: any) {
    return {
      success: false,
      source: 'ashby',
      company: companySlug ?? undefined,
      atsUrl,
      error: err?.message || String(err),
    }
  }
}
