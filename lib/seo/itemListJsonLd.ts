// lib/seo/itemListJsonLd.ts
// v2.9: Listing pages must NOT emit JobPosting JSON-LD.

import { getSiteUrl } from './site'
import { buildJobSlugHref } from '../jobs/jobSlug'

const SITE_URL = getSiteUrl()

export function buildItemListJsonLd(input: {
  name: string
  jobs: Array<{ id: string; title?: string | null }>
  page: number
  pageSize: number
}): any {
  const page = Math.max(1, input.page || 1)
  const pageSize = Math.max(1, input.pageSize || 1)

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: input.name,
    itemListElement: input.jobs.map((job, i) => ({
      '@type': 'ListItem',
      position: (page - 1) * pageSize + i + 1,
      url: `${SITE_URL}${buildJobSlugHref(job as any)}`,
    })),
  }
}

