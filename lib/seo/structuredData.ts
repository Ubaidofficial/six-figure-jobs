// lib/seo/structuredData.ts
import type { JobSlice } from '../slices/types'
import type { JobQueryResult } from '../jobs/queryJobs'
import { buildCanonicalUrl, buildSliceDescription, buildSliceTitle } from './meta'
import { getSiteUrl, SITE_NAME } from './site'
import { buildJobSlugHref } from '../jobs/jobSlug'
import { SliceFilters } from '../slices/types'

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

export function buildSliceWebPageJsonLd(
  slice: JobSlice,
  data: JobQueryResult
): any {
  const url = buildCanonicalUrl(slice, data.page)
  const name = buildSliceTitle(slice, { page: data.page })
  const description = buildSliceDescription(slice, {
    page: data.page,
    totalJobs: data.total,
  })

  return {
    '@context': 'https://schema.org',
    '@type': ['CollectionPage', 'WebPage'],
    url,
    name,
    description,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_ORIGIN,
    },
  }
}

function humanizeRole(slug?: string | null): string | null {
  if (!slug) return null
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function countryNameFromCode(code?: string | null): string | null {
  if (!code) return null
  const upper = code.toUpperCase()
  const map: Record<string, string> = {
    US: 'United States',
    CA: 'Canada',
    GB: 'United Kingdom',
    DE: 'Germany',
    ES: 'Spain',
    IE: 'Ireland',
    AU: 'Australia',
    IN: 'India',
  }
  return map[upper] ?? upper
}

export function buildSliceFaqJsonLd(
  slice: JobSlice,
  totalJobs?: number
): any {
  const f: SliceFilters = slice.filters
  const role = humanizeRole(f.roleSlugs?.[0])
  const band =
    f.minAnnual && f.minAnnual >= 400000
      ? '$400k+'
      : f.minAnnual && f.minAnnual >= 300000
      ? '$300k+'
      : f.minAnnual && f.minAnnual >= 200000
      ? '$200k+'
      : '$100k+'
  const country = countryNameFromCode(f.countryCode)

  const locationPhrase = f.remoteOnly
    ? 'remote roles'
    : country
    ? `${country}`
    : 'global roles'

  const jobCountText =
    typeof totalJobs === 'number' && totalJobs > 0
      ? `${totalJobs.toLocaleString()} live jobs`
      : 'live high-salary jobs'

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What kinds of jobs are on this page?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Curated ${band} ${role ? `${role} ` : ''}${locationPhrase} sourced directly from company ATS feeds with verified salary bands.`,
        },
      },
      {
        '@type': 'Question',
        name: `How often are these listings updated?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Listings refresh daily; expired roles are removed automatically. ${jobCountText} are currently available.`,
        },
      },
      {
        '@type': 'Question',
        name: `Do you include remote and hybrid roles?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. Each job carries a remote/hybrid/on-site flag plus country filters so candidates see eligibility before clicking apply.`,
        },
      },
    ],
  }
}

export function buildSliceSpeakableJsonLd(): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'SpeakableSpecification',
    cssSelector: [
      'main h1',
      'main h2',
      '[data-speakable="summary"]',
    ],
  }
}
