// lib/scrapers/ats/lever.ts

import type { AtsJob } from './types'

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

function extractSlug(atsUrl: string): string | null {
  let url: URL
  try {
    url = new URL(atsUrl)
  } catch {
    return null
  }

  const parts = url.pathname.split('/').filter(Boolean)
  return parts[0] ?? null
}

function normalizeToString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    const s = typeof v === 'string' ? v.trim() : ''
    if (!s) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function collectSalaryMentions(item: any): string[] {
  const mentions: Array<string | null> = []

  // Common Lever field: categories.compensation
  mentions.push(normalizeToString(item?.categories?.compensation))

  // Lists section; often includes a "Compensation" block
  const lists: any[] = Array.isArray(item?.lists) ? item.lists : []
  for (const l of lists) {
    const label = normalizeToString(l?.text)
    const content = normalizeToString(l?.content)
    if (label && /compensation|salary|pay|range/i.test(label)) {
      mentions.push(content)
    }
  }

  // Additional fields (custom fields in Lever UI)
  const additional: any[] = Array.isArray(item?.additionalFields) ? item.additionalFields : []
  for (const f of additional) {
    const key =
      normalizeToString(f?.name) ||
      normalizeToString(f?.title) ||
      normalizeToString(f?.text) ||
      normalizeToString(f?.label)

    if (!key || !/compensation|salary|pay|range|ote/i.test(key)) continue

    const v = f?.value
    if (typeof v === 'string') {
      mentions.push(v)
    } else if (Array.isArray(v)) {
      for (const entry of v) {
        mentions.push(normalizeToString(entry))
      }
    } else {
      mentions.push(normalizeToString(v))
    }
  }

  return dedupeStrings(mentions)
}

function detectCurrencyFromText(text: string): string | null {
  const t = (text || '').toUpperCase()
  if (t.includes('EUR') || text.includes('€')) return 'EUR'
  if (t.includes('GBP') || text.includes('£')) return 'GBP'
  if (t.includes('CAD') || t.includes('CA$')) return 'CAD'
  if (t.includes('AUD') || t.includes('A$')) return 'AUD'
  if (t.includes('USD')) return 'USD'
  if (text.includes('$')) return 'USD'
  return null
}

function parseSalaryRangeFromText(text: string): {
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  salaryInterval: string | null
} {
  const currency = detectCurrencyFromText(text)

  const lower = (text || '').toLowerCase()
  const interval =
    /\/\s*hour|per\s*hour|\bhr\b/.test(lower) ? 'hour' :
    /\/\s*month|per\s*month/.test(lower) ? 'month' :
    /\/\s*week|per\s*week/.test(lower) ? 'week' :
    /\/\s*day|per\s*day/.test(lower) ? 'day' :
    'year'

  const numbers: number[] = []

  // 120k / 120 K / 120.5k
  const kRe = /(\d+(?:\.\d+)?)\s*k\b/gi
  for (const m of text.matchAll(kRe)) {
    const n = Number(m[1])
    if (Number.isFinite(n)) numbers.push(Math.round(n * 1000))
  }

  // 120,000 / 120000
  const numRe = /\b(\d{1,3}(?:,\d{3})+|\d{5,})\b/g
  for (const m of text.matchAll(numRe)) {
    const raw = m[1].replace(/,/g, '')
    const n = Number(raw)
    if (Number.isFinite(n)) numbers.push(n)
  }

  const uniq = Array.from(new Set(numbers)).filter((n) => n >= 1000).sort((a, b) => a - b)
  const salaryMin = uniq.length >= 1 ? uniq[0] : null
  const salaryMax = uniq.length >= 2 ? uniq[1] : null

  return {
    salaryMin,
    salaryMax,
    salaryCurrency: currency,
    salaryInterval: salaryMin || salaryMax ? interval : null,
  }
}

/**
 * Minimal fetch-with-retries helper for Lever JSON endpoint.
 * Uses AbortController to enforce a per-request timeout.
 */
async function fetchLeverWithRetry<T>(
  url: string,
  attempts = 3,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  let lastError: any = null

  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), timeoutMs)

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        cache: 'no-store',
        signal: controller.signal,
      })

      clearTimeout(id)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        console.error(`[Lever] Non-JSON response (${contentType || 'unknown'}) for ${url}`)
        throw new Error('Lever returned HTML instead of JSON (likely rate limited or blocked)')
      }

      return (await res.json()) as T
    } catch (err: any) {
      lastError = err
      const msg = err?.message || String(err)
      console.warn(`[Lever] fetch attempt ${i + 1} failed for ${url}: ${msg}`)

      if (i < attempts - 1) {
        // exponential-ish backoff: 500ms, 1000ms, 1500ms
        await new Promise((r) => setTimeout(r, 500 * (i + 1)))
      }
    }
  }

  throw lastError
}

