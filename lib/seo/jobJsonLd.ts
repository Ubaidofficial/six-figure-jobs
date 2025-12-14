// lib/seo/jobJsonLd.ts

import type { Job, Company } from '@prisma/client'
import { getSiteUrl } from './site'
import { buildJobSlug } from '../jobs/jobSlug'

export type JobWithCompany = Job & { companyRef: Company | null }

const SITE_URL = getSiteUrl()

export function buildJobJsonLd(job: JobWithCompany): any {
  const company = job.companyRef

  const companyName = company?.name || job.company || 'Company'
  const companyUrl =
    (company?.website && normalizeUrl(company.website)) || undefined
  const logo =
    (company?.logoUrl && normalizeUrl(company.logoUrl)) ||
    (job.companyLogo && normalizeUrl(job.companyLogo)) ||
    undefined

  // ✅ Canonical job URL (v2.8)
  const url = `${SITE_URL}/job/${buildJobSlug(job as any)}`

  // Remote detection MUST include remoteMode too
  const isRemote = job.remote === true || job.remoteMode === 'remote'

  // ✅ REQUIRED by Google Jobs: datePosted must always exist
  const datePosted = (
    job.postedAt ??
    job.createdAt ??
    job.updatedAt ??
    new Date()
  ).toISOString()

  // Optional (recommended): validThrough
  const validThrough = (() => {
    const base = new Date(
      job.postedAt ?? job.createdAt ?? job.updatedAt ?? new Date(),
    )
    base.setDate(base.getDate() + 30)
    return base.toISOString()
  })()

  // ✅ REQUIRED: description must exist and be plain text (NOT HTML, NOT escaped HTML)
  const description = buildPlainTextDescription(job, companyName)

  const baseSalary = buildBaseSalary(job)

  // Google Jobs:
  // - Remote: set jobLocationType=TELECOMMUTE and OMIT jobLocation
  // - Onsite/hybrid: provide valid Place -> PostalAddress (ideally includes country)
  const jobLocationType = isRemote ? 'TELECOMMUTE' : undefined
  const jobLocation = !isRemote ? buildJobLocation(job) : undefined

  // Remote: applicantLocationRequirements optional (only if countryCode exists)
  const applicantLocationRequirements =
    isRemote && job.countryCode
      ? {
          '@type': 'Country',
          name: String(job.countryCode).toUpperCase(),
        }
      : undefined

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

    ...(job.type ? { employmentType: job.type } : {}),

    ...(jobLocationType ? { jobLocationType } : {}),
    ...(jobLocation ? { jobLocation } : {}),
    ...(baseSalary ? { baseSalary } : {}),
    ...(applicantLocationRequirements
      ? { applicantLocationRequirements }
      : {}),

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
  // Some sources store HTML, some store HTML-escaped HTML. Normalize both.
  const raw = String(job.descriptionHtml || '').trim()

  const decoded = raw ? decodeHtmlEntities(raw) : ''
  const noTags = decoded ? stripTags(decoded) : ''

  // If we somehow ended up with escaped tags after stripping (rare), strip again
  const noTags2 = noTags.includes('<') ? stripTags(noTags) : noTags

  // Fallbacks
  const fallback =
    (job.salaryRaw ? String(job.salaryRaw) : '') ||
    `${job.title} at ${companyName}`

  return cleanDescription(noTags2 || fallback)
}

function buildBaseSalary(job: any): any | undefined {
  const rawMin = toNumberSafe(job.minAnnual)
  const rawMax = toNumberSafe(job.maxAnnual)

  if (!rawMin && !rawMax) return undefined

  const min = rawMin ? normalizeAnnualAmount(rawMin) : null
  const max = rawMax ? normalizeAnnualAmount(rawMax) : null

  // Prefer explicit salaryCurrency if present; else currency; else USD.
  const currency =
    (job.salaryCurrency as string | null | undefined) ||
    (job.currency as string | null | undefined) ||
    'USD'

  // Guardrails: if we ended up with nonsense, omit salary entirely.
  // (Google Jobs is better with no salary than a wildly wrong one.)
  if (
    (min && (min < 5_000 || min > 5_000_000)) ||
    (max && (max < 5_000 || max > 5_000_000))
  ) {
    return undefined
  }

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

function buildJobLocation(job: any): any | undefined {
  const city = job.city ? String(job.city) : undefined
  const region =
    job.region || job.state ? String(job.region || job.state) : undefined
  const country = job.countryCode
    ? String(job.countryCode).toUpperCase()
    : undefined

  // If we have neither, omit jobLocation entirely
  if (!city && !region && !country) return undefined

  return {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      ...(city ? { addressLocality: city } : {}),
      ...(region ? { addressRegion: region } : {}),
      ...(country ? { addressCountry: country } : {}),
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
  // Heuristic: if it looks like cents (e.g. 14560000000), convert to dollars.
  // Most real annual salaries in dollars are < 10,000,000.
  if (n >= 1_000_000 && n % 100 === 0) return Math.round(n / 100)
  if (n >= 10_000_000) return Math.round(n / 100) // fallback for non-100-multiple
  return Math.round(n)
}

function stripTags(str?: string | null): string {
  if (!str) return ''
  return str.replace(/<\/?[^>]+(>|$)/g, '')
}

function cleanDescription(s: string): string {
  const trimmed = (s || '').replace(/\s+/g, ' ').trim()
  if (trimmed.length >= 30) return trimmed
  return `${trimmed} `.trim() || 'See job description on the page.'
}

function decodeHtmlEntities(input: string): string {
  // Minimal + safe decode (covers what we saw in your JSON-LD)
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
