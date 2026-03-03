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

  const validThrough = (() => {
    const base = new Date(job.postedAt ?? job.createdAt ?? job.updatedAt ?? new Date())
    base.setDate(base.getDate() + 30)
    return base.toISOString()
  })()

  const description = buildPlainTextDescription(job, companyName)
  const baseSalary = buildBaseSalary(job)

  const jobLocationType = isRemote ? 'TELECOMMUTE' : undefined
  const jobLocation = isRemote ? undefined : buildJobLocation(job)

  const applicantLocationRequirements = isRemote ? buildApplicantLocationRequirements(job) : undefined

  const employmentType = job.type || job.employmentType || 'Full-time'

  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',

    title: job.title,
    description,
    url,

    datePosted,
    validThrough,

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

function buildPlainTextDescription(job: any, companyName: string): string {
  const text = String(job.descriptionText || '').trim()
  if (text) return cleanDescription(text)

  const raw = String(job.descriptionHtml || '').trim()

  const decoded = raw ? decodeHtmlEntities(raw) : ''
  const noTags = decoded ? stripTags(decoded) : ''
  const noTags2 = noTags.includes('<') ? stripTags(noTags) : noTags

  const fallback = (job.salaryRaw ? String(job.salaryRaw) : '') || `${job.title} at ${companyName}`

  return cleanDescription(noTags2 || fallback)
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

  if (!city && !region && !country && !locationRaw) {
    return undefined
  }

  return {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      ...(city ? { addressLocality: city } : {}),
      ...(region ? { addressRegion: region } : {}),
      ...(country ? { addressCountry: country } : {}),
      ...(!city && locationRaw ? { addressLocality: locationRaw } : {}),
    },
  }
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
