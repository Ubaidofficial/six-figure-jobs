// lib/seo/jobJsonLd.ts

import { buildLogoUrl } from '../companies/logo'
import type { Job, Company } from '@prisma/client'
import { normalizePublicCompanyWebsite } from '../companies/website'
import { getSiteUrl } from './site'
import { buildJobSlug, getShortStableIdForJobId } from '../jobs/jobSlug'
import { getAnnualSalaryCapForCurrency } from '../normalizers/salary'
import { resolveSalaryCurrency } from '../jobs/salary'
import { countryName, normalizeCountryCode } from '../location/country'
import { countryFromCity, countryFromText } from '../location/jobLocation'
import {
  cleanJobDescriptionHtml,
  cleanJobDescriptionText,
} from '../jobs/descriptionCleaning'

export type JobWithCompany = Job & { companyRef: Company | null }

const SITE_URL = getSiteUrl()

export function buildJobJsonLd(job: JobWithCompany): any {
  const company = job.companyRef

  const companyName = company?.name || job.company || 'Company'
  const companyUrl = normalizePublicCompanyWebsite(company?.website) || undefined
  // The logo the site shows for the company, from its stored logo or its website's domain. Never a lookup by name: a
  // name can match another company (the 2026-11-10 logo audit found several), and a wrong logo in markup is worse
  // than none. Same-origin /logo/... URLs are made absolute.
  const shownLogo = buildLogoUrl(company?.logoUrl, company?.website, null)
  const logo =
    (shownLogo && (shownLogo.startsWith('/') ? `${SITE_URL}${shownLogo}` : normalizeUrl(shownLogo))) ||
    (job.companyLogo && normalizeUrl(job.companyLogo)) ||
    undefined

  const url = `${SITE_URL}/job/${buildJobSlug(job as any)}`

  const postedAt = job.postedAt ?? job.createdAt ?? job.updatedAt ?? new Date()
  const datePosted = postedAt.toISOString()

  const description = buildStructuredDescription(job, companyName)
  const baseSalary = buildBaseSalary(job)
  const validThrough = buildValidThrough(job)

  const physicalJobLocation = buildJobLocation(job)
  const isRemote = isRemoteJob(job)
  const isHybrid = job.remoteMode === 'hybrid' || (isRemote && hasPhysicalWorkplace(job))
  const applicantLocationRequirements = isRemote ? buildApplicantLocationRequirements(job) : undefined
  // For non-remote jobs: if buildJobLocation returned nothing, try a country-only fallback
  // so we always satisfy Google's requirement of at least one location signal.
  const jobLocationRaw = isRemote && !isHybrid ? undefined : (physicalJobLocation ?? buildCountryFallbackLocation(job))
  const jobLocation = jobLocationRaw
  // TELECOMMUTE is Google's flag for a job worked remotely 100% of the time; a hybrid job is listed at its office.
  const jobLocationType = isRemote ? 'TELECOMMUTE' : undefined

  // Only emit a value we actually recognised — an unknown type is omitted, never guessed.
  const employmentType = normalizeEmploymentType(job.type || job.employmentType)

  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',

    title: job.title,
    description,
    url,

    datePosted,

    hiringOrganization: {
      '@type': 'Organization',
      name: companyName,
      ...(companyUrl ? { sameAs: companyUrl } : {}),
      ...(logo ? { logo } : {}),
    },

    ...(employmentType ? { employmentType } : {}),

    ...(validThrough ? { validThrough } : {}),
    // directApply is intentionally omitted: candidates apply on the employer's site, not here.
    ...(jobLocationType ? { jobLocationType } : {}),
    ...(jobLocation ? { jobLocation } : {}),
    ...(baseSalary ? { baseSalary } : {}),
    ...(applicantLocationRequirements ? { applicantLocationRequirements } : {}),

    // Our own id for the job (the suffix of its URL): the stored id and source name where we found the job
    // ("board:freehire:…") are not published (owner's request, 2026-11-09).
    identifier: {
      '@type': 'PropertyValue',
      name: 'Six Figure Jobs',
      value: getShortStableIdForJobId(job.id),
    },
  }

  return jsonLd
}

