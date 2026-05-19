// lib/seo/jobJsonLd.ts

import type { Job, Company } from '@prisma/client'
import { normalizePublicCompanyWebsite } from '../companies/website'
import { getSiteUrl } from './site'
import { buildJobSlug } from '../jobs/jobSlug'
import { getAnnualSalaryCapForCurrency } from '../normalizers/salary'
import { buildJobValidThroughDate } from '../jobs/validThrough'
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
  const logo =
    (company?.logoUrl && normalizeUrl(company.logoUrl)) ||
    (job.companyLogo && normalizeUrl(job.companyLogo)) ||
    undefined

  const url = `${SITE_URL}/job/${buildJobSlug(job as any)}`

  const postedAt = job.postedAt ?? job.createdAt ?? job.updatedAt ?? new Date()
  const datePosted = postedAt.toISOString()

  const description = buildStructuredDescription(job, companyName)
  const baseSalary = buildBaseSalary(job)
  const validThrough = buildValidThrough(job)
  const directApply = false

  const physicalJobLocation = buildJobLocation(job)
  const isRemote = isRemoteJob(job)
  const isHybrid = job.remoteMode === 'hybrid' || (isRemote && hasPhysicalWorkplace(job))
  const applicantLocationRequirements = isRemote ? buildApplicantLocationRequirements(job) : undefined
  const jobLocation = isRemote && !isHybrid ? undefined : physicalJobLocation
  const jobLocationType = isRemote || isHybrid ? 'TELECOMMUTE' : undefined

  const employmentType = normalizeEmploymentType(job.type || job.employmentType) || 'FULL_TIME'

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

    employmentType,

    ...(validThrough ? { validThrough } : {}),
    directApply,
    ...(jobLocationType ? { jobLocationType } : {}),
    ...(jobLocation ? { jobLocation } : {}),
    ...(baseSalary ? { baseSalary } : {}),
    ...(applicantLocationRequirements ? { applicantLocationRequirements } : {}),

    identifier: {
      '@type': 'PropertyValue',
      name: job.source || 'SixFigureJobs',
      value: job.id,
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
  const rawMin = toNumberSafe(job.salaryMin ?? job.minAnnual)
  const rawMax = toNumberSafe(job.salaryMax ?? job.maxAnnual)

  if (!rawMin && !rawMax) return undefined

  const min = rawMin ? normalizeAnnualAmount(rawMin) : null
  const max = rawMax ? normalizeAnnualAmount(rawMax) : null

  const currency = (job.salaryCurrency as string | null | undefined) || (job.currency as string | null | undefined)

  if (!currency) return undefined

  if ((min && min <= 0) || (max && max <= 0)) return undefined
  if (min && min < 100_000) return undefined
  const cap = getAnnualSalaryCapForCurrency(currency)
  if ((min && min > cap) || (max && max > cap)) return undefined

  return {
    '@type': 'MonetaryAmount',
    currency,
    value: {
      '@type': 'QuantitativeValue',
      ...(min ? { minValue: min } : {}),
      ...(max ? { maxValue: max } : {}),
      unitText: 'YEAR',
    },
  }
}

function buildValidThrough(job: any): string | undefined {
  const explicit = readDateField(job, 'validThrough') ?? readDateField(job, 'expiresAt')
  const posted = readDateField(job, 'postedAt') ?? readDateField(job, 'createdAt') ?? readDateField(job, 'updatedAt')
  if (explicit && explicit.getTime() > Date.now()) return explicit.toISOString()
  return buildJobValidThroughDate(posted ?? new Date()).toISOString()
}

function buildApplicantLocationRequirements(job: any): any | undefined {
  const remoteRegion = typeof job.remoteRegion === 'string' ? job.remoteRegion.trim() : ''
  if (remoteRegion) {
    return { '@type': 'Country', name: remoteRegion }
  }

  const rawCandidates = [
    job.countryCode ? String(job.countryCode) : '',
    job.locationRaw ? String(job.locationRaw) : '',
  ].filter(Boolean)

  for (const candidate of rawCandidates) {
    const requirement = parseApplicantLocationRequirement(candidate)
    if (requirement) return requirement
  }

  const fallbackCountry = inferCountryFromJob(job)
  if (fallbackCountry) {
    return {
      '@type': 'Country',
      name: countryNameFromCode(fallbackCountry) || fallbackCountry,
    }
  }

  return undefined
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

  // ISO-3166-1 alpha-2 country code
  if (/^[A-Z]{2}$/.test(upper)) {
    const name = countryNameFromCode(upper) || upper
    return { '@type': 'Country', name }
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
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' })
    return dn.of(code) || null
  } catch {
    return null
  }
}

