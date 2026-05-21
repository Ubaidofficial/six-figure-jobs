import * as cheerio from 'cheerio'

import { normalizePublicCompanyWebsite } from '../../companies/website'
import { cleanJobDescriptionHtml, stripJobHtmlTags } from '../../jobs/descriptionCleaning'
import { detectAtsFromUrl } from '../../normalizers/ats'
import {
  estimateUsdAnnualFromNormalized,
  normalizeSalary,
  parseSalaryFromText,
} from '../../normalizers/salary'
import type { AtsProvider } from '../ats/types'
import { detectATS, type ATSType } from './detectATS'

export const DISCOVERY_USER_AGENT = 'SixFigureJobs/1.0 (+company-careers-discovery)'
export const DEFAULT_DISCOVERY_TIMEOUT_MS = 15_000

export const CAREERS_PATH_CANDIDATES = [
  '/careers',
  '/jobs',
  '/careers/jobs',
  '/company/careers',
  '/about/careers',
  '/join-us',
  '/join',
  '/hiring',
  '/open-positions',
  '/positions',
] as const

const CAREERS_LINK_TEXT_RE =
  /\b(careers?|jobs?|join us|open positions|open roles|job openings|work with us|we're hiring|we are hiring)\b/i
const JOB_PATH_RE = /\/(jobs?|careers?|positions?|openings?)(?:\/|$)/i
const SALARY_SIGNAL_RE =
  /(?:US\$|A\$|C\$|NZ\$|S\$|CHF|SEK|NOK|DKK|USD|EUR|GBP|AUD|CAD|SGD|INR|₹|€|£|\$)\s*\d[\d,.\s]*[kKmM]?/i
const GENERIC_LINK_TEXT_RE =
  /^(all jobs|job openings|open positions|careers|jobs|view openings|see openings|open roles)$/i
const BLOCKED_LINK_RE =
  /\/(?:about|blog|privacy|terms|press|contact|team|people|culture|benefits|faq|news|events)(?:\/|$)/i
const CAREER_SURFACE_URL_RE =
  /(^|[./_-])(career|careers|job|jobs|hiring|join|open-positions|openings|positions|roles|vacancies)([./_-]|$)/i
const BLOCKED_GENERIC_SOURCE_HOSTS = [
  'nodesk.co',
  'remote.co',
  'remoteok.com',
  'remoteok.io',
  'remote100k.com',
  'weworkremotely.com',
  'remotive.com',
  'builtin.com',
  'jobboardsearch.com',
  'jobboardhive.com',
  'startup.jobs',
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'monster.com',
  'ziprecruiter.com',
  'jobcopilot.com',
]

export type SupportedAtsDiscovery = {
  type: ATSType
  provider: AtsProvider
  url: string
}

export type AnyAtsDiscovery = {
  type: ATSType
  url: string
}

export type StructuredJobSnapshot = {
  title: string
  url: string | null
  applyUrl: string | null
  descriptionHtml: string | null
  descriptionText: string | null
  locationText: string | null
  remote: boolean | null
  salaryRaw: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  salaryInterval: string | null
  employmentType: string | null
  postedAt: Date | null
  updatedAt: Date | null
  validThrough: Date | null
  raw: unknown
}

export type CareerPageSignals = {
  structuredJobs: StructuredJobSnapshot[]
  jobLinks: string[]
  hasStructuredJobs: boolean
  highSalarySignals: number
}

function normalizeHost(host: string | null | undefined): string {
  return String(host || '').replace(/^www\./, '').toLowerCase()
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeUrlOrNull(value: string | null | undefined, baseUrl: string): string | null {
  try {
    return new URL(String(value || '').trim(), baseUrl).toString()
  } catch {
    return null
  }
}

function sameSiteHost(candidateUrl: string, pageUrl: string): boolean {
  try {
    const candidateHost = normalizeHost(new URL(candidateUrl).hostname)
    const pageHost = normalizeHost(new URL(pageUrl).hostname)
    return (
      candidateHost === pageHost ||
      candidateHost.endsWith(`.${pageHost}`) ||
      pageHost.endsWith(`.${candidateHost}`)
    )
  } catch {
    return false
  }
}

function hostMatches(hostname: string, candidate: string): boolean {
  return hostname === candidate || hostname.endsWith(`.${candidate}`)
}

function hasCareerCueInUrl(candidateUrl: string): boolean {
  try {
    const parsed = new URL(candidateUrl)
    const haystack = `${parsed.hostname}${parsed.pathname}`.toLowerCase()
    return CAREER_SURFACE_URL_RE.test(haystack)
  } catch {
    return false
  }
}

export function classifyGenericCareerSource(
  sourceUrl: string,
  companyWebsite?: string | null,
): { valid: boolean; normalizedUrl: string | null; reason: string } {
  const normalizedUrl = normalizeUrlOrNull(sourceUrl, sourceUrl)
  if (!normalizedUrl) {
    return { valid: false, normalizedUrl: null, reason: 'invalid_url' }
  }

  let sourceHost = ''
  try {
    sourceHost = normalizeHost(new URL(normalizedUrl).hostname)
  } catch {
    return { valid: false, normalizedUrl: null, reason: 'invalid_url' }
  }

  if (detectAtsFromUrl(normalizedUrl)) {
    return { valid: false, normalizedUrl, reason: 'ats_url' }
  }

  if (BLOCKED_GENERIC_SOURCE_HOSTS.some((host) => hostMatches(sourceHost, host))) {
    return { valid: false, normalizedUrl, reason: 'blocked_host' }
  }

  const normalizedCompanyWebsite = normalizePublicCompanyWebsite(companyWebsite)
  if (normalizedCompanyWebsite && !sameSiteHost(normalizedUrl, normalizedCompanyWebsite)) {
    return { valid: false, normalizedUrl, reason: 'offsite_host' }
  }

  if (!hasCareerCueInUrl(normalizedUrl)) {
    return { valid: false, normalizedUrl, reason: 'not_career_surface' }
  }

  return { valid: true, normalizedUrl, reason: 'ok' }
}

function parseDateOrNull(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim()
    if (!cleaned) return null
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function mapUnitTextToInterval(value: unknown): string | null {
  const lower = String(value || '').toLowerCase()
  if (!lower) return null
  if (lower.includes('hour')) return 'hour'
  if (lower.includes('day')) return 'day'
  if (lower.includes('week')) return 'week'
  if (lower.includes('month')) return 'month'
  if (lower.includes('year') || lower.includes('annual')) return 'year'
  return null
}

function buildLocationTextFromAddress(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null
  const parts = [
    (address as any).addressLocality,
    (address as any).addressRegion,
    (address as any).addressCountry,
  ]
    .map((value) => normalizeText(typeof value === 'string' ? value : ''))
    .filter(Boolean)

  return parts.length ? Array.from(new Set(parts)).join(', ') : null
}

function buildLocationText(jobLocation: unknown): string | null {
  const nodes = Array.isArray(jobLocation) ? jobLocation : [jobLocation]
  const values = nodes
    .flatMap((node) => {
      if (!node || typeof node !== 'object') return []

      const directName = normalizeText((node as any).name)
      const addressText = buildLocationTextFromAddress((node as any).address)
      return [directName, addressText].filter(Boolean)
    })
    .filter(Boolean)

  return values.length ? Array.from(new Set(values)).join(' | ') : null
}

function buildSalaryFromBaseSalary(baseSalary: unknown): {
  salaryRaw: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  salaryInterval: string | null
} {
  if (!baseSalary || typeof baseSalary !== 'object') {
    return {
      salaryRaw: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryInterval: null,
    }
  }

  const salaryCurrency =
    typeof (baseSalary as any).currency === 'string' ? (baseSalary as any).currency : null

  const rawValue = (baseSalary as any).value ?? baseSalary
  const valueNode =
    Array.isArray(rawValue) && rawValue.length > 0
      ? rawValue.find((entry) => entry && typeof entry === 'object') ?? rawValue[0]
      : rawValue

  const salaryMin = parseNumberOrNull((valueNode as any)?.minValue ?? (valueNode as any)?.value)
  const salaryMax = parseNumberOrNull((valueNode as any)?.maxValue ?? (valueNode as any)?.value)
  const salaryInterval =
    mapUnitTextToInterval((valueNode as any)?.unitText) ||
    mapUnitTextToInterval((baseSalary as any).unitText)

  const salaryParts = [
    salaryCurrency,
    salaryMin != null ? String(salaryMin) : null,
    salaryMax != null && salaryMax !== salaryMin ? String(salaryMax) : null,
    salaryInterval,
  ].filter(Boolean)

  return {
    salaryRaw: salaryParts.length ? salaryParts.join(' ') : null,
    salaryMin,
    salaryMax,
    salaryCurrency,
    salaryInterval,
  }
}

function flattenJsonLd(input: unknown): unknown[] {
  if (Array.isArray(input)) return input.flatMap(flattenJsonLd)
  if (!input || typeof input !== 'object') return []

  const node = input as Record<string, unknown>
  const graph = node['@graph']
  if (Array.isArray(graph)) {
    return [node, ...graph.flatMap(flattenJsonLd)]
  }

  return [node]
}

function parseJsonLdScripts(html: string): unknown[] {
  const $ = cheerio.load(html)
  const nodes: unknown[] = []

  $('script[type="application/ld+json"]').each((_index, element) => {
    const raw = $(element).text().trim()
    if (!raw) return

    try {
      const parsed = JSON.parse(raw)
      nodes.push(...flattenJsonLd(parsed))
    } catch {
      // Ignore malformed JSON-LD payloads.
    }
  })

  return nodes
}

export function extractStructuredJobsFromHtml(html: string, pageUrl: string): StructuredJobSnapshot[] {
  const nodes = parseJsonLdScripts(html)
  const jobs: StructuredJobSnapshot[] = []

  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue

    const typeValue = (node as any)['@type']
    const types = Array.isArray(typeValue) ? typeValue : [typeValue]
    const isJobPosting = types.some((value) => String(value || '').toLowerCase() === 'jobposting')
    if (!isJobPosting) continue

    const title = normalizeText((node as any).title)
    if (!title) continue

    const normalizedUrl = normalizeUrlOrNull((node as any).url, pageUrl) || pageUrl
    const salary = buildSalaryFromBaseSalary((node as any).baseSalary)
    const descriptionHtml = cleanJobDescriptionHtml(String((node as any).description || '')) || null
    const descriptionText = descriptionHtml ? stripJobHtmlTags(descriptionHtml) : null
    const employmentTypeValue = (node as any).employmentType
    const employmentType = Array.isArray(employmentTypeValue)
      ? normalizeText(String(employmentTypeValue[0] || '')) || null
      : normalizeText(String(employmentTypeValue || '')) || null

    jobs.push({
      title,
      url: normalizedUrl,
      applyUrl: normalizedUrl,
      descriptionHtml,
      descriptionText,
      locationText: buildLocationText((node as any).jobLocation),
      remote:
        normalizeText(String((node as any).jobLocationType || '')).toUpperCase() === 'TELECOMMUTE'
          ? true
          : null,
      salaryRaw: salary.salaryRaw,
      salaryMin: salary.salaryMin,
      salaryMax: salary.salaryMax,
      salaryCurrency: salary.salaryCurrency,
      salaryInterval: salary.salaryInterval,
      employmentType,
      postedAt: parseDateOrNull((node as any).datePosted),
      updatedAt: parseDateOrNull((node as any).dateModified),
      validThrough: parseDateOrNull((node as any).validThrough),
      raw: node,
    })
  }

  return jobs
}

function extractAbsoluteUrlsFromText(html: string, pageUrl: string): string[] {
  const urlMatches = html.match(/https?:\/\/[^\s"'<>]+/g) || []
  const normalized = urlMatches
    .map((value) => normalizeUrlOrNull(value, pageUrl))
    .filter((value): value is string => Boolean(value))

  return Array.from(new Set(normalized))
}

function detectAtsCandidates(urls: string[]): AnyAtsDiscovery[] {
  return urls.flatMap((url) => {
    const detected = detectAtsFromUrl(url)
    if (detected) {
      return [
        {
          url: detected.atsUrl,
          type: detected.provider as ATSType,
        },
      ]
    }

    const fallbackType = detectATS(url)
    if (fallbackType === 'generic') return []
    return [{ url, type: fallbackType }]
  })
}

export function findSupportedAtsFromHtml(html: string, pageUrl: string): SupportedAtsDiscovery | null {
  const $ = cheerio.load(html)
  const urls = new Set<string>()
  urls.add(pageUrl)

  $('a[href], iframe[src], link[href]').each((_index, element) => {
    const raw = $(element).attr('href') || $(element).attr('src')
    const normalized = normalizeUrlOrNull(raw, pageUrl)
    if (normalized) urls.add(normalized)
  })

  for (const extracted of extractAbsoluteUrlsFromText(html, pageUrl)) {
    urls.add(extracted)
  }

  const candidates = detectAtsCandidates([...urls])
  for (const candidate of candidates) {
    const normalized = detectAtsFromUrl(candidate.url)
    if (normalized) {
      return {
        type: normalized.provider as ATSType,
        provider: normalized.provider,
        url: normalized.atsUrl,
      }
    }
  }

  return null
}

export function findAnyAtsFromHtml(html: string, pageUrl: string): AnyAtsDiscovery | null {
  const supported = findSupportedAtsFromHtml(html, pageUrl)
  if (supported) return { type: supported.type, url: supported.url }

  const candidates = detectAtsCandidates(extractAbsoluteUrlsFromText(html, pageUrl))
  return candidates[0] ?? null
}

export function buildCareerCandidateUrls(website: string): string[] {
  const base = normalizeUrlOrNull(website, website)
  if (!base) return []

  const urls = new Set<string>()
  urls.add(base.replace(/\/+$/, ''))

  for (const path of CAREERS_PATH_CANDIDATES) {
    urls.add(new URL(path, base).toString().replace(/\/+$/, ''))
  }

  return [...urls]
}

export function extractLinkedCareerUrls(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html)
  const urls = new Set<string>()

  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href')
    const text = normalizeText($(element).text())
    if (!href) return
    if (!CAREERS_LINK_TEXT_RE.test(text) && !JOB_PATH_RE.test(href)) return

    const normalized = normalizeUrlOrNull(href, pageUrl)
    if (!normalized || !sameSiteHost(normalized, pageUrl)) return
    urls.add(normalized.replace(/\/+$/, ''))
  })

  return [...urls]
}

function scoreJobLink(text: string, href: string): number {
  let score = 0
  if (JOB_PATH_RE.test(href)) score += 2
  if (SALARY_SIGNAL_RE.test(text)) score += 2
  if (text.length >= 16) score += 1
  if (!GENERIC_LINK_TEXT_RE.test(text)) score += 1
  return score
}

function extractJobLinksFromAnchors(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html)
  const candidates: Array<{ url: string; score: number }> = []

  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href')
    const text = normalizeText($(element).text())
    if (!href || !text) return
    if (GENERIC_LINK_TEXT_RE.test(text)) return
    if (text.length < 6 || text.length > 180) return
    if (BLOCKED_LINK_RE.test(href)) return

    const normalized = normalizeUrlOrNull(href, pageUrl)
    if (!normalized || !sameSiteHost(normalized, pageUrl)) return
    if (!JOB_PATH_RE.test(new URL(normalized).pathname)) return

    const score = scoreJobLink(text, normalized)
    if (score < 3) return

    candidates.push({ url: normalized, score })
  })

  return Array.from(
    new Map(
      candidates
        .sort((a, b) => b.score - a.score)
        .map((candidate) => [candidate.url, candidate]),
    ).values(),
  )
    .slice(0, 40)
    .map((candidate) => candidate.url)
}