/**
 * atsUrl example:
 *   https://jobs.lever.co/figma
 *   https://jobs.lever.co/openai
 */
export async function scrapeLever(atsUrl: string): Promise<AtsJob[]> {
  const companySlug = extractSlug(atsUrl)

  if (!companySlug) {
    console.warn(`[Lever] Could not extract company slug from atsUrl=${atsUrl}`)
    return []
  }

  const limit = 100
  const maxJobs = 500

  const allJobs: any[] = []
  const seenExternalIds = new Set<string>()

  let offset = 0
  while (offset < maxJobs) {
    const page = Math.floor(offset / limit) + 1
    const apiUrl = `https://jobs.lever.co/${companySlug}?mode=json&skip=${offset}&limit=${limit}`

    let data: any
    try {
      data = await fetchLeverWithRetry<any>(apiUrl, 3, TIMEOUT_MS)
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.error(`[Lever] Error fetching jobs for slug=${companySlug} (page=${page}): ${msg}`)
      break
    }

    const pageJobs = Array.isArray(data) ? data : []
    console.log(`[Lever] Company: ${companySlug}, Page: ${page}, Jobs: ${pageJobs.length}`)

    if (!Array.isArray(data) || data.length === 0) break

    let addedThisPage = 0
    for (const item of pageJobs) {
      const id = String(item?.id ?? item?.slug ?? item?.text ?? '')
      if (!id) continue
      if (seenExternalIds.has(id)) continue
      seenExternalIds.add(id)
      allJobs.push(item)
      addedThisPage++
      if (allJobs.length >= maxJobs) break
    }

    // If Lever ignores pagination and returns the same set, stop to avoid loops.
    if (addedThisPage === 0) break
    if (pageJobs.length < limit) break

    offset += limit
  }

  console.log(`[Lever] Total jobs fetched for ${companySlug}: ${allJobs.length}`)

  const jobs: AtsJob[] = allJobs.map((item: any): AtsJob => {
    const externalId = String(item.id ?? item.slug ?? item.text ?? '')
    const jobUrl =
      item.hostedUrl ??
      item.applyUrl ??
      item.url ??
      `${atsUrl.replace(/\/$/, '')}/${externalId}`

    const locationText: string | null = item.categories?.location ?? null
    const commitment: string | null = item.categories?.commitment ?? null

    // Enhanced salary parsing: collect all mentions, parse a best-effort range.
    const salaryMentions = collectSalaryMentions(item)
    const bestSalaryText = salaryMentions.join(' | ')
    const parsedSalary = bestSalaryText ? parseSalaryRangeFromText(bestSalaryText) : null

    let salaryMin: number | null = parsedSalary?.salaryMin ?? null
    let salaryMax: number | null = parsedSalary?.salaryMax ?? null
    let salaryCurrency: string | null = parsedSalary?.salaryCurrency ?? null
    let salaryInterval: string | null = parsedSalary?.salaryInterval ?? null

    // Backward-compatible fallback: some Lever boards expose salary in lists[].content
    if (!salaryMin && !salaryMax) {
      const compensationSections: any[] = Array.isArray(item.lists) ? item.lists : []
      const comp = compensationSections.find((l) =>
        /compensation|salary/i.test((l.text as string) || ''),
      )

      if (comp && typeof comp.content === 'string') {
        const m = comp.content.match(/\$?\s*([\d,]+)(?:[^\d]+\$?\s*([\d,]+))?/)
        if (m) {
          salaryMin = Number(m[1].replace(/,/g, ''))
          if (m[2]) salaryMax = Number(m[2].replace(/,/g, ''))
          salaryCurrency = salaryCurrency ?? 'USD'
          salaryInterval = salaryInterval ?? 'year'
        }
      }
    }

    const locLower = (locationText || '').toLowerCase()
    const remoteHint =
      locLower.includes('remote') ||
      locLower.includes('anywhere') ||
      locLower.includes('work from home')

    const postedAt = item.createdAt ? new Date(item.createdAt) : null
    const updatedAt = item.updatedAt ? new Date(item.updatedAt) : postedAt

    const descriptionHtml: string | null =
      item.descriptionHtml || item.description || null
    const descriptionText: string | null =
      item.descriptionPlain || (descriptionHtml ? stripHtml(descriptionHtml) : null)

    return {
      externalId,
      title: item.text ?? item.title ?? 'Untitled',
      url: jobUrl,
      locationText,
      remote: remoteHint || null,

      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryInterval,

      employmentType: commitment,
      descriptionHtml,

      roleSlug: null,
      baseRoleSlug: null,
      seniority: null,
      discipline: null,
      isManager: false,

      postedAt,
      updatedAt,

      // Store complete item object for AI enrichment + add derived fields.
      raw: {
        ...item,
        _sixFigureJobs: {
          descriptionText,
          salaryMentions,
        },
      },
    }
  })

  return jobs
}