/* ---------------- helpers ---------------- */

function buildStructuredDescription(job: any, companyName: string): string {
  const raw = String(job.descriptionHtml || '').trim()
  if (raw) {
    const cleanedRaw = cleanJobDescriptionHtml(raw)
    const sanitized = sanitizeDescriptionHtmlForJsonLd(cleanedRaw)
    if (sanitized) return sanitized
    // Strip HTML tags and use plain text if sanitizer returned empty (e.g. div-only markup)
    const stripped = cleanJobDescriptionText(stripTags(cleanedRaw)).replace(/\s+/g, ' ').trim()
    if (stripped.length >= 30) return wrapPlainTextAsHtml(cleanDescription(stripped))
  }

  // descriptionText does not exist in the schema — removed dead field reference.
  // Fall back to aiSnippet or aiOneLiner if available (AI-enriched fields).
  const aiText = String(job.aiSnippet || job.aiOneLiner || '').trim()
  if (aiText.length >= 30) return wrapPlainTextAsHtml(cleanDescription(cleanJobDescriptionText(aiText)))

  const fallback = (job.salaryRaw ? String(job.salaryRaw) : '') || `${job.title} at ${companyName}`
  return wrapPlainTextAsHtml(cleanDescription(fallback))
}

function buildBaseSalary(job: any): any | undefined {
  if (!job.salaryValidated) return undefined

  const rawMin = toNumberSafe(job.salaryMin ?? job.minAnnual)
  const rawMax = toNumberSafe(job.salaryMax ?? job.maxAnnual)

  if (!rawMin && !rawMax) return undefined

  const min = rawMin ? normalizeAnnualAmount(rawMin) : null
  const max = rawMax ? normalizeAnnualAmount(rawMax) : null

  // Use the same resolver as the visible salary so structured data and the page
  // never disagree (parsers can mislabel currency; for non-remote jobs we trust
  // the country over the parsed currency).
  const currency = resolveSalaryCurrency(job)

  if (!currency) return undefined

  if ((min && min <= 0) || (max && max <= 0)) return undefined
  const cap = getAnnualSalaryCapForCurrency(currency)
  if ((min && min > cap) || (max && max > cap)) return undefined

  let unitText = 'YEAR'
  if (job.salaryPeriod) {
    const period = String(job.salaryPeriod).toLowerCase()
    if (period === 'hourly' || period === 'hour') unitText = 'HOUR'
    else if (period === 'monthly' || period === 'month') unitText = 'MONTH'
    else if (period === 'weekly' || period === 'week') unitText = 'WEEK'
  }

  return {
    '@type': 'MonetaryAmount',
    currency,
    value: {
      '@type': 'QuantitativeValue',
      ...(min ? { minValue: min } : {}),
      ...(max ? { maxValue: max } : {}),
      unitText,
    },
  }
}

/**
 * The expiry date the source itself gave (`expiresAt`), while it is in the future; otherwise nothing. Google: "If a job
 * posting never expires, or you do not know when the job will expire, do not include this property." The stored
 * `validThrough` column is not used: when a source gives no date it holds an estimate (posting date + 45 days), and the
 * old fallback here also moved that estimate to today + 45 days for older jobs. Expired jobs are handled by the 410
 * response and Indexing API URL_DELETED, not by this date.
 */
function buildValidThrough(job: any): string | undefined {
  const fromSource = readDateField(job, 'expiresAt')
  return fromSource && fromSource.getTime() > Date.now() ? fromSource.toISOString() : undefined
}

function buildApplicantLocationRequirements(job: any): any | undefined {
  const remoteRegion = typeof job.remoteRegion === 'string' ? job.remoteRegion.trim() : ''
  if (remoteRegion) {
    const regionRequirement = parseRemoteRegionApplicantRequirements(remoteRegion)
    if (regionRequirement) return regionRequirement
  }

  const explicitCountry = normalizeCountryCode(job.countryCode)
  if (explicitCountry) {
    return buildCountryRequirement(explicitCountry)
  }

  const locationCountry = inferCountryFromLocationRaw(job.locationRaw ? String(job.locationRaw) : '')
  if (locationCountry) {
    return buildCountryRequirement(locationCountry)
  }

  if (remoteRegion) {
    const parsedRemoteRegion = parseApplicantLocationRequirement(remoteRegion)
    if (parsedRemoteRegion) return parsedRemoteRegion
  }

  const fallbackCountry = inferCountryFromJob(job)
  if (fallbackCountry) {
    return buildCountryRequirement(fallbackCountry)
  }

  return undefined
}

