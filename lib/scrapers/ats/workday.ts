import type { ATSResult, AtsJob } from './types'

const USER_AGENT = 'SixFigureJobs/1.0 (+job-board-scraper)'
const TIMEOUT_MS = 15000
const PAGE_SIZE = 100
const DETAIL_CONCURRENCY = 4

type WorkdayContext = {
  origin: string
  tenant: string
  siteId: string
}

type WorkdayListingResponse = {
  total?: number
  jobPostings?: WorkdayListingJob[]
}

type WorkdayListingJob = {
  title?: string
  externalPath?: string
  locationsText?: string
  postedOn?: string
  bulletFields?: string[]
}

type WorkdayDetailResponse = {
  jobPostingInfo?: {
    id?: string
    title?: string
    jobDescription?: string
    location?: string
    postedOn?: string
    startDate?: string
    timeType?: string
    jobReqId?: string
    jobPostingId?: string
    externalUrl?: string
    jobRequisitionLocation?: {
      descriptor?: string
      country?: {
        alpha2Code?: string
        descriptor?: string
      }
    }
  }
}

type WorkdayMappedDetail = {
  summary: WorkdayListingJob
  detail: NonNullable<WorkdayDetailResponse['jobPostingInfo']> | null
}

function looksLikeLocale(value: string | undefined): boolean {
  if (!value) return false
  return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(value)
}

function normalizeWorkdayUrl(rawUrl: string): string {
  const url = new URL(rawUrl)
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

function extractContextFromUrl(rawUrl: string): WorkdayContext | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  const hostname = url.hostname.toLowerCase()
  if (!hostname.includes('myworkdayjobs.com') && !hostname.includes('workdayjobs.com')) {
    return null
  }

  const parts = url.pathname.split('/').filter(Boolean)
  const cxsIndex = parts.indexOf('cxs')
  if (cxsIndex >= 0 && parts.length > cxsIndex + 2) {
    return {
      origin: url.origin,
      tenant: parts[cxsIndex + 1],
      siteId: parts[cxsIndex + 2],
    }
  }

  const tenant = hostname.split('.')[0]
  if (!tenant) return null

  let siteId: string | null = null
  const jobIndex = parts.findIndex((part) => part === 'job' || part === 'details')
  if (jobIndex > 0) {
    siteId = parts[jobIndex - 1] ?? null
  } else if (parts.length >= 2 && looksLikeLocale(parts[0])) {
    siteId = parts[1] ?? null
  } else if (parts.length >= 1) {
    siteId = parts[0] ?? null
  }

  if (!siteId) return null

  return {
    origin: url.origin,
    tenant,
    siteId,
  }
}

function extractContextFromHtml(html: string, fallbackOrigin: string): WorkdayContext | null {
  const tenant = html.match(/tenant:\s*"([^"]+)"/i)?.[1]
  const siteId = html.match(/siteId:\s*"([^"]+)"/i)?.[1]
  if (!tenant || !siteId) return null
  return {
    origin: fallbackOrigin,
    tenant,
    siteId,
  }
}

async function fetchTextWithRetry(
  url: string,
  init: RequestInit = {},
  attempts = 3,
  timeoutMs = TIMEOUT_MS,
): Promise<string> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const res = await fetch(url, {
        ...init,
        headers: {
          'User-Agent': USER_AGENT,
          ...(init.headers || {}),
        },
        cache: 'no-store',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }

      return await res.text()
    } catch (error) {
      lastError = error
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
      }
    }
  }

  throw lastError
}

async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit,
  attempts = 3,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  const text = await fetchTextWithRetry(
    url,
    {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    },
    attempts,
    timeoutMs,
  )

  return JSON.parse(text) as T
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

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectCurrencyFromText(text: string): string | null {
  const upper = text.toUpperCase()
  if (upper.includes('EUR') || text.includes('€')) return 'EUR'
  if (upper.includes('GBP') || text.includes('£')) return 'GBP'
  if (upper.includes('CAD') || upper.includes('CA$')) return 'CAD'
  if (upper.includes('AUD') || upper.includes('A$')) return 'AUD'
  if (upper.includes('USD')) return 'USD'
  if (text.includes('$')) return 'USD'
  return null
}

