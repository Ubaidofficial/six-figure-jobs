import type { ATSResult, AtsJob } from './types'
import { fetchJsonWithBackoff } from '../utils/fetchWithBackoff'

const USER_AGENT = 'SixFigureJobs/1.0 (+job-board-scraper)'
const TIMEOUT_MS = 15000
const PAGE_SIZE = 100
const DETAIL_CONCURRENCY = 4

type SmartRecruitersListResponse = {
  offset?: number
  limit?: number
  totalFound?: number
  content?: SmartRecruitersPostingSummary[]
}

type SmartRecruitersPostingSummary = {
  id?: string
  name?: string
  releasedDate?: string
  location?: {
    city?: string
    region?: string
    country?: string
    remote?: boolean
    hybrid?: boolean
    fullLocation?: string
  }
  department?: {
    label?: string
  }
  typeOfEmployment?: {
    label?: string
  }
}

type SmartRecruitersPostingDetail = SmartRecruitersPostingSummary & {
  uuid?: string
  refNumber?: string
  company?: {
    identifier?: string
    name?: string
  }
  postingUrl?: string
  applyUrl?: string
  jobAd?: {
    sections?: Record<string, { title?: string; text?: string }>
  }
}

function extractCompanyIdentifier(atsUrl: string): string | null {
  try {
    const url = new URL(atsUrl)
    const parts = url.pathname.split('/').filter(Boolean)
    return parts[0] ?? null
  } catch {
    return null
  }
}

// SmartRecruiters-tagged wrapper around the shared scraper fetch helper.
// Previous policy was blind linear backoff that ignored Retry-After — the
// shared util honors it for 429/503 and applies exponential backoff for
// 5xx/network errors.
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
        `[SmartRecruiters] retry ${info.attempt}/${info.attempts} for ${info.url} in ${info.delayMs}ms (${info.reason})`,
      ),
  })
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output: R[] = new Array(items.length)
  let index = 0

  const workers = new Array(Math.max(1, Math.min(limit, items.length)))
    .fill(0)
    .map(async () => {
      while (index < items.length) {
        const currentIndex = index++
        output[currentIndex] = await mapper(items[currentIndex], currentIndex)
      }
    })

  await Promise.all(workers)
  return output
}

function buildDescriptionHtml(
  sections: Record<string, { title?: string; text?: string }> | undefined,
): string | null {
  if (!sections) return null

  const parts = Object.values(sections)
    .map((section) => {
      const title = (section.title || '').trim()
      const text = (section.text || '').trim()
      if (!title && !text) return null
      if (!title) return text
      if (!text) return `<h2>${title}</h2>`
      return `<h2>${title}</h2>${text}`
    })
    .filter((value): value is string => Boolean(value))

  return parts.length ? parts.join('') : null
}

function buildLocationText(
  location: SmartRecruitersPostingSummary['location'] | undefined,
): string | null {
  if (!location) return null

  if (location.fullLocation) return location.fullLocation

  const parts = [location.city, location.region, location.country]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)

  return parts.length ? parts.join(', ') : null
}

export async function scrapeSmartRecruiters(atsUrl: string): Promise<AtsJob[]> {
  const companyIdentifier = extractCompanyIdentifier(atsUrl)
  if (!companyIdentifier) {
    throw new Error(
      `[SmartRecruiters] Could not extract company identifier from atsUrl=${atsUrl}`,
    )
  }

  const summaries: SmartRecruitersPostingSummary[] = []
  let offset = 0
  let totalFound = Number.POSITIVE_INFINITY

  while (offset < totalFound) {
    const url = `https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings?offset=${offset}&limit=${PAGE_SIZE}`
    const page = await fetchJsonWithRetry<SmartRecruitersListResponse>(url)
    const content = Array.isArray(page.content) ? page.content : []
    totalFound = Number(page.totalFound ?? content.length)

    if (!content.length) break

    summaries.push(...content)

    offset += Number(page.limit ?? PAGE_SIZE)
    if (content.length < PAGE_SIZE) break
  }

  const details = await mapLimit(
    summaries.filter((posting) => typeof posting.id === 'string' && posting.id.trim().length > 0),
    DETAIL_CONCURRENCY,
    async (posting) => {
      const url = `https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings/${posting.id}`
      return await fetchJsonWithRetry<SmartRecruitersPostingDetail>(url)
    },
  )

  return details.map((detail): AtsJob => {
    const locationText = buildLocationText(detail.location)
    const descriptionHtml = buildDescriptionHtml(detail.jobAd?.sections)
    const postedAt = detail.releasedDate ? new Date(detail.releasedDate) : null

    return {
      externalId: String(detail.id ?? detail.uuid ?? detail.refNumber ?? detail.name ?? ''),
      title: detail.name || 'Untitled',
      url: detail.postingUrl || detail.applyUrl || atsUrl,
      locationText,
      remote: detail.location?.remote ?? (locationText?.toLowerCase().includes('remote') || false),

      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryInterval: null,

      employmentType: detail.typeOfEmployment?.label ?? null,
      descriptionHtml,
      roleSlug: null,
      baseRoleSlug: null,
      seniority: null,
      discipline: detail.department?.label ?? null,
      isManager: false,

      postedAt,
      updatedAt: postedAt,
      raw: detail,
    }
  })
}

export async function scrapeSmartRecruitersResult(
  atsUrl: string,
): Promise<ATSResult> {
  const companyIdentifier = extractCompanyIdentifier(atsUrl)
  if (!companyIdentifier) {
    return {
      success: false,
      source: 'smartrecruiters',
      atsUrl,
      error: 'Could not extract SmartRecruiters company identifier',
    }
  }

  try {
    const jobs = await scrapeSmartRecruiters(atsUrl)
    return {
      success: true,
      source: 'smartrecruiters',
      company: companyIdentifier,
      atsUrl,
      jobs,
    }
  } catch (error: any) {
    return {
      success: false,
      source: 'smartrecruiters',
      company: companyIdentifier,
      atsUrl,
      error: error?.message || String(error),
    }
  }
}