function buildCountryRequirement(countryCode: string): any {
  const code = countryCode.toUpperCase()
  return {
    '@type': 'Country',
    name: countryNameFromCode(code) || code,
  }
}

function parseRemoteRegionApplicantRequirements(raw: string): any | undefined {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  const regionMap: Record<string, string[]> = {
    emea: ['GB', 'IE', 'DE', 'FR', 'NL', 'ES', 'IT', 'SE'],
    europe: ['GB', 'IE', 'DE', 'FR', 'NL', 'ES', 'IT', 'SE'],
    apac: ['AU', 'SG', 'IN', 'JP'],
    asia: ['SG', 'IN', 'JP'],
    latam: ['MX', 'BR'],
    'latin america': ['MX', 'BR'],
    americas: ['US', 'CA', 'MX', 'BR'],
    'north america': ['US', 'CA'],
    na: ['US', 'CA'],
  }

  const codes = regionMap[normalized]
  if (!codes) return undefined
  return codes.map(buildCountryRequirement)
}

function parseApplicantLocationRequirement(raw: string): any | undefined {
  const s = String(raw || '').trim()

  if (!s) {
    return undefined
  }

  const normalized = s
    .replace(/^remote\b[:\s-]*/i, '')
    .replace(/^work\s+from\s+home\b[:\s-]*/i, '')
    .replace(/^\(([^)]+)\)$/, '$1')
    .trim()
  const upper = normalized.toUpperCase()

  if (
    upper === 'GLOBAL' ||
    upper === 'WORLDWIDE' ||
    upper === 'ANYWHERE' ||
    upper === 'REMOTE' ||
    upper === 'INTERNATIONAL' ||
    upper === 'EMEA' ||
    upper === 'APAC'
  ) {
    return undefined
  }

  if (upper === 'US-ONLY') {
    return { '@type': 'Country', name: 'United States' }
  }

  if (upper === 'CANADA') {
    return { '@type': 'Country', name: 'Canada' }
  }

  if (upper === 'UK-IRELAND') {
    return [
      { '@type': 'Country', name: 'United Kingdom' },
      { '@type': 'Country', name: 'Ireland' },
    ]
  }

  if (upper === 'US' || upper === 'USA' || upper === 'UNITED STATES') {
    return { '@type': 'Country', name: 'United States' }
  }

  if (upper === 'UK' || upper === 'UNITED KINGDOM' || upper === 'GREAT BRITAIN') {
    return { '@type': 'Country', name: 'United Kingdom' }
  }

  // ISO-3166-1 alpha-2 country code (only a real one: "HQ" or "SF" is not a country)
  const isoCode = normalizeCountryCode(upper)
  if (isoCode) {
    return { '@type': 'Country', name: countryNameFromCode(isoCode) || isoCode }
  }

  // State/region format
  if (s.includes(',') && /usa|united states|u\.s\.|us\b/i.test(s)) {
    return { '@type': 'AdministrativeArea', name: s }
  }

  // Fallback
  if (normalized.length >= 3 && normalized.length <= 60) {
    return { '@type': 'Country', name: normalized }
  }

  return undefined
}

function countryNameFromCode(code: string): string | null {
  return countryName(code)
}

/**
 * A place name safe to publish as addressLocality, or undefined. Free text sometimes holds codes ("US-REMOTE", "HQ"),
 * several places joined by a bullet ("San Francisco, CA • New York, NY • United States") or a sentence: Google reads
 * the value as a place, so none of those may be passed on.
 */
