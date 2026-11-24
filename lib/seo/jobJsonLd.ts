// lib/seo/jobJsonLd.ts

import { buildLogoUrl } from '../companies/logo'
import type { Job, Company } from '@prisma/client'
import { normalizePublicCompanyWebsite } from '../companies/website'
import { getSiteUrl } from './site'
import { buildJobSlug, getShortStableIdForJobId } from '../jobs/jobSlug'
import { getAnnualSalaryCapForCurrency } from '../normalizers/salary'
import { resolveSalaryCurrency } from '../jobs/salary'
import { countryName, normalizeCountryCode } from '../location/country'
import { countriesFromText, countryFromCity, countryFromText, isPlaceholderLocation } from '../location/jobLocation'
import { usStateOfCity } from '../location/usCityStates'
import { isWorldwideLocationText, remoteRegionDef } from '../jobs/remoteRegions'
import { evaluateJobIndexability } from '../jobs/qualityGate'
import { WORLDWIDE_COUNTRY_CODES, EXCLUDED_ELIGIBLE_COUNTRIES } from '../location/worldwideCountries'
import { AMERICAS, NORTH_AMERICA_REMOTE } from '../location/regionCountries'
import {
  cleanJobDescriptionHtml,
  cleanJobDescriptionText,
} from '../jobs/descriptionCleaning'

export type JobWithCompany = Job & { companyRef: Company | null }

const SITE_URL = getSiteUrl()

/**
 * The JobPosting for a job page, or null when the quality gate makes that page `noindex` (app/job/[slug]/page.tsx uses
 * the same gate for its robots tag). Google reads JobPosting only on indexable pages; a live audit (2026-11-23, 70
 * sampled job pages) found one noindex page still carrying it, so the markup and the robots tag disagreed.
 */
export function buildIndexableJobJsonLd(job: JobWithCompany): any | null {
  return evaluateJobIndexability(job).indexable ? buildJobJsonLd(job) : null
}

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

  // "Europe or US" is open in Europe and the United States. A stored country the text names does not narrow it to that
  // country alone; one the text does not name still wins.
  const regionsOrCountries = regionsOrCountriesCodes(job.locationRaw)
  if (regionsOrCountries && (!explicitCountry || regionsOrCountries.includes(explicitCountry))) {
    return regionsOrCountries.map(buildCountryRequirement)
  }

  if (explicitCountry) {
    return buildCountryRequirement(explicitCountry)
  }

  // "Remote, Canada; Remote, United States" and "US, CA, Remote" list the countries the job is open to: all of them, not
  // the one the single-place reader (or the company) would pick.
  const listedCountries = countriesFromText(job.locationRaw)
  if (listedCountries.length >= 2) return listedCountries.map(buildCountryRequirement)

  const locationCountry = inferCountryFromLocationRaw(job.locationRaw ? String(job.locationRaw) : '')
  if (locationCountry) {
    return buildCountryRequirement(locationCountry)
  }

  // "Remote - Europe" is open across Europe: not Germany (the company's or the euro's country) and not a short sample.
  const regionFromText = regionFromLocationText(job.locationRaw ? String(job.locationRaw) : '')
  if (regionFromText) return regionFromText

  if (remoteRegion) {
    const parsedRemoteRegion = parseApplicantLocationRequirement(remoteRegion)
    if (parsedRemoteRegion) return parsedRemoteRegion
  }

  // A posting that says "Worldwide" or "Anywhere" and names nothing that limits it is open in every country. Google wants at
  // least one eligible country on a 100% remote job and has no "anywhere" value, so list them all: never the company's
  // or the currency's country, which told Google a worldwide job was open only there. The stored `remoteRegion` cannot say
  // this (ingest writes "Global" on every remote job), so the text decides, as on the job page (describeJobLocation).
  if (isWorldwideLocationText(job.locationRaw ? String(job.locationRaw) : '')) {
    return worldwideApplicantRequirements()
  }

  const fallbackCountry = inferCountryFromJob(job)
  if (fallbackCountry) {
    return buildCountryRequirement(fallbackCountry)
  }

  return undefined
}