function parseSalaryRangeFromText(text: string): {
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  salaryInterval: string | null
} {
  const lower = text.toLowerCase()
  const interval =
    /\/\s*hour|per\s*hour|\bhr\b/.test(lower)
      ? 'hour'
      : /\/\s*month|per\s*month/.test(lower)
        ? 'month'
        : /\/\s*week|per\s*week/.test(lower)
          ? 'week'
          : /\/\s*day|per\s*day/.test(lower)
            ? 'day'
            : 'year'

  const numbers: number[] = []

  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*k\b/gi)) {
    const value = Number(match[1])
    if (Number.isFinite(value)) numbers.push(Math.round(value * 1000))
  }

  for (const match of text.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d{5,})\b/g)) {
    const value = Number(match[1].replace(/,/g, ''))
    if (Number.isFinite(value)) numbers.push(value)
  }

  const unique = Array.from(new Set(numbers))
    .filter((value) => value >= 1000)
    .sort((a, b) => a - b)

  return {
    salaryMin: unique[0] ?? null,
    salaryMax: unique[1] ?? null,
    salaryCurrency: detectCurrencyFromText(text),
    salaryInterval: unique.length ? interval : null,
  }
}

function parsePostedOn(text: string | null | undefined): Date | null {
  if (!text) return null

  const now = new Date()
  const value = text.trim().toLowerCase()

  if (value === 'posted today') return now
  if (value === 'posted yesterday') return new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const days = value.match(/posted\s+(\d+)\s+day/)
  if (days) {
    return new Date(now.getTime() - Number(days[1]) * 24 * 60 * 60 * 1000)
  }

  const weeks = value.match(/posted\s+(\d+)\s+week/)
  if (weeks) {
    return new Date(now.getTime() - Number(weeks[1]) * 7 * 24 * 60 * 60 * 1000)
  }

  return null
}

async function resolveContext(atsUrl: string): Promise<WorkdayContext> {
  const direct = extractContextFromUrl(atsUrl)
  if (atsUrl.includes('/wday/cxs/') && direct?.siteId) return direct

  const normalizedUrl = normalizeWorkdayUrl(atsUrl)
  const origin = direct?.origin ?? new URL(atsUrl).origin
  const html = await fetchTextWithRetry(normalizedUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/html',
    },
  })

  const fromHtml = extractContextFromHtml(html, origin)
  if (fromHtml) return fromHtml
  if (direct?.siteId) return direct

  throw new Error(`[Workday] Could not resolve tenant/site from atsUrl=${atsUrl}`)
}

function buildApiBase(context: WorkdayContext): string {
  return `${context.origin}/wday/cxs/${context.tenant}/${context.siteId}`
}

function extractExternalPathFromUrl(
  rawUrl: string,
  siteId: string,
): string | null {
  try {
    const url = new URL(rawUrl)
    const parts = url.pathname.split('/').filter(Boolean)

    const jobIndex = parts.findIndex((part) => part === 'job' || part === 'details')
    if (jobIndex >= 0) {
      return `/${parts.slice(jobIndex).join('/')}`
    }

    const siteIndex = parts.findIndex((part) => part === siteId)
    if (siteIndex >= 0 && parts.length > siteIndex + 1) {
      return `/${parts.slice(siteIndex + 1).join('/')}`
    }

    return null
  } catch {
    return null
  }
}

