import { prisma } from '../lib/prisma'
import { buildJobSlug, hasCanonicalJobShortId } from '../lib/jobs/jobSlug'
import {
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
} from '../lib/jobs/queryJobs'
import {
  buildIndexableJobStructureWhere,
  dedupeIndexableJobs,
  evaluateJobIndexability,
} from '../lib/jobs/qualityGate'
import { buildFreshJobWhere, MAX_INDEXABLE_JOB_AGE_DAYS } from '../lib/jobs/freshness'
import {
  buildCanonicalMissingDetail,
  isRetryableValidationFailure,
  summarizeRetryableFailures,
} from '../lib/seo/validatorRetry'

/**
 * SEO validator for sitemap integrity + indexability signals.
 *
 * Usage:
 *   npm run seo:validate
 *   npm run seo:validate:strict
 *
 * Env:
 *   SEO_BASE_URL=https://www.6figjobs.com
 *   SEO_SITEMAP_URL=https://www.6figjobs.com/sitemap.xml
 *   SEO_SAMPLE_PER_SITEMAP=200
 *   SEO_FULL=1
 *   SEO_STRICT=1
 *   SEO_TIMEOUT_MS=15000
 *   SEO_CONCURRENCY=12
 *   SEO_URL_RETRY_ATTEMPTS=2
 *   SEO_URL_RETRY_DELAY_MS=750
 */

type Failure = {
  reason: string
  sitemap: string
  sitemapSource: string
  url: string
  detail?: string
}

type SitemapBucket = {
  sitemapUrl: string
  sitemapSource: string
  urls: string[]
}

type DuplicateOccurrence = {
  url: string
  sitemap: string
  sitemapSource: string
}

type DuplicateConcept = {
  normalizedUrl: string
  occurrences: DuplicateOccurrence[]
}

type SitemapCollection = {
  buckets: SitemapBucket[]
  structureFailures: Failure[]
}

const BASE_URL = (process.env.SEO_BASE_URL || 'https://www.6figjobs.com').replace(/\/+$/, '')
const ROOT_SITEMAP_URL = (process.env.SEO_SITEMAP_URL || `${BASE_URL}/sitemap.xml`).trim()
const SAMPLE_PER_SITEMAP = Math.max(1, Number(process.env.SEO_SAMPLE_PER_SITEMAP || '200'))
const FULL = process.env.SEO_FULL === '1'
const STRICT = process.env.SEO_STRICT === '1'
const TIMEOUT_MS = Math.max(1000, Number(process.env.SEO_TIMEOUT_MS || '15000'))
const CONCURRENCY = Math.max(1, Math.min(64, Number(process.env.SEO_CONCURRENCY || '12')))
const URL_RETRY_ATTEMPTS = Math.max(0, Number(process.env.SEO_URL_RETRY_ATTEMPTS || '2'))
const URL_RETRY_DELAY_MS = Math.max(0, Number(process.env.SEO_URL_RETRY_DELAY_MS || '750'))
const SITEMAP_RETRY_ATTEMPTS = Math.max(
  0,
  Number(process.env.SEO_SITEMAP_RETRY_ATTEMPTS || process.env.SEO_URL_RETRY_ATTEMPTS || '2'),
)
const MIN_STRICT_SAMPLE = 1000
const JOB_SITEMAP_SOURCE = 'app/sitemap-jobs/[page]/route.ts:62'

const EXPECTED_ORIGIN = (() => {
  try {
    return new URL(BASE_URL).origin
  } catch {
    return null
  }
})()

const USE_DB_JOB_PROOF = (() => {
  const explicit = process.env.SEO_JOB_DB_PROOF
  if (explicit === '1') return true
  if (explicit === '0') return false

  try {
    const host = new URL(BASE_URL).hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return false
  }
})()

const INDEXING_PHASE = String(process.env.INDEXING_PHASE ?? '1').trim()
const IN_PHASE1 = INDEXING_PHASE === '1' || INDEXING_PHASE === ''

