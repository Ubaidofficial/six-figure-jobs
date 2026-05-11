import type { JobWithCompany } from '../jobs/queryJobs'
import { getSiteUrl } from './site'

type BreadcrumbListJsonLd = {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    item: string
  }>
}

function fullCompanyName(name: string | null | undefined): string {
  return String(name || '').trim() || 'Company'
}

export function buildJobBreadcrumbJsonLd(job: JobWithCompany, slug: string): BreadcrumbListJsonLd {
  const siteUrl = getSiteUrl()
  const companyName = fullCompanyName(job.companyRef?.name || job.company || '')
  const canonicalUrl = `${siteUrl}/job/${slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${siteUrl}/jobs` },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${job.title} at ${companyName}`,
        item: canonicalUrl,
      },
    ],
  }
}

