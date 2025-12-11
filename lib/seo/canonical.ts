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
  * Pattern:
  *   /jobs/{band}/{remote?}/{role?}/{country?}/{city?}
  *
  * Notes:
  *  - Salary band is always first to consolidate legacy/SEO variants.
  *  - Remote-only slices get a "remote" segment after the band.
  *  - Country/city segments are always lowercase to avoid duplicates.
  */
export function buildSliceCanonicalPath(filters: SliceFilters): string {
  const band = bandSlugFromMinAnnual(filters.minAnnual)
  const role = filters.roleSlugs?.[0]
  const country = filters.countryCode
  const city = filters.citySlug

  // Remote-first canonical to stay compatible with loader candidates
  if (filters.remoteOnly) {
    const parts = ['jobs', 'remote']
    if (role) parts.push(role)
    parts.push(band)
    return '/' + parts.join('/')
  }

  const parts: string[] = ['jobs', band]

  if (role) parts.push(role)
  if (country) {
    const countrySlug = countryCodeToSlug(country)
    if (countrySlug) parts.push(countrySlug)
  }
  if (city) parts.push(city.toLowerCase())

  return '/' + parts.join('/')
}

function normalizeSlugPath(slug?: string | null): string | null {
  if (!slug) return null
  const clean = slug.replace(/^\/+/, '')
  return '/' + clean
}

/**
 * Resolve the safest canonical path:
 *  - Prefer the normalized builder path.
 *  - If it differs from the stored slug, fall back to the stored slug to avoid 404s.
 */
export function resolveSliceCanonicalPath(
  filters: SliceFilters,
  slug?: string | null
): string {
  const built = buildSliceCanonicalPath(filters)
  const fallback = normalizeSlugPath(slug) ?? built
  return built === fallback ? built : fallback
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
