// lib/scrapers/freehire.ts
// Pulls six-figure jobs from the freehire.me public API (https://freehire.me/docs/api) for the
// US (any location, USD), UK, EU, Canada, Australia and Switzerland (CHF). The minimum salary per currency comes from
// lib/currency/thresholds.ts. FREEHIRE_API_KEY (an API plan) is needed for the employer's own links (fetchOriginalLink).
import axios from 'axios'

import { getSalaryFloorAnnual } from '../currency/thresholds'
import { ingestBoardJob, type BoardJobInput } from '../jobs/ingestBoardJob'
import { normalizePublicCompanyWebsite } from '../companies/website'
import { repairCompanyName } from '../companies/repairCompanyName'
import { readPayFromDescription } from '../jobs/payEvidence'
import { getMinimumSalaryRejection } from '../jobs/salaryPublicationGate'
import { addBoardIngestResult, type ScraperStats } from './scraperStats'
import { freehireCountryCodes, freehireStructuredLocationText } from './freehireStructured'
import {
  companiesToLookUp,
  freehireCompanyKey,
  loadKnownCompanies,
  markWebsiteChecked,
  saveCompanyProfiles,
  WEBSITE_RECHECK_DAYS,
  type CompanyProfile,
} from './freehireCompanyWebsites'
import { toSiteSizeBucket } from '../companies/sizeBucket'
import { decodeJobHtmlEntities } from '../jobs/descriptionCleaning'
import { cleanJobTitle } from '../jobs/cleanTitle'

const BOARD = 'freehire'
// The /agent/ variant takes the same filters and returns the same jobs, but each carries its description in full.
// Plain /jobs/search only returns a preview cut at ~1,000 characters (the qualifications never reached our pages).
const API_URL = 'https://freehire.me/api/v1/agent/jobs/search'
const PAGE_SIZE = 100
/** Oldest a posting may be and still be listed, when freehire has not flagged it as a re-stamped old job. */
export const MAX_LISTED_AGE_DAYS = 30
// freehire refuses offset + limit > 10000, so one query can reach at most this many newest jobs.
const MAX_OFFSET = 10_000
const LOOKBACK_DAYS = Number(process.env.FREEHIRE_LOOKBACK_DAYS) || 30
// freehire's API docs (freehire.me/docs/api, "API plans", read 2026-11-22): the API plan allows 1,200 requests a minute
// with no daily cap (300 without a plan key), and "requests carrying offset ... pass through separate per-IP nginx limits
// of 2 requests per second each, including paid requests" (bursts of 50 allowed). Every search page carries offset, so
// one request at a time with at least this gap never goes over 2 a second, however fast freehire answers.
const PAGE_DELAY_MS = 500
// Companies written to the database at once by ingestFreehireJobs. Below the 5-connection Prisma pool the sync scripts
// get outside production (lib/prisma.ts), so no write waits for a free connection.
const INGEST_CONCURRENCY = 4

/**
 * One query per currency. `geo` narrows by freehire's region/country facets (unset = anywhere). `lookbackDays` gives a
 * query its own, longer window than FREEHIRE_LOOKBACK_DAYS (the daily run reads 1.5 days).
 */
export type FreehireMarket = {
  currency: string
  geo: Record<string, string>
  label?: string
  lookbackDays?: number
  /** Ask without any salary filter, to find jobs whose posting states the pay but freehire's fields do not. */
  anyPay?: boolean
  /** Most pages this market reads in one run (default: until the window ends or freehire's 10,000-row limit). */
  maxPages?: number
  /** Read only the jobs freehire first saw in this many hours, whatever the run's window (the description slices). */
  windowHours?: number
}

// Worldwide-remote jobs (freehire's `regions=global`), read over 30 days. The daily 1.5-day window missed most of them
// for good (a missed run, or a job freehire found days after its posting date): on 2026-11-09 freehire had 57 jobs at
// $100k+ whose location says worldwide, and the site showed 6. All of them fit in a few pages (USD 254, CAD 5, EUR 4,
// GBP 3 at the pay floor).
const WORLDWIDE_MARKETS: FreehireMarket[] = ['USD', 'EUR', 'GBP', 'CAD'].map((currency) => ({
  currency,
  geo: { regions: 'global' },
  label: `${currency} worldwide`,
  lookbackDays: MAX_LISTED_AGE_DAYS,
}))

export const FREEHIRE_MARKETS: ReadonlyArray<FreehireMarket> = [
  { currency: 'USD', geo: {} },
  { currency: 'GBP', geo: { regions: 'uk' } },
  { currency: 'EUR', geo: { regions: 'eu' } },
  { currency: 'CAD', geo: { countries: 'ca' } },
  { currency: 'AUD', geo: { countries: 'au' } },
  // Swiss-franc jobs are Swiss; freehire has no region facet for them. About 580 listable jobs in the last 30 days
  // (measured 2026-11-07 with correct paging).
  { currency: 'CHF', geo: {} },
  ...WORLDWIDE_MARKETS,
]

