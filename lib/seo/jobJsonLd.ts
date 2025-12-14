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

  const url = `${SITE_URL}/job/${buildJobSlug(job)}`

  // Remote detection MUST include remoteMode too (many ATS jobs set remoteMode)
  const isRemote = job.remote === true || job.remoteMode === 'remote'

  // ✅ REQUIRED by Google Jobs: datePosted must always exist
  const datePosted = (
    job.postedAt ??
    job.createdAt ??
    job.updatedAt ??
    new Date()
  ).toISOString()

  // Optional (recommended)
  const validThrough = (() => {
    const base = new Date(job.postedAt ?? job.createdAt ?? job.updatedAt ?? new Date())
    base.setDate(base.getDate() + 30)
    return base.toISOString()
  })()

  // ✅ REQUIRED by Google Jobs: description must always exist + not too short
  const description = cleanDescription(
    stripTags(job.descriptionHtml || null) ||
      (job.salaryRaw ? String(job.salaryRaw) : '') ||
      `${job.title} at ${companyName}`,
  )

  const baseSalary = buildBaseSalary(job)

  // Google Jobs:
  // - Remote: set jobLocationType=TELECOMMUTE and OMIT jobLocation
  // - Onsite/hybrid: provide valid Place -> PostalAddress
  const jobLocationType = isRemote ? 'TELECOMMUTE' : undefined

  // ✅ Emit ONE Place object (less error-prone in Google Jobs than arrays)
  const jobLocation = !isRemote ? buildJobLocation(job) : undefined

  // Remote: applicantLocationRequirements optional.
  // Only emit if we have a real country code.
  const applicantLocationRequirements =
    isRemote && job.countryCode
      ? {
          '@type': 'Country',
          name: String(job.countryCode).toUpperCase(),
        }
      : undefined

  // Build JSON-LD and avoid emitting undefined fields where possible
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

/* helpers */

function buildBaseSalary(job: any): any | undefined {
  const min = job.minAnnual != null ? Number(job.minAnnual) : null
  const max = job.maxAnnual != null ? Number(job.maxAnnual) : null

  if (!min && !max) return undefined

  const currency =
    (job.salaryCurrency as string | null | undefined) ||
    (job.currency as string | null | undefined) ||
    'USD'

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
  const country = job.countryCode
    ? String(job.countryCode).toUpperCase()
    : undefined

  // If we have neither, omit jobLocation entirely
  if (!city && !country) return undefined

  return {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      ...(city ? { addressLocality: city } : {}),
      ...(country ? { addressCountry: country } : {}),
    },
  }
}

function stripTags(str?: string | null): string {
  if (!str) return ''
  return str.replace(/<\/?[^>]+(>|$)/g, '')
}

function cleanDescription(s: string): string {
  const trimmed = (s || '').replace(/\s+/g, ' ').trim()
  if (trimmed.length >= 30) return trimmed
  // ensure non-empty (Google Jobs hates empty/too short)
  return `${trimmed} `.trim() || 'See job description on the page.'
}

function normalizeUrl(u: string): string {
  const s = u.trim()
  if (!s) return s
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  return `https://${s}`
}
