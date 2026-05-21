// lib/seo/companyJsonLd.ts
import type { Company } from '@prisma/client'
import type { JobWithCompany } from '../jobs/queryJobs'
import { normalizePublicCompanyWebsite } from '../companies/website'
import { getSiteUrl } from './site'

const ORIGIN = getSiteUrl()

export function buildCompanyJsonLd(
  company: Company,
  _jobs: JobWithCompany[]
) {
  const origin = ORIGIN

  // Optional description is not in the Prisma type, so read via `any`
  const description =
    ((company as any).description as string | null | undefined) ?? undefined
  const publicWebsite = normalizePublicCompanyWebsite(company.website)

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    url: `${origin}/company/${company.slug}`,
    logo: company.logoUrl || undefined,
    sameAs: publicWebsite || undefined,
    description,
  }
}