const SITEMAP_ROUTE_HINTS: Array<{ pattern: RegExp; source: string }> = [
  { pattern: /^\/sitemap\.xml$/i, source: 'app/sitemap.xml/route.ts:21' },
  { pattern: /^\/sitemap-jobs\.xml$/i, source: 'app/sitemap-jobs.xml/route.ts:46' },
  { pattern: /^\/sitemap-jobs\/[^/]+$/i, source: 'app/sitemap-jobs/[page]/route.ts:62' },
  { pattern: /^\/sitemap-company\.xml$/i, source: 'app/sitemap-company.xml/route.ts:50' },
  { pattern: /^\/sitemap-company\/[^/]+$/i, source: 'app/sitemap-company/[page]/route.ts:61' },
  { pattern: /^\/sitemap-city\.xml$/i, source: 'app/sitemap-city.xml/route.ts:16' },
  { pattern: /^\/sitemap-remote\.xml$/i, source: 'app/sitemap-remote.xml/route.ts:36' },
  { pattern: /^\/sitemap-salary\.xml$/i, source: 'app/sitemap-salary.xml/route.ts:10' },
  { pattern: /^\/sitemap-country\.xml$/i, source: 'app/sitemap-country.xml/route.ts:10' },
  { pattern: /^\/sitemap-category\.xml$/i, source: 'app/sitemap-category.xml/route.ts:9' },
  { pattern: /^\/sitemap-level\.xml$/i, source: 'app/sitemap-level.xml/route.ts:9' },
  { pattern: /^\/sitemap-browse\.xml$/i, source: 'app/sitemap-browse.xml/route.ts:23' },
  { pattern: /^\/sitemap-slices\.xml$/i, source: 'app/sitemap-slices.xml/route.ts:12' },
  { pattern: /^\/sitemap-slices\/priority$/i, source: 'app/sitemap-slices/priority/route.ts:48' },
  { pattern: /^\/sitemap-slices\/longtail$/i, source: 'app/sitemap-slices/longtail/route.ts:49' },
  { pattern: /^\/sitemap-blog\.xml$/i, source: 'app/sitemap-blog.xml/route.ts:9' },
  { pattern: /^\/sitemap-skills\.xml$/i, source: 'app/sitemap-skills.xml/route.ts:21' },
]

const LEGACY_ALIAS_PATH_HINTS: Array<{ pattern: RegExp; note: string }> = [
  { pattern: /^\/job-alias(?:\/|$)/i, note: 'job alias helper route' },
  { pattern: /^\/job-alias-old-id(?:\/|$)/i, note: 'old id helper route' },
  { pattern: /^\/s(?:\/|$)/i, note: 'shortlink helper route' },
  { pattern: /^\/jobs\/location\/remote(?:\/|$)/i, note: 'legacy remote helper route' },
  { pattern: /^\/jobs\/[^/]+\/country\/[^/]+\/?$/i, note: 'country helper redirect route' },
]

const REPORT_REASON_ORDER = [
  'redirect',
  'non_200',
  'robots_noindex',
  'canonical_missing',
  'canonical_mismatch',
  'empty_sitemap',
  'no_urls_discovered',
  'no_url_sitemaps',
  'invalid_sitemap_xml',
  'duplicate_loc',
  'expired_job_in_sitemap',
  'expired_job_not_404',
]

let cachedIndexableJobUrlSetPromise: Promise<Set<string>> | null = null

function inferSitemapSource(sitemapUrl: string): string {
  try {
    const pathname = new URL(sitemapUrl).pathname
    const hit = SITEMAP_ROUTE_HINTS.find((row) => row.pattern.test(pathname))
    return hit?.source || 'unknown_sitemap_source'
  } catch {
    return 'unknown_sitemap_source'
  }
}

function normalizeComparableUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/+$/, '') || '/'
    const query = u.search
    return `${u.protocol}//${u.host}${path}${query}`
  } catch {
    return String(url || '').trim()
  }
}

function normalizeForDuplicatePolicy(url: string): string {
  try {
    const u = new URL(url)
    const protocol = u.protocol.toLowerCase()
    const host = u.host.toLowerCase()
    const path = (u.pathname || '/')
      .replace(/\/{2,}/g, '/')
      .replace(/\/+$/, '')
      .toLowerCase() || '/'
    const query = u.search
    return `${protocol}//${host}${path}${query}`
  } catch {
    return String(url || '').trim().toLowerCase()
  }
}