/**
 * freehire's newest jobs with NO salary filter, so jobs whose pay is only in the posting text are seen too (2026-11-15
 * audit: 82% of freehire's jobs carry no pay in its fields, and the description states a yearly range for about 1.8% of
 * them). Only jobs without freehire pay fields are taken from this pass; mapFreehireJob reads the range with
 * lib/jobs/payEvidence.ts and keeps the sentence.
 *
 * Each slice reads the jobs freehire FIRST SAW in the last DESCRIPTION_WINDOW_HOURS (sort=created_at; runs come about
 * every 5.5 hours, so the windows overlap), and must stay under freehire's 10,000 rows a query. Until 2026-11-24 the US,
 * EU and rest-of-world slices each hit that ceiling and read only their newest 3-6 hours (the sync of 2026-11-23 18:48:
 * EU and rest fetched 10,000 rows covering 6.5 of 18 hours). Volumes measured 2026-11-24 with open_within_days=1, jobs a
 * day: US 45,358 = tech 6,608 + non-tech 23,867 (remote/hybrid/on-site 5,951, mode not stated 17,916) + type not
 * stated 14,883; CA/AU/UK in English 15,031; EU in English 18,263; the rest of the world in English 49,476 = tech
 * 14,781 + non-tech 18,281 + type not stated 16,414; remote 13,797. Outside the US, CA/AU and the UK only English
 * postings are read: the quality gate refuses the others (non_english), so reading them only cost requests.
 * At 8 hours every slice is 1,000-6,000 rows, about 530 pages a run in all.
 *
 * Remote and worldwide overlap the others on purpose (owner's choice, 2026-11-22: "more remote and worldwide jobs");
 * the collection keeps each job once. Worldwide (`regions=global`) is small and reads its whole 30 days every run.
 */
export const DESCRIPTION_WINDOW_HOURS = 8
const US = { countries: 'us' }
const REST = { countries_exclude: 'us,ca,au', regions_exclude: 'uk,eu', posting_language: 'en' }
const slice = (label: string, geo: Record<string, string>, extra: Partial<FreehireMarket> = {}): FreehireMarket => ({
  currency: 'ANY',
  geo,
  label: `pay in description (${label})`,
  anyPay: true,
  maxPages: 100,
  windowHours: DESCRIPTION_WINDOW_HOURS,
  ...extra,
})
export const DESCRIPTION_PAY_MARKETS: ReadonlyArray<FreehireMarket> = [
  slice('US, tech', { ...US, is_tech: 'tech' }),
  slice('US, non-tech, mode stated', { ...US, is_tech: 'non_tech', work_mode: 'remote,hybrid,onsite' }),
  slice('US, non-tech, mode not stated', { ...US, is_tech: 'non_tech', work_mode_exclude: 'remote,hybrid,onsite' }),
  slice('US, type not stated', { ...US, is_tech_exclude: 'tech,non_tech' }),
  slice('CA, AU, UK', { countries: 'ca,au', regions: 'uk', posting_language: 'en' }),
  slice('EU', { regions: 'eu', countries_exclude: 'us,ca,au', regions_exclude: 'uk', posting_language: 'en' }),
  slice('rest, tech', { ...REST, is_tech: 'tech' }),
  slice('rest, non-tech', { ...REST, is_tech: 'non_tech' }),
  slice('rest, type not stated', { ...REST, is_tech_exclude: 'tech,non_tech' }),
  slice('remote', { work_mode: 'remote' }),
  { ...slice('worldwide', { regions: 'global' }), windowHours: undefined, lookbackDays: MAX_LISTED_AGE_DAYS },
]

export type FreehireJob = {
  public_slug: string
  external_id?: string | null
  url: string
  title: string
  company?: string | null
  company_slug?: string | null
  location?: string | null
  description?: string | null
  work_mode?: string | null
  /** freehire's structured geography: lower-case country codes and region codes ('global', 'eu', 'north_america', ...). */
  countries?: string[] | null
  regions?: string[] | null
  posted_at?: string | null
  /** When freehire first saw the posting. The sync reads by this date: freehire finds many jobs days after their posting date. */
  created_at?: string | null
  updated_at?: string | null
  closed_at?: string | null
  /** The source's last day to apply, inclusive (YYYY-MM-DD or a timestamp); absent when it states none. */
  application_deadline?: string | null
  /** Present and true only when the posting says an intermediary publishes it for a client. */
  via_recruiter?: boolean | null
  /** Present and true only when the posting states a government security-clearance requirement. */
  requires_clearance?: boolean | null
  /** The clearance levels stated ('secret', 'top_secret', 'ts_sci', 'public_trust', 'confidential', 'interim', 'other'). */
  clearance_levels?: string[] | null
  /** freehire's ghost-job evidence; `level` reads how strong it is (e.g. 'possible'). */
  ghost?: { level?: string | null; criteria?: string[] | null } | null
  /** Skill / technology slugs, e.g. ['python', 'react', 'terraform']. */
  skills?: string[] | null
  /** `salary_and_equity`, `equity_only` or `not_stated` (none read, not "no equity"); absent when unknown. */
  equity?: string | null
  /** Benefit slugs, e.g. ['health_insurance', 'unlimited_pto', 'retirement_plan']. */
  perks?: string[] | null
  /** freehire's own freshness verdict; `stale`/`fake_freshness` are old postings with a bumped date. */
  reality?: {
    class?: string | null
    age_days?: number | null
    fake_freshness?: boolean | null
    repost_count?: number | null
    mass_posting_count?: number | null
  } | null
  enrichment?: {
    employment_type?: string | null
    salary_min?: number | null
    salary_max?: number | null
    salary_currency?: string | null
    salary_period?: string | null
    visa_sponsorship?: boolean | null
    /** 'intern', 'junior', 'middle', 'senior', 'lead', 'staff', 'principal' or 'c_level'. */
    seniority?: string | null
    experience_years_min?: number | null
    /** 'none', 'bachelor', 'master' or 'phd'. */
    education_level?: string | null
    /** 'product', 'startup', 'outsource', 'outstaff', 'agency', 'inhouse' or 'government'. */
    company_type?: string | null
    /** The posting's requirements, one sentence each. (`priority` says "required" even for "preferred" lines, so it is not used.) */
    requirements?: Array<{ text?: string | null; priority?: string | null }> | null
  } | null
}

