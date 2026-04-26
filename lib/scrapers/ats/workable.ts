import type { ATSResult, AtsJob } from './types'

const USER_AGENT = 'SixFigureJobs/1.0 (+job-board-scraper)'
const TIMEOUT_MS = 15000
const DETAIL_CONCURRENCY = 4

type WorkableListJob = {
  id?: number
  shortcode?: string
  title?: string
  remote?: boolean
  location?: WorkableLocation
  locations?: WorkableLocation[]
  published?: string
  type?: string
  department?: string[]
  workplace?: string
}

type WorkableLocation = {
  country?: string
  countryCode?: string
  city?: string
  region?: string
  hidden?: boolean
}

type WorkableListResponse = {
  total?: number
  results?: WorkableListJob[]
}

type WorkableDetailJob = WorkableListJob & {
  description?: string
  requirements?: string
  benefits?: string
}

function extractAccountSlug(atsUrl: string): string | null {
  try {
    const url = new URL(atsUrl)
    if (url.hostname.toLowerCase() !== 'apply.workable.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    return parts[0] ?? null
  } catch {
    return null
  }
}

async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit,
  attempts = 3,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const res = await fetch(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
          'X-Requested-With': 'XMLHttpRequest',
          ...(init.headers || {}),
        },
        cache: 'no-store',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error(`Unexpected content-type: ${contentType || 'unknown'}`)
      }

      return (await res.json()) as T
    } catch (error) {
      lastError = error
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
      }
    }
  }

  throw lastError
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

function normalizeEmploymentType(type: string | null | undefined): string | null {
  switch ((type || '').toLowerCase()) {
    case 'full':
      return 'Full-time'
    case 'part':
      return 'Part-time'
    case 'contract':
      return 'Contract'
    case 'internship':
      return 'Internship'
    case 'temporary':
      return 'Temporary'
    default:
      return type || null
  }
}

function buildLocationText(
  primary: WorkableLocation | null | undefined,
  locations: WorkableLocation[] | null | undefined,
): string | null {
  const values = (Array.isArray(locations) ? locations : [primary])
    .flatMap((location) =>
      location
        ? [location.city, location.region, location.country]
        : [],
    )
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)

  if (!values.length) return null

  return Array.from(new Set(values)).join(', ')
}

function buildDescriptionHtml(job: WorkableDetailJob): string | null {
  const parts = [
    job.description || null,
    job.requirements ? `<h2>Requirements</h2>${job.requirements}` : null,
    job.benefits ? `<h2>Benefits</h2>${job.benefits}` : null,
  ].filter((value): value is string => Boolean(value))

  return parts.length ? parts.join('') : null
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function scrapeWorkable(atsUrl: string): Promise<AtsJob[]> {
  const accountSlug = extractAccountSlug(atsUrl)
  if (!accountSlug) {
    throw new Error(`[Workable] Could not extract account slug from atsUrl=${atsUrl}`)
  }

  const listUrl = `https://apply.workable.com/api/v3/accounts/${accountSlug}/jobs`
  const list = await fetchJsonWithRetry<WorkableListResponse>(
    listUrl,
    {
      method: 'POST',
      body: '{}',
    },
  )

  const summaries = Array.isArray(list.results) ? list.results : []

  const details = await mapLimit(
    summaries.filter(
      (job): job is WorkableListJob & { shortcode: string } =>
        typeof job.shortcode === 'string' && job.shortcode.trim().length > 0,
    ),
    DETAIL_CONCURRENCY,
    async (job) => {
      const detailUrl = `https://apply.workable.com/api/v2/accounts/${accountSlug}/jobs/${job.shortcode}`
      return await fetchJsonWithRetry<WorkableDetailJob>(detailUrl, {
        method: 'GET',
      })
    },
  )

  return details.map((job): AtsJob => {
    const postedAt = parseDate(job.published)
    const locationText = buildLocationText(job.location, job.locations)
    const shortcode = String(job.shortcode ?? job.id ?? job.title ?? '')

    return {
      externalId: shortcode,
      title: job.title || 'Untitled',
      url: `https://apply.workable.com/${accountSlug}/j/${shortcode}`,
      locationText,
      remote:
        job.remote ??
        (job.workplace === 'remote' ||
          locationText?.toLowerCase().includes('remote') ||
          false),

      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryInterval: null,

      employmentType: normalizeEmploymentType(job.type),
      descriptionHtml: buildDescriptionHtml(job),
      roleSlug: null,
      baseRoleSlug: null,
      seniority: null,
      discipline: Array.isArray(job.department) ? job.department.join(', ') : null,
      isManager: false,

      postedAt,
      updatedAt: postedAt,
      raw: job,
    }
  })
}

export async function scrapeWorkableResult(atsUrl: string): Promise<ATSResult> {
  const accountSlug = extractAccountSlug(atsUrl)
  if (!accountSlug) {
    return {
      success: false,
      source: 'workable',
      atsUrl,
      error: 'Could not extract Workable account slug',
    }
  }

  try {
    const jobs = await scrapeWorkable(atsUrl)
    return {
      success: true,
      source: 'workable',
      company: accountSlug,
      atsUrl,
      jobs,
    }
  } catch (error: any) {
    return {
      success: false,
      source: 'workable',
      company: accountSlug,
      atsUrl,
      error: error?.message || String(error),
    }
  }
}