function parseLocs(xml: string): string[] {
  const out: string[] = []
  const re = /<loc>([^<]+)<\/loc>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(xml)) !== null) {
    const loc = String(match[1] || '').trim()
    if (loc) out.push(loc)
  }
  return out
}

function detectSitemapType(xml: string): 'index' | 'urlset' | 'unknown' {
  if (/<sitemapindex\b/i.test(xml)) return 'index'
  if (/<urlset\b/i.test(xml)) return 'urlset'
  return 'unknown'
}

function pickSample(urls: string[]): string[] {
  if (FULL || urls.length <= SAMPLE_PER_SITEMAP) return urls
  const sorted = [...urls].sort()
  const stride = Math.max(1, Math.floor(sorted.length / SAMPLE_PER_SITEMAP))
  const sample: string[] = []
  for (let i = 0; i < sorted.length && sample.length < SAMPLE_PER_SITEMAP; i += stride) {
    sample.push(sorted[i])
  }
  return sample
}

function hasNoindexDirective(raw: string | null | undefined): boolean {
  return /\bnoindex\b/i.test(String(raw || ''))
}

function extractCanonical(html: string, pageUrl: string): string | null {
  const m = html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i)
  if (!m?.[0]) return null

  const hrefMatch = m[0].match(/href=["']([^"']+)["']/i)
  if (!hrefMatch?.[1]) return null

  try {
    return new URL(hrefMatch[1], pageUrl).toString()
  } catch {
    return null
  }
}

function extractMetaRobotsDirectives(html: string): string[] {
  const directives: string[] = []
  const re = /<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const value = String(match[1] || '')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
    directives.push(...value)
  }
  return directives
}

function buildFailure(
  reason: string,
  sitemap: string,
  sitemapSource: string,
  url: string,
  detail?: string,
): Failure {
  return { reason, sitemap, sitemapSource, url, detail }
}

function summarizeHttpBody(body: string, max: number = 180): string {
  const normalized = String(body || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.slice(0, max)
}

function formatHttpError(res: Response, body: string): string {
  const details = [`status=${res.status}`]
  const contentType = res.headers.get('content-type')
  const bodySummary = summarizeHttpBody(body)

  if (contentType) {
    details.push(`content-type=${contentType}`)
  }

  if (bodySummary) {
    details.push(`body=${JSON.stringify(bodySummary)}`)
  }

  return details.join(' ')
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableValidationError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase()
  return (
    message.includes('body_read_timeout') ||
    message.includes('operation was aborted') ||
    message.includes('this operation was aborted') ||
    message.includes('terminated') ||
    message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('timedout') ||
    message.includes('socket hang up') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('socket')
  )
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= SITEMAP_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'seo-validator/1.0',
          accept: 'application/xml,text/xml,text/html;q=0.9,*/*;q=0.8',
        },
      })
      const body = await readBodyTextWithTimeout(res)

      if (!res.ok) {
        throw new Error(formatHttpError(res, body))
      }

      return body
    } catch (error) {
      lastError = error
      if (attempt >= SITEMAP_RETRY_ATTEMPTS || !isRetryableValidationError(error)) {
        throw error
      }

      const retryNumber = attempt + 1
      const detail = summarizeRetryableFailures([String((error as Error)?.message || error)])
      console.warn(
        `[seo:validate] transient sitemap fetch failure; retrying ${retryNumber}/${SITEMAP_RETRY_ATTEMPTS} ${url} (${detail})`,
      )
      await sleep(URL_RETRY_DELAY_MS * Math.pow(2, attempt))
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError ?? new Error(`Unable to fetch sitemap: ${url}`)
}

async function fetchManual(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'seo-validator/1.0',
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchFollow(url: string, accept: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'seo-validator/1.0',
        accept,
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function readBodyTextWithTimeout(res: Response): Promise<string> {
  const timeout = Math.max(1000, TIMEOUT_MS)
  return await Promise.race<string>([
    res.text(),
    new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('body_read_timeout')), timeout)
    }),
  ])
}

