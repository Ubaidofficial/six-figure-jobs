// lib/seo/jobMeta.ts

import type { Metadata } from 'next'
import type { Job, Company } from '@prisma/client'
import { buildJobSlugHref } from '../jobs/jobSlug'
import { getSiteUrl, SITE_NAME } from './site'

export type JobWithCompany = Job & { companyRef: Company | null }

const SITE_URL = getSiteUrl()

export function buildJobMetadata(job: JobWithCompany): Metadata {
  const companyName =
    job.companyRef?.name || job.company || 'Company'

  const salary = buildSalary(job)
  const location =
    job.remote === true || job.remoteMode === 'remote'
      ? buildLocation(job) || 'Remote'
      : buildLocation(job) || 'Location not specified'

  const title = salary
    ? `${job.title} at ${companyName} — ${salary} | ${SITE_NAME}`
    : `${job.title} at ${companyName} | ${SITE_NAME}`

  const bits: string[] = []

  bits.push(`Apply for ${job.title} at ${companyName}.`)

  if (salary) {
    bits.push(`Compensation: ${salary}.`)
  } else if (job.isHundredKLocal || job.isHighSalary) {
    bits.push('High-paying $100k+ local-compensation role.')
  } else {
    bits.push('High-paying tech role.')
  }

  if (job.type) {
    bits.push(`Type: ${job.type}.`)
  }

  if (location) {
    bits.push(`Location: ${location}.`)
  }

  if (job.remote === true || job.remoteMode === 'remote') {
    bits.push('Remote-friendly opportunity.')
  }

  // Optional snippet from description for richer SEO, trimmed
  if (job.descriptionHtml) {
    const snippet = truncateText(
      stripTags(decodeHtmlEntities(job.descriptionHtml)),
      140
    )
    if (snippet) {
      bits.push(snippet)
    }
  }

  const description = bits.join(' ')

  const path = buildJobSlugHref(job)
  const url = `${SITE_URL}${path}`

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    robots: job.isExpired ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getCurrencySymbol(code?: string | null): string {
  if (!code) return '$'
  const upper = code.toUpperCase()
  switch (upper) {
    case 'USD':
      return '$'
    case 'EUR':
      return '€'
    case 'GBP':
      return '£'
    case 'AUD':
      return 'A$'
    case 'CAD':
      return 'C$'
    case 'SGD':
      return 'S$'
    case 'JPY':
      return '¥'
    case 'INR':
      return '₹'
    default:
      return `${upper} `
  }
}

/**
 * Salary builder:
 *  A) prefer minAnnual / maxAnnual (normalized local annual)
 *  B) fallback to salaryMin / salaryMax
 *  C) finally, use salaryRaw snippet
 */
function buildSalary(job: any): string | null {
  const primaryMin = job.minAnnual ?? job.salaryMin ?? null
  const primaryMax = job.maxAnnual ?? job.salaryMax ?? null

  let min = primaryMin != null ? Number(primaryMin) : null
  let max = primaryMax != null ? Number(primaryMax) : null

  if (min !== null && (!Number.isFinite(min) || min <= 0)) min = null
  if (max !== null && (!Number.isFinite(max) || max <= 0)) max = null

  const tooLarge =
    (min !== null && min > 2_000_000) ||
    (max !== null && max > 2_000_000)
  if (tooLarge) {
    min = null
    max = null
  }

  const currencyCode = job.currency || job.salaryCurrency || 'USD'
  const sym = getCurrencySymbol(currencyCode)

  const fmt = (v: number) =>
    v >= 1000 ? `${Math.round(v / 1000)}k` : v.toString()

  if (min !== null && max !== null) {
    if (min === max) return `${sym}${fmt(min)}/yr`
    return `${sym}${fmt(min)}–${sym}${fmt(max)}/yr`
  }

  if (min !== null) return `${sym}${fmt(min)}+/yr`
  if (max !== null) return `Up to ${sym}${fmt(max)}/yr`

  // C) Fallback: short snippet from salaryRaw
  if (job.salaryRaw) {
    const clean = truncateText(
      stripTags(decodeHtmlEntities(String(job.salaryRaw))),
      60
    )
    return clean || null
  }

  return null
}

/**
 * Match job page behaviour: remote vs on-site, with country/city.
 */
function buildLocation(job: any): string | null {
  const isRemote = job.remote === true || job.remoteMode === 'remote'

  if (isRemote) {
    if (job.countryCode) {
      return `Remote (${String(job.countryCode).toUpperCase()})`
    }
    return 'Remote'
  }

  if (job.city && job.countryCode) {
    return `${job.city}, ${String(job.countryCode).toUpperCase()}`
  }

  if (job.countryCode) {
    return String(job.countryCode).toUpperCase()
  }

  if (job.locationRaw) {
    return String(job.locationRaw)
  }

  return null
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripTags(str: string): string {
  return str.replace(/<\/?[^>]+(>|$)/g, '')
}

function truncateText(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str

  const truncated = str.slice(0, maxChars)
  const lastDot = truncated.lastIndexOf('.')
  const lastSpace = truncated.lastIndexOf(' ')

  const cutoff =
    lastDot !== -1 && lastDot > maxChars * 0.6
      ? lastDot + 1
      : lastSpace > 0
      ? lastSpace
      : maxChars

  return truncated.slice(0, cutoff) + ' …'
}