function mapWorkdayDetailToJob(
  context: WorkdayContext,
  mapped: WorkdayMappedDetail,
): AtsJob {
  const { summary, detail } = mapped
  const descriptionHtml = detail?.jobDescription ?? null
  const descriptionText = descriptionHtml ? stripHtml(descriptionHtml) : ''
  const parsedSalary = descriptionText
    ? parseSalaryRangeFromText(descriptionText)
    : {
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryInterval: null,
      }

  const locationText =
    detail?.location ??
    summary.locationsText ??
    detail?.jobRequisitionLocation?.descriptor ??
    null

  const postedAt =
    parsePostedOn(detail?.postedOn) ||
    parsePostedOn(summary.postedOn) ||
    null

  return {
    externalId:
      detail?.jobReqId ||
      detail?.jobPostingId ||
      detail?.id ||
      summary.externalPath ||
      summary.title ||
      'unknown',
    title: detail?.title || summary.title || 'Untitled',
    url:
      detail?.externalUrl ||
      `${context.origin}/${context.siteId}${summary.externalPath || ''}`,
    locationText,
    remote:
      locationText?.toLowerCase().includes('remote') ||
      locationText?.toLowerCase().includes('anywhere') ||
      false,

    salaryMin: parsedSalary.salaryMin,
    salaryMax: parsedSalary.salaryMax,
    salaryCurrency: parsedSalary.salaryCurrency,
    salaryInterval: parsedSalary.salaryInterval,

    employmentType: detail?.timeType ?? null,
    descriptionHtml,
    roleSlug: null,
    baseRoleSlug: null,
    seniority: null,
    discipline: null,
    isManager: false,

    postedAt,
    updatedAt: postedAt,
    raw: {
      summary,
      detail,
    },
  }
}

export async function scrapeWorkday(atsUrl: string): Promise<AtsJob[]> {
  const context = await resolveContext(atsUrl)
  const apiBase = buildApiBase(context)

  const summaries: WorkdayListingJob[] = []
  let offset = 0
  let total = Number.POSITIVE_INFINITY

  try {
    while (offset < total) {
      const page = await fetchJsonWithRetry<WorkdayListingResponse>(
        `${apiBase}/jobs`,
        {
          method: 'POST',
          body: JSON.stringify({
            appliedFacets: {},
            limit: PAGE_SIZE,
            offset,
            searchText: '',
          }),
        },
      )

      const jobPostings = Array.isArray(page.jobPostings) ? page.jobPostings : []
      total = Number(page.total ?? jobPostings.length)
      if (!jobPostings.length) break

      summaries.push(...jobPostings)

      offset += PAGE_SIZE
      if (jobPostings.length < PAGE_SIZE) break
    }
  } catch (error) {
    const externalPath = extractExternalPathFromUrl(atsUrl, context.siteId)
    if (!externalPath) {
      throw error
    }

    const detail = await fetchJsonWithRetry<WorkdayDetailResponse>(
      `${apiBase}${externalPath}`,
      {
        method: 'GET',
      },
    )

    return [
      mapWorkdayDetailToJob(context, {
        summary: {
          title: detail.jobPostingInfo?.title,
          externalPath,
          locationsText: detail.jobPostingInfo?.location,
          postedOn: detail.jobPostingInfo?.postedOn,
          bulletFields: detail.jobPostingInfo?.jobReqId
            ? [detail.jobPostingInfo.jobReqId]
            : [],
        },
        detail: detail.jobPostingInfo ?? null,
      }),
    ]
  }

  const details = await mapLimit(
    summaries.filter(
      (job): job is WorkdayListingJob & { externalPath: string } =>
        typeof job.externalPath === 'string' && job.externalPath.startsWith('/'),
    ),
    DETAIL_CONCURRENCY,
    async (job) => {
      const detail = await fetchJsonWithRetry<WorkdayDetailResponse>(
        `${apiBase}${job.externalPath}`,
        {
          method: 'GET',
        },
      )

      return {
        summary: job,
        detail: detail.jobPostingInfo ?? null,
      }
    },
  )

  return details.map((mapped): AtsJob => mapWorkdayDetailToJob(context, mapped))
}

export async function scrapeWorkdayResult(atsUrl: string): Promise<ATSResult> {
  try {
    const context = await resolveContext(atsUrl)
    const jobs = await scrapeWorkday(atsUrl)
    return {
      success: true,
      source: 'workday',
      company: `${context.tenant}/${context.siteId}`,
      atsUrl,
      jobs,
    }
  } catch (error: any) {
    return {
      success: false,
      source: 'workday',
      atsUrl,
      error: error?.message || String(error),
    }
  }
}
