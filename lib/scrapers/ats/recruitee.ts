import type { ATSResult, AtsJob } from './types'

const USER_AGENT = 'SixFigureJobs/1.0 (+job-board-scraper)'
const TIMEOUT_MS = 15000

type RecruiteeOffer = {
  id?: number | string
  slug?: string
  guid?: string
  title?: string
  description?: string
  requirements?: string
  translations?: Record<
    string,
    {
      title?: string
      description?: string
      requirements?: string
    }
  >
  careers_url?: string
  careers_apply_url?: string
  remote?: boolean
  hybrid?: boolean
  on_site?: boolean
  country?: string
  city?: string
  location?: string
  locations?: Array<{
    name?: string
    city?: string
    state?: string
    country?: string
  }>
  department?: string
  employment_type_code?: string
  salary?: {
    min?: number | null
    max?: number | null
    currency?: string | null
    period?: string | null
  }
  published_at?: string | null
  updated_at?: string | null
  created_at?: string | null
}

type RecruiteeOffersResponse = {
  offers?: RecruiteeOffer[]
}

function extractSubdomain(atsUrl: string): string | null {
  try {
    const url = new URL(atsUrl)
    const hostname = url.hostname.toLowerCase()
    if (!hostname.endsWith('.recruitee.com')) return null
    return hostname.replace(/\.recruitee\.com$/, '')
  } catch {
    return null
  }
}

async function fetchJsonWithRetry<T>(
  url: string,
  attempts = 3,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
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

function normalizeEmploymentType(code: string | null | undefined): string | null {
  switch ((code || '').toLowerCase()) {
    case 'fulltime':
      return 'Full-time'
    case 'parttime':
      return 'Part-time'
    case 'contract':
      return 'Contract'
    case 'temporary':
      return 'Temporary'
    case 'internship':
      return 'Internship'
    default:
      return code || null
  }
}

function buildLocationText(offer: RecruiteeOffer): string | null {
  const locations = Array.isArray(offer.locations) ? offer.locations : []
  const values = locations
    .flatMap((location) => [location.name, location.city, location.state, location.country])
    .concat([offer.location, offer.city, offer.country])
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)

  if (!values.length) return null

  return Array.from(new Set(values)).join(', ')
}

function buildDescriptionHtml(offer: RecruiteeOffer): string | null {
  const translation = offer.translations?.en ?? Object.values(offer.translations || {})[0]
  const title = translation?.title || offer.title || ''
  const description = translation?.description || offer.description || ''
  const requirements = translation?.requirements || offer.requirements || ''

  const parts = [
    title ? `<h2>${title}</h2>` : null,
    description || null,
    requirements ? `<h2>Requirements</h2>${requirements}` : null,
  ].filter((value): value is string => Boolean(value))

  return parts.length ? parts.join('') : null
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function scrapeRecruitee(atsUrl: string): Promise<AtsJob[]> {
  const subdomain = extractSubdomain(atsUrl)
  if (!subdomain) {
    throw new Error(`[Recruitee] Could not extract subdomain from atsUrl=${atsUrl}`)
  }

  const apiUrl = `https://${subdomain}.recruitee.com/api/offers`
  const data = await fetchJsonWithRetry<RecruiteeOffersResponse>(apiUrl)
  const offers = Array.isArray(data.offers) ? data.offers : []

  return offers.map((offer): AtsJob => {
    const postedAt =
      parseDate(offer.published_at) || parseDate(offer.created_at) || null

    return {
      externalId: String(offer.id ?? offer.guid ?? offer.slug ?? offer.title ?? ''),
      title: offer.title || offer.translations?.en?.title || 'Untitled',
      url: offer.careers_url || offer.careers_apply_url || atsUrl,
      locationText: buildLocationText(offer),
      remote: offer.remote ?? false,

      salaryMin: offer.salary?.min ?? null,
      salaryMax: offer.salary?.max ?? null,
      salaryCurrency: offer.salary?.currency ?? null,
      salaryInterval: offer.salary?.period ?? null,

      employmentType: normalizeEmploymentType(offer.employment_type_code),
      descriptionHtml: buildDescriptionHtml(offer),
      roleSlug: null,
      baseRoleSlug: null,
      seniority: null,
      discipline: offer.department ?? null,
      isManager: false,

      postedAt,
      updatedAt: parseDate(offer.updated_at) || postedAt,
      raw: offer,
    }
  })
}

export async function scrapeRecruiteeResult(atsUrl: string): Promise<ATSResult> {
  const subdomain = extractSubdomain(atsUrl)
  if (!subdomain) {
    return {
      success: false,
      source: 'recruitee',
      atsUrl,
      error: 'Could not extract Recruitee subdomain',
    }
  }

  try {
    const jobs = await scrapeRecruitee(atsUrl)
    return {
      success: true,
      source: 'recruitee',
      company: subdomain,
      atsUrl,
      jobs,
    }
  } catch (error: any) {
    return {
      success: false,
      source: 'recruitee',
      company: subdomain,
      atsUrl,
      error: error?.message || String(error),
    }
  }
}