type FreehireResponse = {
  data: FreehireJob[]
  meta: { total: number; limit: number; offset: number; ignored_params?: unknown }
}

export type FreehireMarketReport = {
  currency: string
  available: number
  fetched: number
  mappable: number
  gateRejected: number
  /** Jobs freehire saw in the window but posted more than MAX_LISTED_AGE_DAYS ago (not listed). */
  tooOld: number
  oldest: string | null
  newest: string | null
  sample: string[]
  /** True only if paging ended because the window (or the result list) was exhausted, not because a cap was hit or a request failed. */
  complete: boolean
  /** Employer links read from /data/jobs/{slug} for this market's jobs. */
  linksRead: number
}

export type FreehireSyncOptions = {
  /** Fetch and map, but write nothing. */
  dryRun?: boolean
  /** Stop each market after this many pages (default: until lookback or freehire's paging cap). */
  maxPagesPerMarket?: number
  /** Only jobs posted at or after this moment (default: now minus FREEHIRE_LOOKBACK_DAYS). */
  since?: Date
  /** Also read DESCRIPTION_PAY_MARKETS (default true): 200 pages a run, too many for the 5-minute recent pull. */
  withDescriptionPay?: boolean
}

/** When freehire first saw the job; its posting date when freehire gives no first-seen date. */
export function firstSeen(job: Pick<FreehireJob, 'created_at' | 'posted_at'>): string | null {
  return job.created_at || job.posted_at || null
}

/** freehire tags outbound links with utm_source=freehire.me; drop only that tag. */
export function stripFreehireUtm(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.searchParams.get('utm_source') === 'freehire.me') {
      parsed.searchParams.delete('utm_source')
    }
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * freehire answers 200 and silently ignores filters it does not know. If our salary filter is
 * ignored the response is the whole catalogue, so refuse to ingest it.
 */
export function assertFiltersApplied(meta: FreehireResponse['meta']): void {
  if (meta.ignored_params) {
    throw new Error(`freehire ignored request params: ${JSON.stringify(meta.ignored_params)}`)
  }
}

/** Clean freehire's skill list: lowercase slugs, de-duplicated, at most 12, junk (empty / very long) dropped. */
export function normalizeFreehireSkills(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const skill = item.trim().toLowerCase()
    if (skill.length < 2 || skill.length > 40 || out.includes(skill)) continue
    out.push(skill)
    if (out.length === 12) break
  }
  return out
}

/**
 * Whether freehire's `reality` verdict allows listing a job. Bulk refreshes re-stamp old postings with a new
 * posted_at, so we trust this verdict, not the date. `fresh` means up to 14 days old; `stale` also covers ordinary
 * 15-60 day old postings that are still open (measured on 300 live USD jobs on 2026-11-05: 30 were 15-30 days old
 * and not flagged), while the re-stamped ones carry `fake_freshness` (91-146 days old). So: never a flagged job, and
 * `stale` only while it is within MAX_LISTED_AGE_DAYS. No verdict at all keeps the job.
 */
export function isListableByReality(reality: FreehireJob['reality']): boolean {
  if (!reality) return true
  if (reality.fake_freshness) return false
  if (reality.class === 'fresh') return true
  return reality.class === 'stale' && typeof reality.age_days === 'number' && reality.age_days <= MAX_LISTED_AGE_DAYS
}

/**
 * The posting's own last day to apply, as the moment it ends: a bare date ("2026-12-15") is inclusive, so the end of
 * that day in UTC. Null when there is none or it cannot be read.
 */