export function hasStrongHighSalarySignal(job: Partial<StructuredJobSnapshot>): boolean {
  if (job.salaryMin != null || job.salaryMax != null) {
    const normalized = normalizeSalary({
      min: job.salaryMin ?? null,
      max: job.salaryMax ?? null,
      currency: job.salaryCurrency ?? null,
      interval: job.salaryInterval ?? null,
    })
    const usdAnnual = estimateUsdAnnualFromNormalized(normalized)
    if (usdAnnual != null && usdAnnual >= 100_000) return true
  }

  const parsed = parseSalaryFromText(job.salaryRaw || job.descriptionText || job.descriptionHtml || null)
  if (!parsed) return false

  const normalized = normalizeSalary({
    min: parsed.min ?? null,
    max: parsed.max ?? null,
    currency: parsed.currency ?? null,
    interval: parsed.interval ?? null,
  })
  const usdAnnual = estimateUsdAnnualFromNormalized(normalized)
  return usdAnnual != null && usdAnnual >= 100_000
}

export function extractCareerPageSignals(html: string, pageUrl: string): CareerPageSignals {
  const structuredJobs = extractStructuredJobsFromHtml(html, pageUrl)
  const structuredUrls = structuredJobs
    .map((job) => job.url)
    .filter((value): value is string => Boolean(value && sameSiteHost(value, pageUrl)))

  const anchorLinks = extractJobLinksFromAnchors(html, pageUrl)
  const jobLinks = Array.from(new Set([...structuredUrls, ...anchorLinks])).slice(0, 40)
  const pageText = stripJobHtmlTags(html).slice(0, 12_000)
  const highSalarySignals =
    structuredJobs.filter((job) => hasStrongHighSalarySignal(job)).length +
    (SALARY_SIGNAL_RE.test(pageText) ? 1 : 0)

  return {
    structuredJobs,
    jobLinks,
    hasStructuredJobs: structuredJobs.length > 0,
    highSalarySignals,
  }
}