function detectLegacyAliasPath(pathname: string): string | null {
  const hit = LEGACY_ALIAS_PATH_HINTS.find((row) => row.pattern.test(pathname))
  return hit?.note || null
}

type SitemapJobRow = {
  id: string
  shortId: string | null
  externalId: string | null
  title: string
  roleSlug: string | null
  company: string | null
  companyId: string | null
  locationRaw: string | null
  citySlug: string | null
  countryCode: string | null
  remote: boolean | null
  remoteMode: string | null
  descriptionHtml: string | null
  aiSnippet: string | null
  aiOneLiner: string | null
  salaryValidated: boolean | null
  salaryConfidence: number | null
  salaryCurrency: string | null
  salaryPeriod: string | null
  minAnnual: bigint | null
  maxAnnual: bigint | null
  currency: string | null
  isExpired: boolean
  lastSeenAt: Date | null
  postedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

async function getIndexableJobUrlSet(): Promise<Set<string>> {
  if (!cachedIndexableJobUrlSetPromise) {
    cachedIndexableJobUrlSetPromise = (async () => {
      const where = {
        isExpired: false,
        shortId: { not: null },
        AND: [
          buildGlobalExclusionsWhere(),
          buildHighSalaryEligibilityWhere(),
          buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS),
          buildIndexableJobStructureWhere(),
        ],
      }

      const jobs = (await prisma.job.findMany({
        where,
        select: {
          id: true,
          shortId: true,
          externalId: true,
          title: true,
          roleSlug: true,
          company: true,
          companyId: true,
          locationRaw: true,
          citySlug: true,
          countryCode: true,
          remote: true,
          remoteMode: true,
          descriptionHtml: true,
          aiSnippet: true,
          aiOneLiner: true,
          salaryValidated: true,
          salaryConfidence: true,
          salaryCurrency: true,
          salaryPeriod: true,
          minAnnual: true,
          maxAnnual: true,
          currency: true,
          isExpired: true,
          lastSeenAt: true,
          postedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      })) as SitemapJobRow[]

      const deduped = dedupeIndexableJobs(
        jobs.filter(
          (job) => hasCanonicalJobShortId(job) && evaluateJobIndexability(job).indexable,
        ),
      )

      const urls = deduped.map((job) => {
        const slug = buildJobSlug({ id: job.id, title: job.title })
        return normalizeComparableUrl(`${BASE_URL}/job/${slug}`)
      })

      return new Set(urls)
    })()
  }

  return await cachedIndexableJobUrlSetPromise
}

async function checkUrl(url: string, sitemapUrl: string, sitemapSource: string): Promise<Failure[]> {
  const failures: Failure[] = []
  const normalizedUrl = normalizeComparableUrl(url)

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    failures.push(buildFailure('invalid_url', sitemapUrl, sitemapSource, url))
    return failures
  }

  if (EXPECTED_ORIGIN && parsed.origin !== EXPECTED_ORIGIN) {
    failures.push(
      buildFailure(
        'origin_mismatch',
        sitemapUrl,
        sitemapSource,
        url,
        `expected_origin=${EXPECTED_ORIGIN} actual_origin=${parsed.origin}`,
      ),
    )
  }

  if (parsed.search) {
    const allowedParams = ['page']
    const keys = Array.from(parsed.searchParams.keys())
    const invalidKeys = keys.filter((k) => !allowedParams.includes(k))

    if (invalidKeys.length > 0) {
      failures.push(
        buildFailure('loc_has_query', sitemapUrl, sitemapSource, url, `invalid_query=${parsed.search}`),
      )
    }
  }

  const aliasNote = detectLegacyAliasPath(parsed.pathname)
  if (aliasNote) {
    failures.push(buildFailure('legacy_alias_url', sitemapUrl, sitemapSource, url, aliasNote))
  }

  if (USE_DB_JOB_PROOF && sitemapSource === JOB_SITEMAP_SOURCE) {
    const indexableJobUrls = await getIndexableJobUrlSet()
    if (!indexableJobUrls.has(normalizedUrl)) {
      failures.push(
        buildFailure(
          'job_db_proof_mismatch',
          sitemapUrl,
          sitemapSource,
          url,
          'url not present in DB-derived indexable canonical set',
        ),
      )
    }
    return failures
  }

  const htmlRes = await fetchFollow(url, 'text/html,application/xhtml+xml,*/*;q=0.8')

  if (!htmlRes.ok) {
    failures.push(
      buildFailure(
        'non_200',
        sitemapUrl,
        sitemapSource,
        url,
        `html_status=${htmlRes.status}`,
      ),
    )
    return failures
  }

  const finalUrl = htmlRes.url || url
  const finalNorm = normalizeComparableUrl(finalUrl)
  if (finalNorm !== normalizedUrl) {
    failures.push(
      buildFailure(
        'redirect',
        sitemapUrl,
        sitemapSource,
        url,
        `GET followed to ${finalNorm}`,
      ),
    )
    return failures
  }

  if (hasNoindexDirective(htmlRes.headers.get('x-robots-tag'))) {
    failures.push(
      buildFailure(
        'robots_noindex',
        sitemapUrl,
        sitemapSource,
        url,
        `x-robots-tag=${htmlRes.headers.get('x-robots-tag')}`,
      ),
    )
  }

  const contentType = (htmlRes.headers.get('content-type') || '').toLowerCase()
  const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml')
  if (!isHtml) return failures

  const html = await readBodyTextWithTimeout(htmlRes)
  const directives = extractMetaRobotsDirectives(html)
  if (directives.includes('noindex')) {
    failures.push(buildFailure('robots_noindex', sitemapUrl, sitemapSource, url, 'meta robots noindex'))
  }

  const canonical = extractCanonical(html, finalUrl)
  if (!canonical) {
    failures.push(
      buildFailure(
        'canonical_missing',
        sitemapUrl,
        sitemapSource,
        url,
        buildCanonicalMissingDetail(html),
      ),
    )
    return failures
  }

  const canonicalNorm = normalizeComparableUrl(canonical)
  if (canonicalNorm !== normalizedUrl) {
    failures.push(
      buildFailure(
        'canonical_mismatch',
        sitemapUrl,
        sitemapSource,
        url,
        `expected=${normalizedUrl} canonical=${canonicalNorm}`,
      ),
    )

    const canonicalHead = await fetchManual(canonical, 'HEAD')
    if (canonicalHead.status >= 300 && canonicalHead.status < 400) {
      failures.push(
        buildFailure(
          'canonical_redirects',
          sitemapUrl,
          sitemapSource,
          url,
          `${canonicalHead.status} -> ${canonicalHead.headers.get('location') || 'unknown'}`,
        ),
      )
    } else if (canonicalHead.status !== 200) {
      failures.push(
        buildFailure(
          'canonical_non_200',
          sitemapUrl,
          sitemapSource,
          url,
          String(canonicalHead.status),
        ),
      )
    }
  }

  return failures
}