function buildJobLocation(job: any): any {
  const city = job.city ? String(job.city) : undefined
  const region = job.stateCode ? String(job.stateCode).toUpperCase() : undefined
  const country = job.countryCode ? String(job.countryCode).toUpperCase() : undefined
  const locationRaw = job.locationRaw ? String(job.locationRaw).trim() : ''

  if (!country && !locationRaw && !city) {
    return undefined
  }

  const addressCountry = country || inferCountryFromLocationRaw(locationRaw) || inferCountryFromJob(job)

  if (!addressCountry) {
    return undefined
  }

  return {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      ...(city ? { addressLocality: city } : {}),
      ...(region ? { addressRegion: region } : {}),
      ...(addressCountry ? { addressCountry } : {}),
      ...(!city && locationRaw ? { addressLocality: locationRaw } : {}),
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
  if (job.remote === true || job.remoteMode === 'remote') return true

  const text = [
    job.title,
    job.locationRaw,
    job.remoteRegion,
    job.workArrangement,
    job.workArrangementNormalized,
    job.descriptionHtml,
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
  if (normalized === 'full time') return 'FULL_TIME'
  if (normalized === 'part time') return 'PART_TIME'
  if (normalized === 'contract' || normalized === 'contractor' || normalized === 'freelance') {
    return 'CONTRACTOR'
  }
  if (normalized === 'temporary' || normalized === 'temp' || normalized === 'seasonal') {
    return 'TEMPORARY'
  }
  if (normalized === 'intern' || normalized === 'internship') return 'INTERN'
  if (normalized === 'volunteer') return 'VOLUNTEER'
  if (normalized === 'per diem') return 'PER_DIEM'

  return raw
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

function inferCountryFromLocationRaw(locationRaw: string): string | null {
  const raw = String(locationRaw || '').trim()
  if (!raw) return null

  const upper = raw.toUpperCase()
  if (/^[A-Z]{2}$/.test(upper)) return upper

  const tokens = raw
    .split(/[,\-/|]/)
    .map((part) => part.trim())
    .filter(Boolean)

  for (const token of tokens) {
    const code = token.toUpperCase()
    if (/^[A-Z]{2}$/.test(code)) return code
  }

  const lower = raw.toLowerCase()
  const regionNames = ['United States', 'United Kingdom', 'Canada', 'Germany', 'Australia', 'India']

  for (const name of regionNames) {
    if (lower.includes(name.toLowerCase())) {
      const match = regionCodeFromName(name)
      if (match) return match
    }
  }

  return null
}

function inferCountryFromJob(job: any): string | null {
  const explicitCountry = typeof job.countryCode === 'string' ? job.countryCode.trim().toUpperCase() : ''
  if (/^[A-Z]{2}$/.test(explicitCountry)) return explicitCountry

  const companyCountry =
    job.companyRef && typeof job.companyRef.countryCode === 'string'
      ? job.companyRef.countryCode.trim().toUpperCase()
      : ''
  if (/^[A-Z]{2}$/.test(companyCountry)) return companyCountry

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

  const currency = String(job.salaryCurrency || job.currency || '').toUpperCase()
  const currencyCountryMap: Record<string, string> = {
    USD: 'US',
    CAD: 'CA',
    GBP: 'GB',
    AUD: 'AU',
    EUR: 'DE',
  }

  return currencyCountryMap[currency] ?? null
}

function regionCodeFromName(name: string): string | null {
  try {
    const regions = ['US', 'GB', 'CA', 'DE', 'AU', 'IN']
    const dn = new Intl.DisplayNames(['en'], { type: 'region' })
    for (const code of regions) {
      if (dn.of(code)?.toLowerCase() === name.toLowerCase()) return code
    }
  } catch {
    return null
  }
  return null
}

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
