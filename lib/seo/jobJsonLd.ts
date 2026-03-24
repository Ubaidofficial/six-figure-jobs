// lib/seo/jobJsonLd.ts

import type { Job, Company } from '@prisma/client'
import { getSiteUrl } from './site'
import { buildJobSlug } from '../jobs/jobSlug'
import { getHighSalaryThresholdAnnual } from '../currency/thresholds'
import { getAnnualSalaryCapForCurrency } from '../normalizers/salary'

export type JobWithCompany = Job & { companyRef: Company | null }

const SITE_URL = getSiteUrl()

export function buildJobJsonLd(job: JobWithCompany): any {
  const company = job.companyRef

  const companyName = company?.name || job.company || 'Company'
  const companyUrl = (company?.website && normalizeUrl(company.website)) || undefined
  const logo =
    (company?.logoUrl && normalizeUrl(company.logoUrl)) ||
    (job.companyLogo && normalizeUrl(job.companyLogo)) ||
    undefined

  const url = `${SITE_URL}/job/${buildJobSlug(job as any)}`

  const isRemote = job.remote === true || job.remoteMode === 'remote'

  const datePosted = (job.postedAt ?? job.createdAt ?? job.updatedAt ?? new Date()).toISOString()

  const description = buildStructuredDescription(job, companyName)
  const baseSalary = buildBaseSalary(job)

  const jobLocationType = isRemote ? 'TELECOMMUTE' : undefined
  const jobLocation = isRemote ? undefined : buildJobLocation(job)

  const applicantLocationRequirements = isRemote ? buildApplicantLocationRequirements(job) : undefined

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
    const sanitized = sanitizeDescriptionHtmlForJsonLd(raw)
    if (sanitized) return sanitized
  }

  const text = String(job.descriptionText || '').trim()
  if (text) return wrapPlainTextAsHtml(cleanDescription(text))

  const fallback = (job.salaryRaw ? String(job.salaryRaw) : '') || `${job.title} at ${companyName}`
  return wrapPlainTextAsHtml(cleanDescription(fallback))
}

function buildBaseSalary(job: any): any | undefined {
  if (job?.salaryValidated !== true) return undefined

  const rawMin = toNumberSafe(job.minAnnual)
  const rawMax = toNumberSafe(job.maxAnnual)

  if (!rawMin && !rawMax) return undefined

  const min = rawMin ? normalizeAnnualAmount(rawMin) : null
  const max = rawMax ? normalizeAnnualAmount(rawMax) : null

  const currency = (job.salaryCurrency as string | null | undefined) || (job.currency as string | null | undefined)

  const threshold = getHighSalaryThresholdAnnual(currency)
  if (!currency || threshold == null) return undefined

  if ((min && min <= 0) || (max && max <= 0)) return undefined
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

function buildApplicantLocationRequirements(job: any): any | undefined {
  const raw = (job.countryCode ? String(job.countryCode) : '') || (job.remoteRegion ? String(job.remoteRegion) : '')

  const s = raw.trim()

  // Default to US if no country specified for remote jobs
  if (!s) {
    return { '@type': 'Country', name: 'United States' }
  }

  const upper = s.toUpperCase()

  // Block non-geo placeholders
  if (upper === 'GLOBAL' || upper === 'WORLDWIDE' || upper === 'ANYWHERE' || upper === 'REMOTE' || upper === 'INTERNATIONAL') {
    return { '@type': 'Country', name: 'United States' }
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
  if (s.length >= 3 && s.length <= 60) {
    return { '@type': 'Country', name: s }
  }

  return { '@type': 'Country', name: 'United States' }
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

  if (!country && !locationRaw) {
    return undefined
  }

  const addressCountry = country || inferCountryFromLocationRaw(locationRaw)

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
