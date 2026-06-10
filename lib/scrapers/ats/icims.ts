import type { ATSResult, AtsJob } from './types'
import {
  extractCareerPageSignals,
  extractGenericJobDetail,
  fetchHtmlPage,
} from '../utils/companyCareersDiscovery'

const DETAIL_CONCURRENCY = 4

function normalizeIcimsBoardUrl(atsUrl: string): string | null {
  try {
    const url = new URL(atsUrl)
    const host = url.hostname.toLowerCase()
    if (!host.includes('icims.com')) return null

    return `${url.origin}/jobs`
  } catch {
    return null
  }
}

function buildSearchUrls(boardUrl: string): string[] {
  return Array.from(
    new Set([
      `${boardUrl}/search?ss=1`,
      `${boardUrl}/search`,
      boardUrl,
    ]),
  )
}

function extractIcimsJobId(jobUrl: string): string {
  try {
    const url = new URL(jobUrl)
    const parts = url.pathname.split('/').filter(Boolean)
    const jobsIndex = parts.findIndex((part) => part.toLowerCase() === 'jobs')
    const id = jobsIndex >= 0 ? parts[jobsIndex + 1] : null
    if (id) return id
  } catch {
    // Fall through to stable URL hash.
  }

  return Buffer.from(jobUrl).toString('base64url').slice(0, 32)
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output: R[] = new Array(items.length)
  let index = 0

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (index < items.length) {
      const currentIndex = index++
      output[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  })

  await Promise.all(workers)
  return output
}

function mapDetailToAtsJob(detailPageUrl: string, detail: NonNullable<ReturnType<typeof extractGenericJobDetail>>): AtsJob {
  return {
    externalId: extractIcimsJobId(detailPageUrl),
    title: detail.title,
    url: detail.url || detailPageUrl,
    locationText: detail.locationText,
    remote: detail.remote,
    salaryRaw: detail.salaryRaw,
    salaryMin: detail.salaryMin,
    salaryMax: detail.salaryMax,
    salaryCurrency: detail.salaryCurrency,
    salaryInterval: detail.salaryInterval,
    employmentType: detail.employmentType,
    descriptionHtml: detail.descriptionHtml,
    roleSlug: null,
    baseRoleSlug: null,
    seniority: null,
    discipline: null,
    isManager: /\bmanager|director|head\b/i.test(detail.title),
    postedAt: detail.postedAt,
    updatedAt: detail.updatedAt,
    validThrough: detail.validThrough,
    raw: detail.raw,
  }
}

export async function scrapeIcims(atsUrl: string): Promise<AtsJob[]> {
  const boardUrl = normalizeIcimsBoardUrl(atsUrl)
  if (!boardUrl) {
    throw new Error(`[iCIMS] Could not normalize atsUrl=${atsUrl}`)
  }

  const listingPages = []
  for (const url of buildSearchUrls(boardUrl)) {
    const page = await fetchHtmlPage(url)
    if (page?.html) listingPages.push(page)
    if (page?.html && page.html.length > 500) break
  }

  if (!listingPages.length) {
    throw new Error(`[iCIMS] Failed to fetch board page ${boardUrl}`)
  }

  const jobLinks = new Set<string>()
  const structuredJobs: AtsJob[] = []

  for (const page of listingPages) {
    const signals = extractCareerPageSignals(page.html, page.url)
    for (const link of signals.jobLinks) {
      if (/\/jobs\/[^/?#]+/i.test(link)) jobLinks.add(link)
    }

    for (const job of signals.structuredJobs) {
      if (!job.title || !job.url) continue
      structuredJobs.push(mapDetailToAtsJob(job.url, job))
    }
  }

  if (!jobLinks.size && structuredJobs.length) {
    return structuredJobs
  }

  const detailed = await mapLimit<string, AtsJob | null>(
    Array.from(jobLinks).slice(0, 150),
    DETAIL_CONCURRENCY,
    async (jobUrl) => {
      const detailPage = await fetchHtmlPage(jobUrl)
      if (!detailPage?.html) return null

      const detail = extractGenericJobDetail(detailPage.html, detailPage.url)
      if (!detail?.title) return null

      return mapDetailToAtsJob(detailPage.url, detail)
    },
  )

  return detailed.filter((job): job is AtsJob => Boolean(job))
}

export async function scrapeIcimsResult(atsUrl: string): Promise<ATSResult> {
  try {
    const jobs = await scrapeIcims(atsUrl)
    return {
      success: true,
      source: 'icims',
      atsUrl,
      jobs,
    }
  } catch (error: any) {
    return {
      success: false,
      source: 'icims',
      atsUrl,
      error: error?.message || String(error),
    }
  }
}