export function applicationDeadline(raw: string | null | undefined): Date | null {
  const v = raw?.trim()
  if (!v) return null
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T23:59:59.999Z`) : new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

/** Reposted this many times, a role is not published (see mapFreehireJob). */
export const MAX_REPOSTS = 10

/** What mapFreehireJob decides before it needs the job's link: the pay to list, or null if the job is not published. */
export function freehireListing(
  job: FreehireJob,
  now: number = Date.now(),
): { salaryMin: number; salaryMax: number | null; currency: string; payQuote: string | null; deadline: Date | null } | null {
  const e = job.enrichment ?? {}
  if (job.closed_at) return null
  // A posting whose own deadline has passed takes no more applications.
  const deadline = applicationDeadline(job.application_deadline)
  if (deadline && deadline.getTime() < now) return null
  if (!isListableByReality(job.reality)) return null
  // A role reposted again and again is an evergreen or pipeline posting more often than an opening (1 of 500 sampled
  // $100k+ US jobs, 2026-11-24, at 20). freehire's own ghost verdict is not sent by the search endpoint this reads.
  if ((job.reality?.repost_count ?? 0) >= MAX_REPOSTS) return null
  // Pay: freehire's own fields when it has any; only when it has NONE does the posting's own sentence stand in (a range
  // read by payEvidence, quoted and verified). Pay freehire has but we cannot use (monthly, an unqueried currency) is
  // never replaced by a reading of the text.
  let salaryMin: number
  let salaryMax: number | null
  let currency: string
  let payQuote: string | null = null
  if (typeof e.salary_min === 'number') {
    if (e.salary_period !== 'year') return null
    const c = e.salary_currency?.toUpperCase()
    if (!c || !FREEHIRE_MARKETS.some((m) => m.currency === c)) return null
    currency = c
    salaryMin = e.salary_min
    salaryMax = e.salary_max ?? null
  } else {
    const pay = readPayFromDescription(job.description, { countries: job.countries, location: job.location })
    if (!pay || !FREEHIRE_MARKETS.some((m) => m.currency === pay.currency)) return null
    currency = pay.currency
    salaryMin = pay.min
    salaryMax = pay.max
    payQuote = pay.quote
  }
  if (getMinimumSalaryRejection({ salaryMin, salaryMax, salaryCurrency: currency })) return null
  if (!job.title) return null
  return { salaryMin, salaryMax, currency, payQuote, deadline }
}

/** Map a freehire record to the board ingest input, or null if it must not be published. */
export function mapFreehireJob(job: FreehireJob, now: number = Date.now()): BoardJobInput | null {
  const listing = freehireListing(job, now)
  // `url` is the employer's own posting; the public reads leave it empty (see fetchOriginalLink).
  if (!listing || !job.url) return null
  const e = job.enrichment ?? {}
  const { salaryMin, salaryMax, currency, payQuote, deadline } = listing

  const url = stripFreehireUtm(job.url)
  // freehire sometimes has an ATS identifier where the employer's name should be (Amplitude's Ashby jobs came as
  // "9c26369c-d400-4eb7-a9b3-ab8f6469f9e8"). Recover the real name; a name that is only an id and cannot be recovered
  // means the job is skipped rather than published under an id.
  const given = (job.company ?? '').trim()
  const companyName = repairCompanyName({ name: given, applyUrl: url, descriptionHtml: job.description })
  if (given && !companyName) return null
  const repaired = companyName !== given
  return {
    externalId: job.external_id || job.public_slug,
    // Without "---" chains, the job's own city or pay typed into it (lib/jobs/cleanTitle.ts).
    title: cleanJobTitle(job.title, { location: job.location }),
    url,
    applyUrl: url,
    rawCompanyName: companyName,
    // The slug is only used to look the company's website up at freehire; an id-named company has none to find.
    companyRef: repaired ? null : job.company_slug || null,
    // freehire's text is often a bare "Remote" while its own fields say where (worldwide, which countries, which region);
    // without them a remote job's country was guessed from the company or the pay currency.
    locationText: freehireStructuredLocationText(job) ?? job.location ?? null,
    isRemote: job.work_mode === 'remote',
    // The structured work mode decides remote, hybrid or on-site in the ingest (processLocation). Without it a hybrid job read as on-site.
    workplaceType: job.work_mode === 'remote' || job.work_mode === 'hybrid' || job.work_mode === 'onsite' ? job.work_mode : null,
    // freehire's own country, when it lists exactly one: the ingest uses it only where the location text names none.
    countryCode: freehireCountryCodes(job.countries).length === 1 ? freehireCountryCodes(job.countries)[0] : null,
    employmentType: e.employment_type ?? null,
    salaryMin,
    salaryMax,
    salaryCurrency: currency,
    salaryInterval: 'year',
    // The sentence the pay was read from, kept as the job's raw salary text.
    ...(payQuote ? { raw: { salaryText: payQuote, salarySource: 'description' } } : {}),
    postedAt: job.posted_at ? new Date(job.posted_at) : null,
    updatedAt: job.updated_at ? new Date(job.updated_at) : null,
    descriptionHtml: job.description ?? null,
    sourceRef: job.public_slug || null,
    skills: normalizeFreehireSkills(job.skills),
    benefits: freehireBenefitLabels(job.perks),
    requirements: freehireRequirementTexts(e.requirements),
    visaSponsorship: e.visa_sponsorship === true,
    offersEquity: job.equity === 'salary_and_equity',
    // The source's deadline becomes the job's expiry and its JobPosting validThrough (else the ingest's 45-day default).
    validThrough: deadline,
    viaRecruiter: job.via_recruiter === true,
    requiresClearance: job.requires_clearance === true,
  }
}

const PERK_ACRONYMS: Record<string, string> = { pto: 'PTO', hsa: 'HSA', fsa: 'FSA', espp: 'ESPP', rsu: 'RSU', '401k': '401(k)', ira: 'IRA', eap: 'EAP', ppo: 'PPO', hmo: 'HMO' }

/** freehire's benefit slugs as readable labels ("unlimited_pto" -> "Unlimited PTO"); at most 12, no repeats. */
export function freehireBenefitLabels(perks: unknown): string[] {
  if (!Array.isArray(perks)) return []
  const out: string[] = []
  for (const raw of perks) {
    if (typeof raw !== 'string') continue
    const words = raw.trim().toLowerCase().replace(/[^a-z0-9_ -]/g, '').split(/[_\s-]+/).filter(Boolean)
    if (words.length === 0 || words.length > 6) continue
    const label = words.map((w, i) => PERK_ACRONYMS[w] ?? (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
    if (!out.includes(label)) out.push(label)
    if (out.length === 12) break
  }
  return out
}

/** The posting's requirement sentences from freehire: trimmed, 20 to 240 characters, no repeats, at most 8. */
export function freehireRequirementTexts(requirements: unknown): string[] {
  if (!Array.isArray(requirements)) return []
  const out: string[] = []
  for (const item of requirements) {
    const text = typeof (item as { text?: unknown })?.text === 'string' ? (item as { text: string }).text.replace(/\s+/g, ' ').trim() : ''
    if (text.length < 20 || text.length > 240 || out.includes(text)) continue
    out.push(text)
    if (out.length === 8) break
  }
  return out
}

/** Request headers for the freehire API (the key is optional; it only raises the rate limit). */
export function freehireHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': '6FigJobs/1.0 (+https://www.6figjobs.com)' }
  if (process.env.FREEHIRE_API_KEY) headers.Authorization = `Bearer ${process.env.FREEHIRE_API_KEY}`
  return headers
}

/** freehire's rate-limit headers on the last search page read (logged after a sync, to see how much budget is left). */
export let lastRateLimit: { limit?: string; remaining?: string; reset?: string } | null = null

async function fetchPage(market: FreehireMarket, offset: number): Promise<FreehireResponse> {
  const res = await axios.get<FreehireResponse>(API_URL, {
    headers: freehireHeaders(),
    timeout: 30_000,
    params: {
      ...(market.anyPay
        ? {}
        : {
            salary_currency: market.currency,
            salary_period: 'year',
            // The lowest bottom-of-range that can qualify (below the threshold for euro jobs, see TOP_OF_RANGE_CURRENCIES);
            // mapFreehireJob then applies the full rule, since freehire can only filter on the bottom.
            salary_min: getSalaryFloorAnnual(market.currency),
          }),
      // Newest first by the day freehire FIRST SAW the job, not its posting date: freehire finds many jobs days after
      // they were posted, and sorting by posting date put those behind the window, never read (about 800 USD $100k+ jobs
      // a day, 2026-11-24: of 1,847 first seen in a day, 927 were posted in the last two days).
      sort: 'created_at',
      order: 'desc',
      limit: PAGE_SIZE,
      offset,
      ...market.geo,
    },
  })
  const h = (res.headers ?? {}) as Record<string, string | undefined>
  lastRateLimit = { limit: h['x-ratelimit-limit'], remaining: h['x-ratelimit-remaining'], reset: h['x-ratelimit-reset'] }
  return res.data
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Longest rate-limit wait we will sit through. Anything longer means the quota is used up, not a short burst limit. */
export const MAX_RATE_LIMIT_WAIT_S = 120

/**
 * What to do with a 429: wait the (short) time freehire asks for, or give up when it asks for longer than
 * `capSeconds`. On 2026-11-05 freehire answered a sync with Retry-After 49611 (about 13.8 hours); the old code slept
 * through all of it, so the job sat idle until the 45-minute job timeout killed it.
 */
export function decideRateLimitWait(
  retryAfter: unknown,
  capSeconds: number = MAX_RATE_LIMIT_WAIT_S,
): { action: 'wait' | 'give-up'; seconds: number } {
  const n = Number(retryAfter)
  const seconds = Number.isFinite(n) && n >= 0 && retryAfter !== null && retryAfter !== undefined && retryAfter !== '' ? n : 20
  return { action: seconds > capSeconds ? 'give-up' : 'wait', seconds }
}

const NETWORK_RETRY_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE', 'ERR_SOCKET_CONNECTION_TIMEOUT'])

/**
 * fetchPage that waits out short 429 rate limits (Retry-After) and fails fast, with a clear message, on a long one, and
 * retries a dropped connection or a timeout up to 3 times.
 */
async function fetchPageWithRetry(market: FreehireMarket, offset: number): Promise<FreehireResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchPage(market, offset)
    } catch (error) {
      const response = (error as { response?: { status?: number; headers?: Record<string, string> } }).response
      if (response?.status === 429) {
        const h = response.headers ?? {}
        const decision = decideRateLimitWait(h['retry-after'])
        console.warn(
          `[freehire] 429 rate limited: retry-after=${h['retry-after'] ?? '-'} limit=${h['x-ratelimit-limit'] ?? '-'} remaining=${h['x-ratelimit-remaining'] ?? '-'} reset=${h['x-ratelimit-reset'] ?? '-'} (attempt ${attempt + 1})`,
        )
        if (decision.action === 'give-up') {
          throw new Error(
            `freehire rate limit: asked to wait ${decision.seconds}s (about ${Math.round(decision.seconds / 3600)}h), longer than the ${MAX_RATE_LIMIT_WAIT_S}s we will wait. The API key's quota looks used up: check its plan and usage with freehire.`,
          )
        }
        if (attempt < 4) {
          await sleep(decision.seconds * 1000)
          continue
        }
      }
      // A dropped connection or a timeout, not an answer from freehire: try again a few times. One "read ECONNRESET" at
      // USD offset 3400 failed the whole sync on 2026-11-19 14:24, so that day's closed-job check never ran.
      const code = (error as { code?: string }).code
      if (!response && code && NETWORK_RETRY_CODES.has(code) && attempt < 3) {
        console.warn(`[freehire] ${code} on ${market.label ?? market.currency} offset=${offset}, retrying (attempt ${attempt + 1})`)
        await sleep(5_000 * (attempt + 1))
        continue
      }
      throw error
    }
  }
}