async function checkUrlWithRetry(
  url: string,
  sitemapUrl: string,
  sitemapSource: string,
): Promise<Failure[]> {
  let lastError: unknown

  for (let attempt = 0; attempt <= URL_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const result = await checkUrl(url, sitemapUrl, sitemapSource)
      const retryableFailures = result.filter(isRetryableValidationFailure)

      if (retryableFailures.length > 0 && retryableFailures.length === result.length) {
        if (attempt >= URL_RETRY_ATTEMPTS) {
          return result
        }

        const retryNumber = attempt + 1
        console.warn(
          `[seo:validate] transient validation failure; retrying ${retryNumber}/${URL_RETRY_ATTEMPTS} ${url} (${summarizeRetryableFailures(retryableFailures)})`,
        )
        await sleep(URL_RETRY_DELAY_MS * Math.pow(2, attempt))
        continue
      }

      return result
    } catch (error) {
      lastError = error
      if (attempt >= URL_RETRY_ATTEMPTS || !isRetryableValidationError(error)) {
        throw error
      }

      const retryNumber = attempt + 1
      const detail = String((error as any)?.message || error || 'unknown_error')
      console.warn(
        `[seo:validate] transient check error; retrying ${retryNumber}/${URL_RETRY_ATTEMPTS} ${url} (${detail})`,
      )
      await sleep(URL_RETRY_DELAY_MS * Math.pow(2, attempt))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'unknown_error'))
}