export function extractGenericJobDetail(html: string, pageUrl: string): StructuredJobSnapshot | null {
  const structured = extractStructuredJobsFromHtml(html, pageUrl)
  const primaryStructured = structured.find((job) => job.url === pageUrl) || structured[0] || null

  const $ = cheerio.load(html)
  const title =
    primaryStructured?.title ||
    normalizeText($('h1').first().text()) ||
    normalizeText($('title').first().text())

  if (!title) return null

  const descriptionSelectors = [
    '[data-testid=\"job-description\"]',
    '.job-description',
    '.description',
    '.job-content',
    'article',
    'main',
  ]

  let descriptionHtml = primaryStructured?.descriptionHtml || null
  if (!descriptionHtml) {
    for (const selector of descriptionSelectors) {
      const element = $(selector).first()
      const textLength = normalizeText(element.text()).length
      if (!element.length || textLength < 200) continue
      descriptionHtml = cleanJobDescriptionHtml(element.html() || '') || null
      if (descriptionHtml) break
    }
  }

  const descriptionText =
    primaryStructured?.descriptionText ||
    (descriptionHtml ? stripJobHtmlTags(descriptionHtml) : normalizeText($('main').text()) || null)

  const salaryFromText = parseSalaryFromText(
    [
      primaryStructured?.salaryRaw,
      normalizeText($('main').text()),
      normalizeText($('body').text()).slice(0, 5000),
    ]
      .filter(Boolean)
      .join(' '),
  )

  return {
    title,
    url: pageUrl,
    applyUrl: primaryStructured?.applyUrl || pageUrl,
    descriptionHtml,
    descriptionText,
    locationText: primaryStructured?.locationText || null,
    remote:
      primaryStructured?.remote ??
      (/remote|work from anywhere/i.test(descriptionText || '') ? true : null),
    salaryRaw: primaryStructured?.salaryRaw || salaryFromText?.raw || null,
    salaryMin: primaryStructured?.salaryMin ?? salaryFromText?.min ?? null,
    salaryMax: primaryStructured?.salaryMax ?? salaryFromText?.max ?? null,
    salaryCurrency: primaryStructured?.salaryCurrency ?? salaryFromText?.currency ?? null,
    salaryInterval: primaryStructured?.salaryInterval ?? salaryFromText?.interval ?? null,
    employmentType: primaryStructured?.employmentType || null,
    postedAt: primaryStructured?.postedAt || null,
    updatedAt: primaryStructured?.updatedAt || null,
    validThrough: primaryStructured?.validThrough || null,
    raw: primaryStructured?.raw || null,
  }
}

export async function fetchHtmlPage(
  url: string,
  timeoutMs = DEFAULT_DISCOVERY_TIMEOUT_MS,
): Promise<{ url: string; html: string } | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': DISCOVERY_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) return null

    return {
      url: response.url || url,
      html: await response.text(),
    }
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}