let worldwideRequirements: any[] | undefined
/** One Country per eligible country of a worldwide job (lib/location/worldwideCountries.ts), built once. */
function worldwideApplicantRequirements(): any[] {
  return (worldwideRequirements ??= WORLDWIDE_COUNTRY_CODES.map(buildCountryRequirement))
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

  // Europe, EMEA, APAC, the Middle East and UK & Ireland come from the site's own region table, so the markup and the
  // /remote region pages agree on which countries a region is (a short sample of 8 stood in for Europe and EMEA before).
  const fromTable = regionCountryRequirements(normalized.replace(/ /g, '-'))
  if (fromTable) return fromTable

  const regionMap: Record<string, string[]> = {
    asia: ['SG', 'IN', 'JP'],
    latam: ['MX', 'BR'],
    'latin america': ['MX', 'BR'],
    na: ['US', 'CA'],
  }

  const codes = regionMap[normalized]
  if (!codes) return undefined
  return codes.map(buildCountryRequirement)
}

/**
 * One Country per member of a multi-country region in lib/jobs/remoteRegions.ts, minus codes that are not ISO countries
 * (Kosovo's XK has no ISO code, so no name Google would know). Undefined for a single country or an unknown region.
 */
function regionCountryRequirements(slug: string): any[] | undefined {
  return regionCountryCodes(slug)?.map(buildCountryRequirement)
}

function regionCountryCodes(slug: string): string[] | undefined {
  const countries = remoteRegionDef(slug)?.countries ?? EXTRA_REGIONS[slug]
  if (!countries || countries.length < 2) return undefined
  // Not the countries an employer cannot lawfully hire in (EXCLUDED_ELIGIBLE_COUNTRIES), the same rule as a worldwide job.
  const codes = countries.filter((code) => normalizeCountryCode(code) && !EXCLUDED_ELIGIBLE_COUNTRIES.has(code))
  return codes.length >= 2 ? codes : undefined
}

const REGION_WORDS: Record<string, string> = {
  emea: 'emea',
  europe: 'europe',
  apac: 'apac',
  'asia pacific': 'apac',
  'asia-pacific': 'apac',
  'middle east': 'middle-east',
  'north america': 'north-america',
  americas: 'americas',
}

/**
 * The regions and countries a location text lists when it lists nothing else ("Europe or US", "Remote (US/Canada)",
 * "United States"), or null. A part that is neither ("Eastern Europe", "Asia", "Berlin") makes the whole text null.
 */