async function collectSitemapBuckets(rootUrl: string): Promise<SitemapCollection> {
  const seen = new Set<string>()
  const buckets: SitemapBucket[] = []
  const structureFailures: Failure[] = []

  async function walk(url: string): Promise<void> {
    if (seen.has(url)) return
    seen.add(url)

    const xml = await fetchText(url)
    const kind = detectSitemapType(xml)
    const locs = parseLocs(xml)
    const sitemapSource = inferSitemapSource(url)

    if (kind === 'index') {
      if (locs.length === 0) {
        if (IN_PHASE1 && normalizeComparableUrl(url) === normalizeComparableUrl(ROOT_SITEMAP_URL)) {
          console.log(
            `[seo:validate] skipping empty root sitemap index — INDEXING_PHASE=${INDEXING_PHASE} and no CI sitemap URLs are seeded`,
          )
          return
        }

        structureFailures.push(
          buildFailure(
            'empty_sitemap',
            url,
            sitemapSource,
            url,
            'sitemap index contains 0 <loc> entries',
          ),
        )
        return
      }

      for (const loc of locs) {
        await walk(loc)
      }
      return
    }

    if (kind === 'urlset') {
      if (locs.length === 0) {
        // Phase 1 sitemap silencing returns 200 OK with an empty <urlset>
        // intentionally — that's the indexing-rollout strategy, not a bug.
        // The marker comment is added by buildPhase1SilencedSitemapResponse
        // in lib/seo/indexingPhase.ts; we detect it here so the validator
        // doesn't fail the gate on a silencing-by-design empty payload.
        const phaseSilenced = /silenced by INDEXING_PHASE=/.test(xml)
        if (!phaseSilenced) {
          structureFailures.push(
            buildFailure(
              'empty_sitemap',
              url,
              sitemapSource,
              url,
              'urlset contains 0 <loc> entries',
            ),
          )
        }
      }

      buckets.push({
        sitemapUrl: url,
        sitemapSource,
        urls: locs,
      })
      return
    }

    structureFailures.push(
      buildFailure(
        'invalid_sitemap_xml',
        url,
        sitemapSource,
        url,
        'unknown sitemap XML format',
      ),
    )
  }

  await walk(rootUrl)
  return { buckets, structureFailures }
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return

  let index = 0
  const count = Math.min(CONCURRENCY, items.length)
  const runners = Array.from({ length: count }, async () => {
    while (true) {
      const i = index
      index += 1
      if (i >= items.length) break
      await worker(items[i])
    }
  })

  await Promise.all(runners)
}

function groupFailures(failures: Failure[]): Map<string, Failure[]> {
  const grouped = new Map<string, Failure[]>()
  for (const failure of failures) {
    const key = failure.reason
    const rows = grouped.get(key) || []
    rows.push(failure)
    grouped.set(key, rows)
  }
  return grouped
}

function collectDuplicateConcepts(buckets: SitemapBucket[]): DuplicateConcept[] {
  const byNormalized = new Map<string, DuplicateConcept>()

  for (const bucket of buckets) {
    for (const url of bucket.urls) {
      const normalizedUrl = normalizeForDuplicatePolicy(url)
      const existing = byNormalized.get(normalizedUrl)
      const occurrence: DuplicateOccurrence = {
        url,
        sitemap: bucket.sitemapUrl,
        sitemapSource: bucket.sitemapSource,
      }

      if (existing) {
        existing.occurrences.push(occurrence)
      } else {
        byNormalized.set(normalizedUrl, {
          normalizedUrl,
          occurrences: [occurrence],
        })
      }
    }
  }

  return Array.from(byNormalized.values())
    .filter((concept) => concept.occurrences.length > 1)
    .sort((a, b) => b.occurrences.length - a.occurrences.length)
}

