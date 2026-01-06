// lib/scrapers/ats/greenhouse.ts

import type { ATSResult, AtsJob } from './types'

interface GreenhouseLocation {
  name?: string
}

interface GreenhouseJob {
  id: number | string
  title: string
  absolute_url: string
  location?: GreenhouseLocation
  updated_at?: string
  first_published_at?: string
  // when content=true there are more fields; we treat them as "raw"
  [key: string]: any
}

interface GreenhouseJobsResponse {
  jobs: GreenhouseJob[]
}

/**
 * Extract the Greenhouse "board slug" from various possible atsUrl formats.
 *
 * Examples it should handle:
 *  - https://boards.greenhouse.io/scaleai
 *  - https://boards.greenhouse.io/scaleai/jobs/123
 *  - https://boards.greenhouse.io/embed/job_board?for=scaleai
 *  - https://boards-api.greenhouse.io/v1/boards/scaleai/jobs
 */
function extractBoardSlug(atsUrl: string): string | null {
  let url: URL
  try {
    url = new URL(atsUrl)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  const path = url.pathname.replace(/\/+$/, '')

  // embed job board: ?for=scaleai
  const forParam = url.searchParams.get('for')
  if (forParam) {
    return forParam
  }

  const parts = path.split('/').filter(Boolean)

  // boards-api.greenhouse.io/v1/boards/:slug/...
  if (host === 'boards-api.greenhouse.io') {
    const boardsIndex = parts.indexOf('boards')
    if (boardsIndex >= 0 && parts.length > boardsIndex + 1) {
      return parts[boardsIndex + 1]
    }
  }

  // boards.greenhouse.io/:slug/...
  if (host === 'boards.greenhouse.io') {
    if (parts.length > 0) {
      return parts[0]
    }
  }

  // job-boards.greenhouse.io/:slug/...
  if (host === 'job-boards.greenhouse.io') {
    if (parts.length > 0) {
      return parts[0]
    }
  }

  return null
}

/**
 * Minimal fetch-with-retries helper for Greenhouse API.
 * Uses AbortController to enforce a per-request timeout.
 */
async function fetchJsonWithRetry<T>(
  url: string,
  attempts = 3,
  timeoutMs = 15000,
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
          'User-Agent': 'SixFigureJobs/1.0 (+job-board-scraper)',
        },
        cache: 'no-store',
        signal: controller.signal,
      })

      clearTimeout(id)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }

      const json = (await res.json()) as T
      return json
    } catch (err: any) {
      lastError = err
      const msg = err?.message || String(err)
      console.warn(
        `[Greenhouse] fetch attempt ${i + 1} failed for ${url}: ${msg}`,
      )

      if (i < attempts - 1) {
        // simple backoff: 500ms, 1000ms, ...
        await new Promise((r) => setTimeout(r, 500 * (i + 1)))
      }
    }
  }

  throw lastError
}

/**
 * Scrape jobs from a Greenhouse board.
 *
 * IMPORTANT: we use `content=true` so each job in `raw` has full HTML
 * (job description, including salary text). Ingest will pull descriptionHtml
 * from `raw.content`.
 */
export async function scrapeGreenhouse(atsUrl: string): Promise<AtsJob[]> {
  const boardSlug = extractBoardSlug(atsUrl)

  if (!boardSlug) {
    throw new Error(`Could not extract board slug from atsUrl=${atsUrl}`)
  }

  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardSlug}/jobs?content=true`

  try {
    const data = await fetchJsonWithRetry<GreenhouseJobsResponse>(
      apiUrl,
      3,
      15000,
    )

    if (!data?.jobs?.length) {
      console.log(
        `[Greenhouse] No jobs returned for board=${boardSlug} (atsUrl=${atsUrl})`,
      )
      return []
    }

    const jobs: AtsJob[] = data.jobs.map((job) => {
      const externalId = String(job.id)
      const title = job.title || 'Untitled'
      const url = job.absolute_url
      const locationText = job.location?.name ?? null

      const postedAt = job.first_published_at
        ? new Date(job.first_published_at)
        : null
      const updatedAt = job.updated_at ? new Date(job.updated_at) : postedAt

      // Light "remote" hint; true normalization happens later.
      const locLower = locationText?.toLowerCase() || ''
      const remoteHint =
        locLower.includes('remote') ||
        locLower.includes('work from home') ||
        locLower.includes('anywhere')

      const atsJob: AtsJob = {
        externalId,
        title,
        url,
        locationText,
        remote: remoteHint,

        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryInterval: null,

        employmentType: null,
        descriptionHtml: job.content || null,  // EXTRACT FULL DESCRIPTION
        roleSlug: null,
        baseRoleSlug: null,
        seniority: 'unknown',
        discipline: null,
        isManager: false,

        postedAt,
        updatedAt,

        // We keep the full Greenhouse job (including `content`) here;
        // ingestFromAts pulls descriptionHtml + salary from this.
        raw: job,
      }

      return atsJob
    })

    console.log(
      `[Greenhouse] Fetched ${jobs.length} jobs for board=${boardSlug}`,
    )
    return jobs
  } catch (err: any) {
    const msg = err?.message || String(err)
    throw new Error(
      `[Greenhouse] Error fetching/parsing jobs for board=${boardSlug} (atsUrl=${atsUrl}): ${msg}`,
    )
  }
}

export async function scrapeGreenhouseResult(atsUrl: string): Promise<ATSResult> {
  const boardSlug = extractBoardSlug(atsUrl)
  if (!boardSlug) {
    return {
      success: false,
      source: 'greenhouse',
      atsUrl,
      error: 'Could not extract Greenhouse board slug',
    }
  }

  try {
    const jobs = await scrapeGreenhouse(atsUrl)
    return {
      success: true,
      source: 'greenhouse',
      company: boardSlug,
      atsUrl,
      jobs,
    }
  } catch (err: any) {
    return {
      success: false,
      source: 'greenhouse',
      company: boardSlug,
      atsUrl,
      error: err?.message || String(err),
    }
  }
}