function regionsAndCountriesOnly(raw: unknown): { regions: string[]; countries: string[] } | null {
  if (typeof raw !== 'string') return null
  const text = raw
    .replace(/\bremote\b/gi, ' ')
    .replace(/[()]/g, ' ')
    .replace(/^[\s\-–:,]+|[\s\-–:,]+$/g, '')
  const parts = text
    .split(/\s*(?:[,;/&|]|\s[-–]\s|\bor\b|\band\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const regions: string[] = []
  const countries: string[] = []
  for (const part of parts) {
    const region = REGION_WORDS[part.toLowerCase().replace(/\s+/g, ' ')]
    const country = region ? null : countryOnly(part) ? countryFromText(part) : null
    if (region) regions.push(region)
    else if (country) countries.push(country)
    else return null
  }
  return { regions, countries }
}

/** "Europe or US": every country of the named regions and the named countries, or undefined when the text is not that. */
function regionsOrCountriesCodes(raw: unknown): string[] | undefined {
  const listed = regionsAndCountriesOnly(raw)
  if (!listed || listed.regions.length === 0 || listed.countries.length === 0) return undefined
  const codes = new Set<string>(listed.countries)
  for (const slug of listed.regions) {
    const regionCodes = regionCountryCodes(slug)
    if (!regionCodes) return undefined
    for (const code of regionCodes) codes.add(code)
  }
  return [...codes]
}

const EXTRA_REGIONS: Record<string, readonly string[]> = { 'north-america': NORTH_AMERICA_REMOTE, americas: AMERICAS }

const TEXT_REGIONS: ReadonlyArray<readonly [slug: string, pattern: RegExp]> = [
  ['emea', /\bemea\b/i],
  ['europe', /\beurope(?:an)?\b/i],
  ['apac', /\bapac\b|\basia[\s-]pacific\b/i],
  ['middle-east', /\bmiddle[\s-]east\b/i],
  ['north-america', /\bnorth america\b/i],
  ['americas', /\bamericas\b/i],
]
// Text that narrows or widens the region, so the whole region would overstate (or understate) where applicants may live:
// "Eastern Europe", "US or Europe", "Europe and Asia". Read loosely on purpose, like WORLDWIDE_WORDS/LIMITING_WORDS in
// lib/jobs/remoteRegions.ts: no list beats a wrong one.
const REGION_TEXT_NARROWERS =
  /\b(?:eastern|western|northern|southern|central|nordics?|baltics?|dach|benelux|us|usa|u\.s\.?|uk|canada|latam|asia(?![\s-]*pacific)|africa|australia|india|worldwide|global|anywhere)\b/i

/** The countries of the one region a remote job's location text names, or undefined (a named country is more specific). */
function regionFromLocationText(raw: string): any[] | undefined {
  const text = raw.trim()
  if (!text || countryFromText(text) || REGION_TEXT_NARROWERS.test(text)) return undefined
  const hits = TEXT_REGIONS.filter(([, pattern]) => pattern.test(text))
  return hits.length === 1 ? regionCountryRequirements(hits[0][0]) : undefined
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
  // "San Francisco Office (Fremont St)", "Seattle Campus", LinkedIn's "Greater Phoenix Area" / "London Area": the city.
  // "San Francisco Bay Area" is a place of its own and stays.
  const v = value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*\([^()]*\)$/, '')
    .replace(/\s+(office|campus)$/i, '')
    .replace(/^greater\s+(.+?)(\s+metropolitan)?\s+area$/i, '$1')
    .replace(/^(?!.*\bbay\s+area$)(.+?)(\s+metropolitan)?\s+area$/i, '$1')
  if (!v || v.length > 60) return undefined
  if (/[•|;]/.test(v)) return undefined
  if (/^[A-Za-z]{1,3}([-_ ][A-Za-z]+)?$/.test(v) && v === v.toUpperCase()) return undefined
  if (/\b(remote|hq|headquarters|anywhere|worldwide|global|hybrid|on-?site|virtual|multiple locations)\b/i.test(v)) return undefined
  // A region or a choice of regions ("Europe or US") is not a town.
  if (/\b(europe|emea|apac|latam|americas|north america|south america|asia|(?<!south )africa|oceania)\b|\sor\s/i.test(v)) return undefined
  if (v.split(' ').length > 8) return undefined // a sentence, not a place
  return v
}

function usStateCode(token: string): string | undefined {
  const t = token.trim()
  if (t.length === 2) return US_STATE_CODES.has(t.toUpperCase()) ? t.toUpperCase() : undefined
  return US_STATE_CODE_BY_NAME[t.toLowerCase()]
}

const US_COUNTRY_TOKEN = /^(us|usa|u\.s\.a?\.?|united states( of america)?)$/i

/**
 * The city and state code in a US place written as "USA, CO, Boulder", "Eden Prairie, Minnesota, United States",
 * "San Jose, CA" or "Washington - Seattle Campus", or null when the text is not one of those. For US jobs only:
 * "Perth, WA" is in Western Australia.
 */
function splitUsPlace(text: unknown): { locality: string; region: string } | null {
  if (typeof text !== 'string') return null
  const t = text.replace(/\s+/g, ' ').trim()
  const dash = t.match(/^([A-Za-z .]+?) - (.+)$/)
  if (dash) {
    const region = usStateCode(dash[1])
    const locality = region ? cleanLocality(dash[2]) : undefined
    return region && locality ? { locality, region } : null
  }
  // "United States-Massachusetts-Boston": the country first, joined by hyphens.
  const hyphened = t.match(/^(?:us|usa|united states)-([a-z .]+)-(.+)$/i)
  let segs = hyphened ? [t.split('-')[0], hyphened[1], hyphened[2]] : t.split(',').map((s) => s.trim()).filter(Boolean)
  // Country first ("USA, CO, Boulder"): put it last like the usual order.
  if (segs.length === 3 && US_COUNTRY_TOKEN.test(segs[0]) && usStateCode(segs[1])) segs = [segs[2], segs[1]]
  if (segs.length === 3 && US_COUNTRY_TOKEN.test(segs[2])) segs = segs.slice(0, 2)
  if (segs.length !== 2) return null
  const region = usStateCode(segs[1])
  const locality = region ? cleanLocality(segs[0]) : undefined
  return region && locality ? { locality, region } : null
}

function buildJobLocation(job: any): any {
  const storedRegion = job.stateCode ? String(job.stateCode).toUpperCase() : undefined
  const cleanedCity = cleanLocality(job.city)
  // The stored country wins; the text is read only when it clearly names a country; then the company and the currency.
  const country = normalizeCountryCode(job.countryCode) ?? undefined
  // A placeholder ("Defer to Job Opening Location") is no place: never an addressLocality.
  const locationRaw = job.locationRaw && !isPlaceholderLocation(job.locationRaw) ? String(job.locationRaw).trim() : ''

  if (!country && !locationRaw && !cleanedCity) {
    return undefined
  }

  const addressCountry = country || inferCountryFromLocationRaw(locationRaw) || inferCountryFromJob(job) || undefined

  // "Los Angeles, CA, USA; Mountain View, CA, USA" is two workplaces, not one place named with a semicolon: Google
  // reads jobLocation as an array of places. Each place gets its own country; one whose country is unknown is left out.
  const places = !cleanedCity ? splitMultiLocation(locationRaw, addressCountry) : null
  if (places) return places.length > 0 ? places : undefined

  if (!addressCountry) {
    return undefined
  }

  // A US city stored with its state ("USA, CO, Boulder") or with the state only in the text ("Eden Prairie, Minnesota,
  // United States"): the city is the locality and the state the region. The text's state is used for a stored city
  // only when the text names that same city.
  const cityPlace = addressCountry === 'US' ? splitUsPlace(job.city) : null
  const city = cityPlace?.locality ?? cleanedCity
  const textPlace = addressCountry === 'US' ? splitUsPlace(locationRaw) : null
  const textRegion =
    textPlace && (!city || textPlace.locality.toLowerCase() === city.toLowerCase()) ? textPlace.region : undefined
  const placeName = city ?? textPlace?.locality ?? (countryOnly(locationRaw) ? undefined : cleanLocality(locationRaw))
  // A state named as the town ("New Jersey") is the region. "New York" and "Washington" are towns as well.
  const stateAsTown =
    addressCountry === 'US' && placeName && !/^(new york|washington)$/i.test(placeName)
      ? US_STATE_CODE_BY_NAME[placeName.toLowerCase()]
      : undefined
  const locality = stateAsTown ? undefined : placeName
  // Last, a well-known US city named alone ("Mountain View"): lib/location/usCityStates.ts leaves shared names out.
  const region =
    storedRegion ??
    cityPlace?.region ??
    textRegion ??
    stateAsTown ??
    (addressCountry === 'US' ? usStateOfCity(locality) : undefined)
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
    const usPlace = addressCountry === 'US' ? splitUsPlace(part) : null
    const region =
      usPlace?.region ??
      ((addressCountry === 'US' && US_STATE_CODES.has(code)) || (addressCountry === 'CA' && CA_PROVINCE_CODES.has(code))
        ? code
        : undefined)
    const locality = usPlace?.locality ?? (countryOnly(part) ? undefined : cleanLocality(segments[0] || part))
    const cityRegion = !region && addressCountry === 'US' ? usStateOfCity(locality) : undefined
    if (!addressCountry) continue
    out.push({
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(locality ? { addressLocality: locality } : {}),
        ...(region || cityRegion ? { addressRegion: region ?? cityRegion } : {}),
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
  if (typeof job.city === 'string' && job.city.trim() && !regionsAndCountriesOnly(job.city)) return true

  const locationRaw = typeof job.locationRaw === 'string' ? job.locationRaw.trim().toLowerCase() : ''
  if (!locationRaw) return false
  // "United States" or "Europe or US" on a remote job is where applicants may live, not an office.
  if (regionsAndCountriesOnly(locationRaw)) return false

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

const US_STATE_CODE_BY_NAME: Record<string, string> = {
  'alabama': 'AL',
  'alaska': 'AK',
  'arizona': 'AZ',
  'arkansas': 'AR',
  'california': 'CA',
  'colorado': 'CO',
  'connecticut': 'CT',
  'delaware': 'DE',
  'district of columbia': 'DC',
  'florida': 'FL',
  'georgia': 'GA',
  'hawaii': 'HI',
  'idaho': 'ID',
  'illinois': 'IL',
  'indiana': 'IN',
  'iowa': 'IA',
  'kansas': 'KS',
  'kentucky': 'KY',
  'louisiana': 'LA',
  'maine': 'ME',
  'maryland': 'MD',
  'massachusetts': 'MA',
  'michigan': 'MI',
  'minnesota': 'MN',
  'mississippi': 'MS',
  'missouri': 'MO',
  'montana': 'MT',
  'nebraska': 'NE',
  'nevada': 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  'ohio': 'OH',
  'oklahoma': 'OK',
  'oregon': 'OR',
  'pennsylvania': 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  'tennessee': 'TN',
  'texas': 'TX',
  'utah': 'UT',
  'vermont': 'VT',
  'virginia': 'VA',
  'washington': 'WA',
  'west virginia': 'WV',
  'wisconsin': 'WI',
  'wyoming': 'WY',
}

const US_STATE_NAMES = new Set(Object.keys(US_STATE_CODE_BY_NAME))

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