export function cleanLocality(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.replace(/\s+/g, ' ').trim().replace(/\s+office$/i, '')
  if (!v || v.length > 60) return undefined
  if (/[•|;]/.test(v)) return undefined
  if (/^[A-Za-z]{1,3}([-_ ][A-Za-z]+)?$/.test(v) && v === v.toUpperCase()) return undefined
  if (/\b(remote|hq|headquarters|anywhere|worldwide|global|hybrid|on-?site|virtual|multiple locations)\b/i.test(v)) return undefined
  if (v.split(' ').length > 8) return undefined // a sentence, not a place
  return v
}

function buildJobLocation(job: any): any {
  const city = cleanLocality(job.city)
  const region = job.stateCode ? String(job.stateCode).toUpperCase() : undefined
  // The stored country wins; the text is read only when it clearly names a country; then the company and the currency.
  const country = normalizeCountryCode(job.countryCode) ?? undefined
  const locationRaw = job.locationRaw ? String(job.locationRaw).trim() : ''

  if (!country && !locationRaw && !city) {
    return undefined
  }

  const addressCountry = country || inferCountryFromLocationRaw(locationRaw) || inferCountryFromJob(job) || undefined

  // "Los Angeles, CA, USA; Mountain View, CA, USA" is two workplaces, not one place named with a semicolon: Google
  // reads jobLocation as an array of places. Each place gets its own country; one whose country is unknown is left out.
  const places = !city ? splitMultiLocation(locationRaw, addressCountry) : null
  if (places) return places.length > 0 ? places : undefined

  if (!addressCountry) {
    return undefined
  }

  const locality = city ?? (countryOnly(locationRaw) ? undefined : cleanLocality(locationRaw))
  return {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      ...(locality ? { addressLocality: locality } : {}),
      ...(region ? { addressRegion: region } : {}),
      addressCountry,
    },
  }
}

/** "United States" or "Germany" on its own is a country, not a locality (Singapore and Hong Kong are both). */
function countryOnly(text: string): boolean {
  const code = !text.includes(',') ? countryFromText(text) : null
  return code !== null && code !== 'SG' && code !== 'HK'
}

const CA_PROVINCE_CODES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK'])

/** One Place per `;`, bullet or pipe separated workplace (at most 10), or null when the text names a single place. */
function splitMultiLocation(locationRaw: string, fallbackCountry: string | undefined): any[] | null {
  const parts = Array.from(new Set(locationRaw.split(/[;•|]/).map((p) => p.trim()).filter(Boolean))).slice(0, 10)
  if (parts.length < 2) return null
  const out: any[] = []
  for (const part of parts) {
    const segments = part.split(',').map((x) => x.trim()).filter(Boolean)
    const addressCountry = inferCountryFromLocationRaw(part) || fallbackCountry
    const code = segments.length >= 2 ? segments[1].toUpperCase() : ''
    // A state or province code only when it fits the country ("CA" after a US place, "BC" after a Canadian one).
    const region =
      (addressCountry === 'US' && US_STATE_CODES.has(code)) || (addressCountry === 'CA' && CA_PROVINCE_CODES.has(code))
        ? code
        : undefined
    const locality = countryOnly(part) ? undefined : cleanLocality(segments[0] || part)
    if (!addressCountry) continue
    out.push({
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(locality ? { addressLocality: locality } : {}),
        ...(region ? { addressRegion: region } : {}),
        addressCountry,
      },
    })
  }
  return out
}

/** Last-resort location for non-remote jobs with no city/region/locationRaw — infer from currency or company country */
function buildCountryFallbackLocation(job: any): any | undefined {
  const country = inferCountryFromJob(job)
  if (!country) return undefined
  return {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      addressCountry: country,
    },
  }
}

function hasPhysicalWorkplace(job: any): boolean {
  if (job.remoteMode === 'hybrid' || job.remoteMode === 'onsite') return true
  if (typeof job.city === 'string' && job.city.trim()) return true

  const locationRaw = typeof job.locationRaw === 'string' ? job.locationRaw.trim().toLowerCase() : ''
  if (!locationRaw) return false

  return !/^(remote|work from home|worldwide|global|anywhere)(\b|$)/i.test(locationRaw)
}