// Since 2026-11-25 freehire's public job reads (search, the /agent/ search, /jobs/{slug}) leave `url` empty and drop
// `source_url` wherever `apply_url`, a counted freehire redirect, is set. The API plan keeps the employer's own link on
// /data/jobs/search and /data/jobs/{slug} (freehire.me/docs/api/data), counted apart: 1,200 requests a minute. /data
// search returns the public search's shape, whose description is cut at ~1,000 characters, so the full-description
// /agent/ search stays the source and each job we would publish has its link read from /data/jobs/{slug}.
const DATA_JOB_URL = 'https://freehire.me/api/v1/data/jobs'
/** Link reads at once, and the least time between two starts (at most ~16 a second, under 1,200 a minute). */
const LINK_CONCURRENCY = 4
const LINK_GAP_MS = 60

let nextLinkSlot = 0
async function linkSlot(): Promise<void> {
  const now = Date.now()
  const at = Math.max(now, nextLinkSlot)
  nextLinkSlot = at + LINK_GAP_MS
  if (at > now) await sleep(at - now)
}

/** The employer's own link for one freehire job (its `url`, UTM kept for stripFreehireUtm), or null when it has none. */
export async function fetchOriginalLink(slug: string): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    await linkSlot()
    try {
      const res = await axios.get<{ data?: { url?: string | null } }>(`${DATA_JOB_URL}/${encodeURIComponent(slug)}`, {
        headers: freehireHeaders(),
        timeout: 30_000,
      })
      const url = res.data?.data?.url
      return typeof url === 'string' && url ? url : null
    } catch (error) {
      const response = (error as { response?: { status?: number; headers?: Record<string, string> } }).response
      if (response?.status === 404) return null
      if (response?.status === 401 || response?.status === 403) {
        throw new Error(
          `freehire /data/jobs answered ${response.status}: the employer links need FREEHIRE_API_KEY on an API plan. Without them no freehire job can be listed.`,
        )
      }
      if (response?.status === 429 && attempt < 4) {
        const decision = decideRateLimitWait(response.headers?.['retry-after'])
        if (decision.action === 'give-up') throw new Error(`freehire /data/jobs rate limit: asked to wait ${decision.seconds}s`)
        await sleep(decision.seconds * 1000)
        continue
      }
      const code = (error as { code?: string }).code
      if (!response && code && NETWORK_RETRY_CODES.has(code) && attempt < 3) {
        await sleep(5_000 * (attempt + 1))
        continue
      }
      throw error
    }
  }
}