function printDuplicateSummary(duplicates: DuplicateConcept[]) {
  console.log(`[seo:validate] duplicate normalized locs: ${duplicates.length}`)
  if (duplicates.length === 0) return

  const sample = duplicates.slice(0, 50)
  console.log('[seo:validate] first duplicate concepts:')
  for (const concept of sample) {
    console.log(`  • ${concept.normalizedUrl} (occurrences=${concept.occurrences.length})`)
    for (const occ of concept.occurrences) {
      console.log(
        `    - ${occ.url} [from ${occ.sitemap} -> ${occ.sitemapSource}]`,
      )
    }
  }

  if (duplicates.length > sample.length) {
    console.log(`[seo:validate] ...and ${duplicates.length - sample.length} more duplicate concepts`)
  }
}

function printGroupedFailures(failures: Failure[]) {
  if (failures.length === 0) {
    console.log('\n[seo:validate] PASS: no failures found')
    console.log('[seo:validate] failure counts:')
    for (const reason of REPORT_REASON_ORDER) {
      console.log(`  - ${reason}: 0`)
    }
    return
  }

  const grouped = groupFailures(failures)
  const reasons = Array.from(
    new Set([...REPORT_REASON_ORDER, ...Array.from(grouped.keys()).sort()]),
  )

  console.log(`\n[seo:validate] FAILURES (${failures.length})`)
  console.log('[seo:validate] failure counts:')
  for (const reason of reasons) {
    const rows = grouped.get(reason) || []
    console.log(`  - ${reason}: ${rows.length}`)
  }

  for (const reason of reasons) {
    const rows = grouped.get(reason) || []
    console.log(`\n- ${reason}: ${rows.length}`)
    rows.slice(0, 20).forEach((row) => {
      const detail = row.detail ? ` (${row.detail})` : ''
      console.log(
        `  • ${row.url} [from ${row.sitemap} -> ${row.sitemapSource}]${detail}`,
      )
    })
    if (rows.length > 20) {
      console.log(`  • ...and ${rows.length - 20} more`)
    }
  }
}

let validationExitCode = 0