function isRemoteJob(job: any): boolean {
  // Trust explicit DB flags first — these come from ATS normalization
  if (job.remote === true || job.remoteMode === 'remote') return true
  // Explicit onsite/hybrid → not remote
  if (job.remoteMode === 'onsite' || job.remoteMode === 'hybrid') return false

  // Only scan structured metadata fields — never description HTML.
  // Description text commonly contains "no remote", "not remote-friendly", etc.
  // which would produce false positives.
  const text = [
    job.locationRaw,
    job.remoteRegion,
    job.workArrangement,
    job.workArrangementNormalized,
  ]
    .filter(Boolean)
    .map(String)
    .join(' ')
    .toLowerCase()

  if (!text) return false

  return (
    /\bremote\b/.test(text) ||
    /\btelecommute\b/.test(text) ||
    /\bwork\s+from\s+home\b/.test(text) ||
    /\bwork\s+remotely\b/.test(text)
  )
}

function normalizeEmploymentType(value: unknown): string | undefined {
  const raw = String(value || '').trim()
  if (!raw) return undefined

  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()

  if (!normalized) return undefined
  // Collapse separators so "Full-time", "full_time" and "FullTime" all match.
  const compact = normalized.replace(/ /g, '')
  if (compact === 'fulltime') return 'FULL_TIME'
  if (compact === 'parttime') return 'PART_TIME'
  if (normalized === 'contract' || normalized === 'contractor' || normalized === 'freelance') {
    return 'CONTRACTOR'
  }
  if (normalized === 'temporary' || normalized === 'temp' || normalized === 'seasonal') {
    return 'TEMPORARY'
  }
  if (normalized === 'intern' || normalized === 'internship') return 'INTERN'
  if (normalized === 'volunteer') return 'VOLUNTEER'
  if (compact === 'perdiem') return 'PER_DIEM'

  return undefined
}

function sanitizeDescriptionHtmlForJsonLd(input: string): string {
  const decoded = decodeHtmlEntities(input || '')
  const withoutScripts = decoded.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  const withoutStyles = withoutScripts.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  const withoutComments = withoutStyles.replace(/<!--[\s\S]*?-->/g, '')

  const allowedTags = new Set([
    'p',
    'ul',
    'ol',
    'li',
    'strong',
    'b',
    'em',
    'i',
    'br',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
  ])

  const filtered = withoutComments.replace(
    /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
    (match, tag) => {
      const lower = String(tag).toLowerCase()
      if (!allowedTags.has(lower)) return ''
      if (lower === 'br') return '<br>'
      return `<${match.startsWith('</') ? '/' : ''}${lower}>`
    },
  )

  const compact = filtered
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return compact.length > 0 ? compact : ''
}

