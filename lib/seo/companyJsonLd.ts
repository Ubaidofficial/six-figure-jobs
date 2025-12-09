// lib/seo/companyJsonLd.ts
import type { Company } from '@prisma/client'
import type { JobWithCompany } from '../jobs/queryJobs'
import { getSiteUrl } from './site'

const ORIGIN = getSiteUrl()

export function buildCompanyJsonLd(
  company: Company,
  jobs: JobWithCompany[]
) {
  const origin = ORIGIN

  // Optional description is not in the Prisma type, so read via `any`
  const description =
    ((company as any).description as string | null | undefined) ?? undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    url: `${origin}/company/${company.slug}`,
    logo: company.logoUrl || undefined,
    sameAs: company.website || undefined,
    description,
    jobPosting: jobs.slice(0, 10).map((job) => {
      const minAnnual =
        typeof job.minAnnual === 'bigint'
          ? Number(job.minAnnual)
          : job.minAnnual ?? undefined
      const maxAnnual =
        typeof job.maxAnnual === 'bigint'
          ? Number(job.maxAnnual)
          : job.maxAnnual ?? undefined

      return {
        '@type': 'JobPosting',
        title: job.title,
        employmentType: job.type || 'Full-time',
        hiringOrganization: {
          '@type': 'Organization',
          name: company.name,
          sameAs: company.website || undefined,
        },
        jobLocationType: job.remote ? 'Remote' : undefined,
        applicantLocationRequirements: job.countryCode
          ? {
              '@type': 'Country',
              name: job.countryCode,
            }
          : undefined,
        baseSalary:
          minAnnual || maxAnnual
            ? {
                '@type': 'MonetaryAmount',
                currency: job.currency || 'USD',
                value: {
                  '@type': 'QuantitativeValue',
                  minValue: minAnnual,
                  maxValue: maxAnnual,
                  unitText: 'YEAR',
                },
              }
            : undefined,
        datePosted: job.postedAt?.toISOString() ?? undefined,
        validThrough: job.isExpired
          ? undefined
          : job.lastSeenAt?.toISOString() ?? undefined,
        directApply: true,
      }
    }),
  }
}