/**
 * Fill in `url` on the jobs that lack it and would otherwise be published, from /data/jobs/{slug}. `known` holds the
 * links already read this run (a job can come up in more than one market). Returns how many were looked up.
 */
export async function fillOriginalLinks(jobs: FreehireJob[], known: Map<string, string | null>): Promise<number> {
  const todo = jobs.filter((j) => !j.url && j.public_slug && freehireListing(j))
  const fresh = todo.filter((j) => !known.has(j.public_slug!))
  let i = 0
  const worker = async () => {
    while (i < fresh.length) {
      const job = fresh[i++]
      known.set(job.public_slug!, await fetchOriginalLink(job.public_slug!))
    }
  }
  await Promise.all(Array.from({ length: Math.min(LINK_CONCURRENCY, fresh.length) }, worker))
  for (const job of todo) job.url = known.get(job.public_slug!) ?? ''
  return fresh.length
}

export type FreehireCollected = {
  inputs: BoardJobInput[]
  markets: FreehireMarketReport[]
  /** Per-market failures. Non-empty means the collection is incomplete. */
  errors: string[]
  /** Records fetched in the window that were not publishable (closed, stale, wrong currency, below threshold). */
  unmappable: number
}

/** Fetch and map every market without writing anything. */
export async function collectFreehireJobs(options: FreehireSyncOptions = {}): Promise<FreehireCollected> {
  const inputs = new Map<string, BoardJobInput>() // paging over created_at ties can repeat rows
  const markets: FreehireMarketReport[] = []
  const errors: string[] = []
  let unmappable = 0
  const links = new Map<string, string | null>()
  const cutoff = options.since?.getTime() ?? Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000

  for (const market of [...FREEHIRE_MARKETS, ...(options.withDescriptionPay === false ? [] : DESCRIPTION_PAY_MARKETS)]) {
    // A market with its own window: the description slices read a fixed number of hours (their volume would pass
    // freehire's 10,000-row ceiling over a longer window); lookbackDays reads at least that far back.
    const marketCutoff = market.windowHours
      ? Date.now() - market.windowHours * 3_600_000
      : market.lookbackDays
        ? Math.min(cutoff, Date.now() - market.lookbackDays * 24 * 60 * 60 * 1000)
        : cutoff
    const report: FreehireMarketReport = {
      currency: market.label ?? market.currency,
      available: 0,
      fetched: 0,
      mappable: 0,
      gateRejected: 0,
      tooOld: 0,
      oldest: null,
      newest: null,
      sample: [],
      complete: false,
      linksRead: 0,
    }
    markets.push(report)

    try {
      // Newest first by first-seen date. Ties and bulk imports leave the order slightly uneven, so stop only after two
      // consecutive pages made up entirely of jobs older than the window.
      let pages = 0
      let oldPages = 0
      for (let offset = 0; offset < MAX_OFFSET; offset += PAGE_SIZE) {
        if (options.maxPagesPerMarket && pages >= options.maxPagesPerMarket) break
        if (market.maxPages && pages >= market.maxPages) break
        const page = await fetchPageWithRetry(market, offset)
        assertFiltersApplied(page.meta)
        report.available = page.meta.total
        pages++
        if (page.data.length === 0) {
          report.complete = true
          break
        }

        let oldOnPage = 0
        const listed: FreehireJob[] = []
        for (const job of page.data) {
          const seen = firstSeen(job)
          if (seen && new Date(seen).getTime() < marketCutoff) {
            oldOnPage++
            continue
          }
          // Read by first-seen date, a job can carry an old posting date: one posted more than MAX_LISTED_AGE_DAYS ago is
          // not listed (the posting-date window used to keep these out).
          if (job.posted_at && Date.now() - new Date(job.posted_at).getTime() > MAX_LISTED_AGE_DAYS * 86_400_000) {
            report.tooOld++
            continue
          }
          report.fetched++
          // The no-filter pass takes only jobs freehire has no pay for; the currency passes above already carry the rest.
          if (market.anyPay && typeof job.enrichment?.salary_min === 'number') continue
          if (seen) {
            report.newest = report.newest && report.newest > seen ? report.newest : seen
            report.oldest = report.oldest && report.oldest < seen ? report.oldest : seen
          }

          listed.push(job)
        }
        report.linksRead += await fillOriginalLinks(listed, links)
        for (const job of listed) {
          const input = mapFreehireJob(job)
          if (!input) {
            unmappable++
            continue
          }
          report.mappable++
          if (report.sample.length < 3) report.sample.push(`${input.title} — ${input.rawCompanyName}`)
          // Mirror the ingest salary gate so the report shows what would really be published.
          if (getMinimumSalaryRejection({ salaryMin: input.salaryMin, salaryMax: input.salaryMax, salaryCurrency: input.salaryCurrency })) {
            report.gateRejected++
          }
          inputs.set(input.externalId, input)
        }

        oldPages = oldOnPage === page.data.length ? oldPages + 1 : 0
        // A page shorter than PAGE_SIZE is NOT the last one: freehire routinely returns 95-99 rows with many pages
        // still to come (measured 2026-11-07, EUR/CHF/ES queries: rows 99, 95, 100, 100 ... down to the last page).
        // Treating it as the end stopped each market after its first page, so most of the window was never read
        // (CHF: 96 of roughly 400 jobs from the last three weeks). The end is the total freehire reports, or the
        // window ending (two pages of nothing but older jobs).
        const reachedEnd = typeof page.meta.total === 'number' && offset + PAGE_SIZE >= page.meta.total
        if (oldPages >= 2 || reachedEnd) {
          report.complete = true
          break
        }
        await sleep(PAGE_DELAY_MS)
      }
    } catch (error) {
      console.error(`[freehire] ❌ ${report.currency} fetch failed:`, error)
      errors.push(`${report.currency}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { inputs: [...inputs.values()], markets, errors, unmappable }
}

const COMPANY_URL = 'https://freehire.me/api/v1/companies'

/** freehire's company record (`data.company`) as the fields a company page uses; empty when it has none of them. */
export function companyProfileFrom(company: unknown): CompanyProfile {
  const c = (company && typeof company === 'object' ? company : {}) as Record<string, unknown>
  const info = (c.company_info && typeof c.company_info === 'object' ? c.company_info : {}) as Record<string, unknown>
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? decodeJobHtmlEntities(v.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, max) : undefined)
  const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined)
  const site = typeof info.website === 'string' ? normalizePublicCompanyWebsite(info.website) : null
  const cc = typeof c.hq_country === 'string' && /^[a-z]{2}$/i.test(c.hq_country.trim()) ? c.hq_country.trim().toUpperCase() : undefined
  const sizes = Array.isArray(c.company_sizes) ? c.company_sizes : []
  const sizeBucket =
    toSiteSizeBucket(sizes[0]) ??
    toSiteSizeBucket(info.employee_range) ??
    (typeof c.employee_count === 'number' ? toSiteSizeBucket(String(c.employee_count)) : null) ??
    undefined
  const linkedin = typeof info.linkedin === 'string' && /^https:\/\/([a-z]+\.)?linkedin\.com\/company\//i.test(info.linkedin.trim()) ? info.linkedin.trim() : undefined
  const description = text(info.description, 2000)
  return {
    ...(site ? { website: site } : {}),
    // Only a real description: freehire's `summary` is often a careers-page line ("Explore our open opportunities").
    ...(description && description.length >= 40 ? { description } : {}),
    ...(int(c.year_founded, 1800, new Date().getUTCFullYear()) ? { foundedYear: c.year_founded as number } : {}),
    ...(int(c.employee_count, 1, 5_000_000) ? { employeeCount: c.employee_count as number } : {}),
    ...(cc ? { countryCode: cc } : {}),
    ...(sizeBucket ? { sizeBucket } : {}),
    ...(linkedin ? { linkedinUrl: linkedin } : {}),
  }
}

/**
 * freehire's company records: the employer's website (for roughly a third of companies; the job records carry none) and,
 * since 2026-11-24, the profile a company page shows (companyProfileFrom). Returns slug -> profile for the companies
 * freehire answered with anything; a company not found or whose lookup fails is simply absent, so ingestion never
 * depends on it. Paced (3 workers) and honours Retry-After on 429.
 */
export async function loadFreehireCompanies(
  slugs: string[],
  fetchFn: typeof fetch = fetch,
  pauseMs = 150,
  budgetMs = 4 * 60_000,
  /** Filled with every slug freehire answered for (profile or not); one cut short by the time budget or an error is not. */
  answered?: Set<string>,
): Promise<Map<string, CompanyProfile>> {
  const out = new Map<string, CompanyProfile>()
  // Overall time budget: this is a nice-to-have, so when freehire is slow or rate-limiting we stop looking up more
  // companies (the rest keep their name-based logo) instead of holding up the job ingest behind it.
  const deadline = Date.now() + budgetMs
  let rateLimited = false // a long 429 means freehire is refusing us: stop asking, for every worker
  const queue = [...new Set(slugs.filter(Boolean))]
  async function lookup(slug: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetchFn(`${COMPANY_URL}/${encodeURIComponent(slug)}`, {
          headers: freehireHeaders(),
          signal: AbortSignal.timeout(15_000),
        })
        if (res.status === 429) {
          const decision = decideRateLimitWait(res.headers.get('retry-after'), 30)
          if (decision.action === 'give-up') {
            rateLimited = true
            return
          }
          await sleep(decision.seconds * 1000)
          continue
        }
        if (!res.ok) {
          // Discard the unread body: left paused, it crashed undici when the server closed the connection (2026-11-10).
          await res.body?.cancel().catch(() => undefined)
          // A 404 is an answer (freehire has no such company); a server error is not.
          if (res.status === 404) answered?.add(slug)
          return
        }
        const json = (await res.json()) as { data?: { company?: unknown } }
        const profile = companyProfileFrom(json?.data?.company)
        if (Object.keys(profile).length > 0) out.set(slug, profile)
        answered?.add(slug)
        return
      } catch {
        return
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length > 0 && Date.now() < deadline && !rateLimited) {
        const slug = queue.shift()!
        await lookup(slug)
        if (pauseMs > 0) await sleep(pauseMs)
      }
    }),
  )
  return out
}

/** slug -> website, for the companies whose freehire record has a real company website. */
export async function loadFreehireCompanyWebsites(
  slugs: string[],
  fetchFn: typeof fetch = fetch,
  pauseMs = 150,
  budgetMs = 4 * 60_000,
  answered?: Set<string>,
): Promise<Map<string, string>> {
  const profiles = await loadFreehireCompanies(slugs, fetchFn, pauseMs, budgetMs, answered)
  return new Map([...profiles].filter(([, p]) => p.website).map(([slug, p]) => [slug, p.website!]))
}

/** Write already-collected jobs through the normal board ingest (dedupe, priority, salary gate). */
export async function ingestFreehireJobs(
  inputs: BoardJobInput[],
  opts: { lookUpWebsites?: boolean } = {},
): Promise<ScraperStats> {
  const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }
  // Give each job its employer's website (when freehire has one) so its logo comes from a real domain, not a name guess.
  // The 5-minute recent pull skips this (one request per company, against freehire's daily quota); the regular syncs
  // read the same jobs again and fill the websites then.
  // Companies already holding a website, or asked in the last 30 days, are not asked again
  // (lib/scrapers/freehireCompanyWebsites.ts); they were 400-1,100 requests a run.
  const answeredKeys: string[] = []
  const profilesToSave: Array<{ key: string; profile: CompanyProfile }> = []
  if (opts.lookUpWebsites !== false) {
    try {
      const keyBySlug = new Map<string, string | null>()
      for (const i of inputs) if (!i.companyWebsiteUrl && i.companyRef && !keyBySlug.has(i.companyRef)) keyBySlug.set(i.companyRef, freehireCompanyKey(i.rawCompanyName))
      const wanted = [...keyBySlug].map(([slug, key]) => ({ slug, key }))
      let plan = { lookUp: wanted.map((w) => w.slug), hasWebsite: 0, checkedRecently: 0 }
      try {
        const keys = [...new Set(wanted.map((w) => w.key).filter((k): k is string => Boolean(k)))]
        plan = companiesToLookUp(wanted, await loadKnownCompanies(keys), new Date())
      } catch (error) {
        console.warn('[freehire] company website cache unavailable, asking about every company:', error instanceof Error ? error.message.split('\n')[0] : error)
      }
      const t0 = Date.now()
      const answered = new Set<string>()
      const profiles = await loadFreehireCompanies(plan.lookUp, fetch, 150, 4 * 60_000, answered)
      const sites = [...profiles.values()].filter((p) => p.website).length
      console.log(
        `[freehire] companies: ${profiles.size} answered with a profile (${sites} with a website) of ${plan.lookUp.length} asked in ${Math.round((Date.now() - t0) / 1000)}s; ` +
          `not asked: ${plan.hasWebsite} with a website and description already, ${plan.checkedRecently} asked in the last ${WEBSITE_RECHECK_DAYS} days`,
      )
      for (const slug of answered) {
        const key = keyBySlug.get(slug)
        if (key) answeredKeys.push(key)
        const profile = profiles.get(slug)
        if (key && profile) profilesToSave.push({ key, profile })
      }
      for (const input of inputs) {
        const site = input.companyRef ? profiles.get(input.companyRef)?.website : undefined
        if (site && !input.companyWebsiteUrl) input.companyWebsiteUrl = site
      }
    } catch (error) {
      console.warn('[freehire] company website lookup skipped:', error instanceof Error ? error.message : error)
    }
  }
  // Each ingest waits on many sequential database round trips (about 1-1.6 s a job from GitHub's runners to the database
  // in Europe), so one at a time the full sync ran past its 150-minute job limit on 2026-11-18. Jobs are written a few
  // companies at a time; one company's jobs stay in order, so two of them never race to create the same company.
  const groups = new Map<string, BoardJobInput[]>()
  for (const input of inputs) {
    const key = (input.rawCompanyName ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '') || `#${input.externalId}`
    groups.set(key, [...(groups.get(key) ?? []), input])
  }
  const queue = [...groups.values()]
  await Promise.all(
    Array.from({ length: Math.min(INGEST_CONCURRENCY, queue.length) }, async () => {
      for (let group = queue.shift(); group; group = queue.shift()) {
        for (const input of group) addBoardIngestResult(stats, await ingestBoardJob(BOARD, input))
      }
    }),
  )
  // After the ingest, so a company created in this run is marked and filled too.
  await markWebsiteChecked([...new Set(answeredKeys)], new Date()).catch((error) =>
    console.warn('[freehire] could not record the website lookups:', error instanceof Error ? error.message.split('\n')[0] : error),
  )
  if (profilesToSave.length > 0) {
    await saveCompanyProfiles(profilesToSave)
      .then((n) => console.log(`[freehire] company profiles: ${n} companies got empty fields filled from freehire`))
      .catch((error) => console.warn('[freehire] could not save company profiles:', error instanceof Error ? error.message.split('\n')[0] : error))
  }
  return stats
}

export async function syncFreehire(
  options: FreehireSyncOptions = {},
): Promise<{ stats: ScraperStats; markets: FreehireMarketReport[] }> {
  const collected = await collectFreehireJobs(options)
  const stats = options.dryRun ? { created: 0, updated: 0, skipped: 0 } : await ingestFreehireJobs(collected.inputs)
  stats.skipped += collected.unmappable
  if (collected.errors.length > 0) stats.error = collected.errors.join('; ')
  return { stats, markets: collected.markets }
}

export default async function scrapeFreehire(): Promise<ScraperStats> {
  console.log('[freehire] Starting sync...')
  const { stats } = await syncFreehire({ dryRun: process.env.FREEHIRE_DRY_RUN === '1' })
  console.log(`[freehire] ✓ created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`)
  return stats
}
