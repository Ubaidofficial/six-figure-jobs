// lib/seo/structuredData.ts
import type { JobSlice } from '../slices/types'
import type { JobQueryResult } from '../jobs/queryJobs'
import { buildCanonicalUrl } from './meta'
import { getSiteUrl } from './site'
import { buildJobSlugHref } from '../jobs/jobSlug'

const SITE_ORIGIN = getSiteUrl()

export function buildJobListJsonLd(
  slice: JobSlice,
  data: JobQueryResult
): any {
  const url = buildCanonicalUrl(slice, data.page)

  const itemListElement = data.jobs.map((job, index) => {
    const jobUrl = `${SITE_ORIGIN}${buildJobSlugHref(job)}`

    return {
      '@type': 'ListItem',
      position: index + 1,
      url: jobUrl,
      name: job.title,
    }
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    url,
    numberOfItems: data.jobs.length,
    itemListElement,
  }
}

export function buildBreadcrumbJsonLd(slice: JobSlice): any {
  const segments = slice.slug.split('/').filter(Boolean)
  const items: any[] = []

  // Always add homepage
  items.push({
    '@type': 'ListItem',
    position: 1,
    name: 'Home',
    item: SITE_ORIGIN + '/',
  })

  let acc = ''
  segments.forEach((segment, i) => {
    acc += '/' + segment
    items.push({
      '@type': 'ListItem',
      position: i + 2,
      name: segment === 'jobs' ? 'Jobs' : segment.replace(/-/g, ' '),
      item: SITE_ORIGIN + acc,
    })
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}