function wrapPlainTextAsHtml(input: string): string {
  const escaped = escapeHtml(input)
  if (!escaped) return '<p>See the full job description on the page.</p>'

  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${part.replace(/\n/g, '<br>')}</p>`)

  return paragraphs.length > 0 ? paragraphs.join('') : `<p>${escaped}</p>`
}

/**
 * The country a location text clearly names ("Winnipeg, Canada", "Remote - US", "Kleve, Nordrhein-Westfalen"), or null.
 * A two-letter token is never lifted out of free text: "am" in "Frankfurt am Main" is Armenia, "WA" in "East Perth WA" is
 * Western Australia, "HQ" and "SF" are not countries at all.
 */
function inferCountryFromLocationRaw(locationRaw: string): string | null {
  const raw = String(locationRaw || '').trim()
  if (!raw) return null
  const fromText = countryFromText(raw)
  if (fromText) return fromText
  const lower = raw.toLowerCase()
  return US_STATE_NAMES.has(lower) && lower !== 'georgia' ? 'US' : null
}

// Also used by the homepage "Latest" list's per-country cap (lib/jobs/latestSelection.ts), so both agree on a job's country.
export function inferCountryFromJob(job: any): string | null {
  const explicitCountry = normalizeCountryCode(job.countryCode)
  if (explicitCountry) return explicitCountry

  // The job's own place comes before the employer's: Cohere (Toronto) hires in Berlin, and its Berlin job was tagged
  // Canada when the company's country was read first (seen live 2026-11-09).
  const rawLocation = typeof job.locationRaw === 'string' ? job.locationRaw : ''
  const locationCountry = inferCountryFromLocationRaw(rawLocation)
  if (locationCountry) return locationCountry

  const city = String(job.city || job.citySlug || '').toLowerCase()
  if (
    city.includes('san francisco') ||
    city.includes('san-francisco') ||
    city.includes('new york') ||
    city.includes('new-york') ||
    city.includes('minneapolis') ||
    city.includes('washington') ||
    city.includes('hawthorne')
  ) {
    return 'US'
  }

  // "Berlin" on its own: a city we have a page for.
  const byRawCity = countryFromCity(rawLocation.trim())
  if (byRawCity) return byRawCity

  const companyCountry = normalizeCountryCode(job.companyRef?.countryCode)
  if (companyCountry) return companyCountry

  const currency = String(job.salaryCurrency || job.currency || '').toUpperCase()
  const currencyCountryMap: Record<string, string> = {
    USD: 'US',
    CAD: 'CA',
    GBP: 'GB',
    AUD: 'AU',
  }

  if (currencyCountryMap[currency]) return currencyCountryMap[currency]

  // A city we have a page for ("Amsterdam", "Zürich") says its country; the euro does not.
  const byCity = countryFromCity(job.city ?? job.citySlug)
  if (byCity) return byCity

  // A euro job's location that ends in a euro-area country code names its country: "Kerestinec, HR" is Croatia, and was
  // tagged DE by the guess below (seen live 2026-11-08). Two-letter codes are not lifted from free text in general
  // ("WA" in "East Perth WA" is Western Australia), only this one case where the pay currency backs them.
  if (currency === 'EUR') {
    const tail = rawLocation.split(',').pop()?.trim().toUpperCase() ?? ''
    if (EURO_AREA.has(tail)) return tail
  }

  // Last resort for euro pay with nothing else to go on: the euro area's largest country. Often right, not always.
  return currency === 'EUR' ? 'DE' : null
}

const EURO_AREA = new Set(['AT', 'BE', 'BG', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'])

const US_STATE_CODES = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'IA',
  'ID',
  'IL',
  'IN',
  'KS',
  'KY',
  'LA',
  'MA',
  'MD',
  'ME',
  'MI',
  'MN',
  'MO',
  'MS',
  'MT',
  'NC',
  'ND',
  'NE',
  'NH',
  'NJ',
  'NM',
  'NV',
  'NY',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VA',
  'VT',
  'WA',
  'WI',
  'WV',
  'WY',
])

const US_STATE_NAMES = new Set([
  'alabama',
  'alaska',
  'arizona',
  'arkansas',
  'california',
  'colorado',
  'connecticut',
  'delaware',
  'district of columbia',
  'florida',
  'georgia',
  'hawaii',
  'idaho',
  'illinois',
  'indiana',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'maine',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'montana',
  'nebraska',
  'nevada',
  'new hampshire',
  'new jersey',
  'new mexico',
  'new york',
  'north carolina',
  'north dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode island',
  'south carolina',
  'south dakota',
  'tennessee',
  'texas',
  'utah',
  'vermont',
  'virginia',
  'washington',
  'west virginia',
  'wisconsin',
  'wyoming',
])

function toNumberSafe(v: any): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  try {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function readDateField(source: unknown, key: string): Date | null {
  if (!source || typeof source !== 'object') return null
  const value = (source as Record<string, unknown>)[key]
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date : null
  }
  return null
}

function normalizeAnnualAmount(n: number): number {
  if (n >= 50_000_000) return Math.round(n / 100)
  return Math.round(n)
}

function stripTags(str?: string | null): string {
  if (!str) return ''
  return str.replace(/<\/?[^>]+(>|$)/g, ' ')
}

function cleanDescription(s: string): string {
  const trimmed = (s || '').replace(/\s+/g, ' ').trim()
  if (trimmed.length >= 30) return trimmed
  return `${trimmed} `.trim() || 'See job description on the page.'
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function decodeHtmlEntities(input: string): string {
  return (input || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function normalizeUrl(u: string): string {
  const s = u.trim()
  if (!s) return s
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  return `https://${s}`
}
