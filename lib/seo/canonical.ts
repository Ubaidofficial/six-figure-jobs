// lib/seo/canonical.ts
// Helpers for producing a single canonical URL shape for job slices.

import { getSiteUrl } from './site'
import type { SliceFilters } from '../slices/types'
import { countryCodeToSlug } from './countrySlug'

const BAND_SLUGS: Record<number, string> = {
  100000: '100k-plus',
  200000: '200k-plus',
  300000: '300k-plus',
  400000: '400k-plus',
}

function bandSlugFromMinAnnual(minAnnual?: number): string {
  if (!minAnnual) return '100k-plus'

  const rounded = Math.round(minAnnual / 1000) * 1000
  const known = BAND_SLUGS[rounded]
  if (known) return known

  if (rounded >= 400000) return '400k-plus'
  if (rounded >= 300000) return '300k-plus'
  if (rounded >= 200000) return '200k-plus'
  return '100k-plus'
}

/**
 * Build the canonical path for a JobSlice based on its filters.
 *
 * Canonical pattern:
 *   /jobs/{band}/{remote?}/{role?}/{country?}/{city?}
 *
 * Notes:
 *  - Salary band is always first to consolidate variants.
 *  - Remote-only slices get a "remote" segment after the band.
 *  - Country/city segments are lowercase to avoid duplicates.
 */
export function buildSliceCanonicalPath(filters: SliceFilters): string {
  const band = bandSlugFromMinAnnual(filters.minAnnual)
  const role = filters.roleSlugs?.[0]
  const country = filters.countryCode
  const city = filters.citySlug

  const parts: string[] = ['jobs', band]

  if (filters.remoteOnly) parts.push('remote')
  if (role) parts.push(role)

  if (country) {
    const countrySlug = countryCodeToSlug(country)
    if (countrySlug) parts.push(countrySlug)
  }
  if (city) parts.push(city.toLowerCase())

  return '/' + parts.join('/')
}

/**
 * Resolve canonical path.
 * For SEO, always prefer the built canonical. Handle legacy slugs via redirects.
 */
export function resolveSliceCanonicalPath(
  filters: SliceFilters,
  _slug?: string | null
): string {
  return buildSliceCanonicalPath(filters)
}

export function buildSliceCanonicalUrl(
  filters: SliceFilters,
  page: number,
  slug?: string | null
): string {
  const basePath = resolveSliceCanonicalPath(filters, slug)
  const origin = getSiteUrl()
  if (page <= 1) return origin + basePath
  return `${origin}${basePath}?page=${page}`
}
