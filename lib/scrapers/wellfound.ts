// lib/scrapers/wellfound.ts
//
// Wellfound (AngelList) GraphQL-only scraper (no HTML scraping / no Puppeteer).

import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'
import type { ScrapedJobInput } from '../ingest/types'
import { addIngestStatus, errorStats, type ScraperStats } from './scraperStats'

const BOARD_NAME = 'wellfound'
const GRAPHQL_URL = 'https://api.wellfound.com/graphql'
const USER_AGENT = 'SixFigureJobs/1.0 (+job-board-scraper)'
const TIMEOUT_MS = 15000

const JOBS_QUERY = `
  query GetJobs($after: String, $filters: JobSearchFilters) {
    jobSearch(first: 100, after: $after, filters: $filters) {
      edges {
        node {
          id
          title
          description
          salaryMin
          salaryMax
          equity
          remote
          location {
            name
          }
          company {
            name
            website
            size
          }
          url
          postedAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

type WellfoundJobNode = {
  id: string | number
  title?: string | null
  description?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  equity?: any
  remote?: boolean | null
  location?: { name?: string | null } | null
  company?: { name?: string | null; website?: string | null; size?: any } | null
  url?: string | null
  postedAt?: string | null
  [key: string]: any
}

type WellfoundJobSearch = {
  edges?: Array<{ node?: WellfoundJobNode | null } | null> | null
  pageInfo?: { hasNextPage?: boolean | null; endCursor?: string | null } | null
}

type WellfoundGraphqlResponse = {
  data?: { jobSearch?: WellfoundJobSearch | null } | null
  errors?: Array<{ message?: string }> | null
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toAnnualDollars(raw: unknown): number | null {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  // Heuristic: support either annual USD (e.g., 150000) or "k" (e.g., 150).
  return n < 1000 ? Math.round(n * 1000) : Math.round(n)
}

async function postGraphqlWithRetry<T>(
  body: Record<string, any>,
  attempts = 3,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  let lastError: any = null

  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), timeoutMs)

      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(id)

      if (!res.ok) throw new Error(`Wellfound API returned ${res.status}`)

      return (await res.json()) as T
    } catch (err: any) {
      lastError = err
      const msg = err?.message || String(err)
      console.warn(`[Wellfound] fetch attempt ${i + 1} failed: ${msg}`)

      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)))
      }
    }
  }

  throw lastError
}

async function fetchWellfoundJobs(after: string | null = null): Promise<WellfoundJobSearch> {
  const variables = {
    after,
    filters: {
      salaryMin: 100000,
      remote: true,
      types: ['FULL_TIME'],
    },
  }

  const payload = {
    query: JOBS_QUERY,
    variables,
  }

  const data = await postGraphqlWithRetry<WellfoundGraphqlResponse>(payload, 3, TIMEOUT_MS)

  if (data?.errors?.length) {
    const msg = data.errors.map((e) => e?.message).filter(Boolean).join('; ')
    throw new Error(msg || 'Wellfound GraphQL error')
  }

  return data?.data?.jobSearch || { edges: [], pageInfo: { hasNextPage: false, endCursor: null } }
}

export default async function scrapeWellfound(): Promise<ScraperStats> {
  console.log('[Wellfound] Starting scrape...')

  try {
    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    let cursor: string | null = null
    let hasNextPage = true
    let pageCount = 0
    const maxPages = 50

    const seen = new Set<string>()

    while (hasNextPage && pageCount < maxPages) {
      console.log(`[Wellfound] Fetching page ${pageCount + 1}`)

      const result = await fetchWellfoundJobs(cursor)
      const edges = result.edges || []

      for (const edge of edges) {
        const job = edge?.node
        if (!job) continue

        const externalId = String(job.id ?? '')
        if (!externalId) {
          stats.skipped++
          continue
        }
        if (seen.has(externalId)) continue
        seen.add(externalId)

        const title = String(job.title ?? '').trim()
        if (!title) {
          stats.skipped++
          continue
        }

        const descriptionHtml: string | null = typeof job.description === 'string' ? job.description : null
        const descriptionText: string | null = descriptionHtml ? stripHtml(descriptionHtml) : null

        const salaryMin = toAnnualDollars(job.salaryMin)
        const salaryMax = toAnnualDollars(job.salaryMax)

        const url = job.url || `https://wellfound.com/jobs/${externalId}`

        const scrapedJob: ScrapedJobInput = {
          externalId,
          title,
          source: makeBoardSource(BOARD_NAME),
          rawCompanyName: job.company?.name || 'Unknown',
          companyWebsiteUrl: job.company?.website || null,
          url,
          applyUrl: url,
          locationText: job.location?.name || 'Remote',
          isRemote: Boolean(job.remote),

          // CRITICAL: Full description for AI enrichment
          descriptionHtml,
          descriptionText,

          salaryMin,
          salaryMax,
          salaryCurrency: 'USD',
          salaryInterval: 'year',

          employmentType: 'Full-time',
          postedAt: job.postedAt ? new Date(job.postedAt) : null,

          raw: {
            ...job,
            equity: job.equity,
          },
        }

        try {
          const ingestResult = await ingestJob(scrapedJob)
          addIngestStatus(stats, ingestResult.status)
        } catch (err) {
          console.error('[Wellfound] Job ingest failed:', err)
          stats.skipped++
        }
      }

      cursor = result.pageInfo?.endCursor ?? null
      hasNextPage = Boolean(result.pageInfo?.hasNextPage)
      pageCount++
    }

    console.log(`[Wellfound] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[Wellfound] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}

