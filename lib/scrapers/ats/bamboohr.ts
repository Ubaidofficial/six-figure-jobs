// lib/scrapers/ats/bamboohr.ts
// BambooHR public careers API scraper.
//
// BambooHR exposes an unauthenticated JSON endpoint for the public careers page:
//   GET https://{subdomain}.bamboohr.com/careers/v1.1/open-positions?&start=0&limit=250
//
// ATS URL formats we accept:
//   https://{subdomain}.bamboohr.com
//   https://{subdomain}.bamboohr.com/careers
//   https://{subdomain}.bamboohr.com/jobs/embed2.php
//
// Job detail (salary) is fetched per-job:
//   GET https://{subdomain}.bamboohr.com/careers/{jobId}?detail=true

import type { ATSResult, AtsJob } from './types'

const USER_AGENT = 'SixFigureJobs/1.0 (+job-board-scraper)'
const TIMEOUT_MS = 15000
const LIST_LIMIT = 250
const DETAIL_CONCURRENCY = 5

// ─── Types ───────────────────────────────────────────────────────────────────

type BambooListJob = {
  id?: number | string
  jobOpeningId?: number | string
  jobTitle?: string
  title?: string
  location?: {
    city?: string | null
    state?: string | null
    country?: string | null
  }
  department?: { label?: string } | string
  employmentType?: string
  isRemote?: boolean
  datePosted?: string
  dateUpdated?: string
}

type BambooDetailJob = BambooListJob & {
  description?: string
  salaryRange?: {
    currency?: string
    rangeType?: string
    minimumSalary?: number | string | null
    maximumSalary?: number | string | null
    interval?: string
  } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractSubdomain(atsUrl: string): string | null {
  try {
    const url = new URL(atsUrl)
    const host = url.hostname.toLowerCase()
    if (!host.endsWith('.bamboohr.com')) return null
    const sub = host.replace(/\.bamboohr\.com$/, '')
    return sub.length > 0 ? sub : null
  } catch {
    return null
  }
}

async function fetchJson<T>(url: string, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(tid)
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    return res.json() as Promise<T>
  } catch (err) {
    clearTimeout(tid)
    throw err
  }
}

function parseNumber(val: number | string | null | undefined): number | null {
  if (val == null) return null
  const n = Number(val)
  return Number.isFinite(n) && n > 0 ? n : null
}

function buildLocationText(loc?: BambooListJob['location']): string | null {
  if (!loc) return null
  const parts = [loc.city, loc.state, loc.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

function normaliseInterval(raw?: string | null): string {
  if (!raw) return 'year'
  const lower = raw.toLowerCase()
  if (lower.includes('hour')) return 'hour'
  if (lower.includes('month')) return 'month'
  if (lower.includes('week')) return 'week'
  return 'year'
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i])
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker)
  await Promise.all(workers)
  return results
}

// ─── Core scraper ─────────────────────────────────────────────────────────────

export async function scrapeBambooHR(atsUrl: string): Promise<AtsJob[]> {
  const subdomain = extractSubdomain(atsUrl)
  if (!subdomain) {
    throw new Error(`[BambooHR] Cannot extract subdomain from atsUrl=${atsUrl}`)
  }

  const base = `https://${subdomain}.bamboohr.com`

  // Fetch the public job listing
  const listUrl = `${base}/careers/v1.1/open-positions?&start=0&limit=${LIST_LIMIT}`
  let listJobs: BambooListJob[] = []

  try {
    const data = await fetchJson<{ result?: BambooListJob[]; data?: BambooListJob[] } | BambooListJob[]>(listUrl)
    if (Array.isArray(data)) {
      listJobs = data
    } else if (Array.isArray((data as any)?.result)) {
      listJobs = (data as any).result
    } else if (Array.isArray((data as any)?.data)) {
      listJobs = (data as any).data
    }
  } catch (err: any) {
    throw new Error(`[BambooHR] Failed to fetch job list for ${subdomain}: ${err.message}`)
  }

  if (listJobs.length === 0) {
    console.log(`[BambooHR] No jobs found for ${subdomain}`)
    return []
  }

  console.log(`[BambooHR] ${subdomain}: ${listJobs.length} jobs listed — fetching details...`)

  // Fetch job detail (for salary, description) with bounded concurrency
  const detailedJobs = await runWithConcurrency(
    listJobs,
    DETAIL_CONCURRENCY,
    async (job): Promise<AtsJob> => {
      const jobId = String(job.id ?? job.jobOpeningId ?? '')
      const title = String(job.jobTitle ?? job.title ?? 'Untitled')
      const locationText = buildLocationText(job.location)
      const locLower = (locationText ?? '').toLowerCase()
      const remoteHint =
        job.isRemote === true ||
        locLower.includes('remote') ||
        locLower.includes('anywhere')

      const jobUrl = `${base}/careers/${jobId}`

      // Default AtsJob without detail
      const base_job: AtsJob = {
        externalId: jobId,
        title,
        url: jobUrl,
        locationText,
        remote: remoteHint,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryInterval: 'year',
        employmentType: typeof job.employmentType === 'string' ? job.employmentType : null,
        descriptionHtml: null,
        roleSlug: null,
        baseRoleSlug: null,
        seniority: 'unknown',
        discipline: null,
        isManager: false,
        postedAt: job.datePosted ? new Date(job.datePosted) : null,
        updatedAt: job.dateUpdated ? new Date(job.dateUpdated) : null,
        raw: job,
      }

      if (!jobId) return base_job

      try {
        const detailUrl = `${base}/careers/${jobId}?detail=true`
        const detail = await fetchJson<BambooDetailJob>(detailUrl, 10000)

        let salaryMin: number | null = null
        let salaryMax: number | null = null
        let salaryCurrency: string | null = null
        let salaryInterval = 'year'

        if (detail.salaryRange) {
          const sr = detail.salaryRange
          salaryMin = parseNumber(sr.minimumSalary)
          salaryMax = parseNumber(sr.maximumSalary)
          salaryCurrency = sr.currency ?? null
          salaryInterval = normaliseInterval(sr.interval ?? sr.rangeType)
        }

        return {
          ...base_job,
          salaryMin,
          salaryMax,
          salaryCurrency,
          salaryInterval,
          descriptionHtml: detail.description ?? null,
          raw: { ...job, ...detail },
        }
      } catch {
        // Detail fetch failed — return base job without description/salary
        return base_job
      }
    },
  )

  console.log(`[BambooHR] ${subdomain}: returning ${detailedJobs.length} jobs`)
  return detailedJobs
}

// ─── Result wrapper ──────────────────────────────────────────────────────────

export async function scrapeBambooHRResult(atsUrl: string): Promise<ATSResult> {
  const subdomain = extractSubdomain(atsUrl)
  try {
    const jobs = await scrapeBambooHR(atsUrl)
    return {
      success: true,
      source: 'bamboohr',
      company: subdomain ?? atsUrl,
      atsUrl,
      jobs,
    }
  } catch (err: any) {
    return {
      success: false,
      source: 'bamboohr',
      company: subdomain ?? atsUrl,
      atsUrl,
      error: err?.message || String(err),
    }
  }
}
