// lib/seo/jobJsonLd.ts

import type { Job, Company } from '@prisma/client'
import { getSiteUrl } from './site'

export type JobWithCompany = Job & { companyRef: Company | null }

const SITE_URL = getSiteUrl()

export function buildJobJsonLd(job: JobWithCompany): any {
  const company = job.companyRef
  const companyName = company?.name || job.company
  const companyUrl = company?.website || SITE_URL
  const logo = company?.logoUrl || job.companyLogo || undefined

  const datePosted =
    job.postedAt?.toISOString() || job.createdAt.toISOString()

  const validThrough = (() => {
    const base = job.postedAt
      ? new Date(job.postedAt)
      : new Date(job.createdAt)
    base.setDate(base.getDate() + 30)
    return base.toISOString()
  })()

  const description =
    stripTags(
      ((job as any).description as string | null | undefined) ??
        (job.salaryRaw as string | null | undefined) ??
        job.title
    ) || job.title

  const baseSalary = buildBaseSalary(job)

  const jobLocationType = job.remote ? 'TELECOMMUTE' : undefined

  const jobLocation =
    !job.remote && (job.city || job.countryCode)
      ? [
          {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressLocality: job.city || undefined,
              addressCountry: job.countryCode || undefined,
            },
          },
        ]
      : undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description,
    datePosted,
    validThrough,
    employmentType: job.type || undefined,
    hiringOrganization: {
      '@type': 'Organization',
      name: companyName,
      sameAs: companyUrl,
      logo,
    },
    jobLocationType,
    jobLocation,
    baseSalary,
    applicantLocationRequirements: job.remote
      ? [
          {
            '@type': 'Country',
            name: job.countryCode || 'Worldwide',
          },
        ]
      : undefined,
  }
}

/* helpers */

function buildBaseSalary(job: any): any {
  const min =
    job.minAnnual != null ? Number(job.minAnnual) : null
  const max =
    job.maxAnnual != null ? Number(job.maxAnnual) : null

  if (!min && !max) return undefined

  const currency = job.currency || 'USD'

  return {
    '@type': 'MonetaryAmount',
    currency,
    value: {
      '@type': 'QuantitativeValue',
      minValue: min || undefined,
      maxValue: max || undefined,
      unitText: 'YEAR',
    },
  }
}

function stripTags(str?: string | null): string {
  if (!str) return ''
  return str.replace(/<\/?[^>]+(>|$)/g, '')
}