async function main() {
  if (STRICT && !FULL && SAMPLE_PER_SITEMAP < MIN_STRICT_SAMPLE) {
    throw new Error(
      `SEO_STRICT=1 requires SEO_FULL=1 or SEO_SAMPLE_PER_SITEMAP>=${MIN_STRICT_SAMPLE}. got=${SAMPLE_PER_SITEMAP}`,
    )
  }

  console.log('[seo:validate] starting')
  console.log(`[seo:validate] root sitemap: ${ROOT_SITEMAP_URL}`)
  console.log(`[seo:validate] base url: ${BASE_URL}`)
  console.log(`[seo:validate] strict mode: ${STRICT ? 'on' : 'off'}`)
  console.log(`[seo:validate] full mode: ${FULL ? 'on' : 'off'}`)
  console.log(`[seo:validate] sample per sitemap: ${SAMPLE_PER_SITEMAP}`)
  console.log(`[seo:validate] concurrency: ${CONCURRENCY}`)
  console.log(`[seo:validate] per-url retries: ${URL_RETRY_ATTEMPTS}`)
  console.log(`[seo:validate] db job proof mode: ${USE_DB_JOB_PROOF ? 'on' : 'off'}`)

  const { buckets, structureFailures } = await collectSitemapBuckets(ROOT_SITEMAP_URL)
  const rootSitemapSource = inferSitemapSource(ROOT_SITEMAP_URL)
  const failures: Failure[] = [...structureFailures]

  if (buckets.length === 0 && !IN_PHASE1) {
    failures.push(
      buildFailure(
        'no_url_sitemaps',
        ROOT_SITEMAP_URL,
        rootSitemapSource,
        ROOT_SITEMAP_URL,
        'no URL sitemap buckets discovered',
      ),
    )
  } else if (buckets.length === 0) {
    console.log(
      `[seo:validate] skipping no_url_sitemaps — INDEXING_PHASE=${INDEXING_PHASE} and no CI sitemap URLs are seeded`,
    )
  }

  const totalUrls = buckets.reduce((acc, b) => acc + b.urls.length, 0)
  console.log(`[seo:validate] discovered sitemaps: ${buckets.length}`)
  console.log(`[seo:validate] discovered urls: ${totalUrls}`)

  // Phase 1 silences most sitemap families by design. In a build-time
  // validation against a freshly-built app with no DB rows, the surviving
  // families (jobs/company/salary) may all return empty urlsets too — that's
  // expected, not a failure. Skip the `no_urls_discovered` gate when
  // INDEXING_PHASE=1 is in effect.
  if (totalUrls === 0 && !IN_PHASE1) {
    failures.push(
      buildFailure(
        'no_urls_discovered',
        ROOT_SITEMAP_URL,
        rootSitemapSource,
        ROOT_SITEMAP_URL,
        `url_sitemaps=${buckets.length}`,
      ),
    )
  } else if (totalUrls === 0) {
    console.log(
      `[seo:validate] skipping no_urls_discovered — INDEXING_PHASE=${INDEXING_PHASE} (Phase 1 silences sitemap families by design)`,
    )
  }

  const duplicates = collectDuplicateConcepts(buckets)
  printDuplicateSummary(duplicates)

  if (buckets.length === 0) {
    printGroupedFailures(failures)
    process.exitCode = 1
    return
  }

  for (const duplicate of duplicates) {
    const first = duplicate.occurrences[0]
    failures.push(
      buildFailure(
        'duplicate_loc',
        first.sitemap,
        first.sitemapSource,
        first.url,
        `normalized=${duplicate.normalizedUrl} occurrences=${duplicate.occurrences.length}`,
      ),
    )
  }

  for (const bucket of buckets) {
    const sample = pickSample(bucket.urls)
    console.log(
      `\n[seo:validate] checking ${sample.length}/${bucket.urls.length} urls from ${bucket.sitemapUrl} (${bucket.sitemapSource})`,
    )

    await runWithConcurrency(sample, async (url) => {
      try {
        const result = await checkUrlWithRetry(url, bucket.sitemapUrl, bucket.sitemapSource)
        if (result.length > 0) failures.push(...result)
      } catch (error: any) {
        failures.push(
          buildFailure(
            'check_failed',
            bucket.sitemapUrl,
            bucket.sitemapSource,
            url,
            error?.message || String(error),
          ),
        )
      }
    })
  }

  if (process.env.DATABASE_URL) {
    console.log('\n[seo:validate] database url present, checking expired jobs status')
    try {
      const expiredJobs = await prisma.job.findMany({
        where: { isExpired: true },
        select: { id: true, title: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      })
      console.log(`[seo:validate] testing status of ${expiredJobs.length} expired jobs`)
      
      const sitemapUrlsSet = new Set(
        buckets.flatMap((b) => b.urls.map((u) => normalizeComparableUrl(u)))
      )

      await runWithConcurrency(expiredJobs, async (job) => {
        const slug = buildJobSlug({ id: job.id, title: job.title })
        const url = `${BASE_URL}/job/${slug}`
        const normalized = normalizeComparableUrl(url)

        if (sitemapUrlsSet.has(normalized)) {
          failures.push(
            buildFailure(
              'expired_job_in_sitemap',
              'sitemap.xml',
              'database',
              url,
              'Expired job found in active sitemap',
            )
          )
        }

        try {
          const res = await fetchManual(url, 'GET')
          if (res.status !== 404 && res.status !== 410) {
            failures.push(
              buildFailure(
                'expired_job_not_404',
                'database',
                'database',
                url,
                `Expired job returned status=${res.status} instead of 404/410`,
              )
            )
          }
        } catch (err: any) {
          failures.push(
            buildFailure(
              'expired_job_check_failed',
              'database',
              'database',
              url,
              err?.message || String(err),
            )
          )
        }
      })
    } catch (dbErr: any) {
      console.error('[seo:validate] failed to check expired jobs:', dbErr)
    }
  }

  printGroupedFailures(failures)

  validationExitCode = failures.length > 0 ? 1 : 0
}

main()
  .catch((error) => {
    console.error('[seo:validate] fatal error:', error)
    validationExitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
    console.log(`[seo:validate] exiting with code ${validationExitCode}`)
    process.exit(validationExitCode)
  })
