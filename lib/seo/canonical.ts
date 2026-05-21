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

function cleanSlug(input?: string | null): string | null {
  if (!input) return null
  const out = String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return out || null
}

/**
 * Canonical slice policy (v2.10):
 *  - Keep role-first path family to match seeded JobSlice slugs and avoid redirect churn.
 *  - Country-only and remote-only slices use their durable hub routes.
 *  - Pattern:
 *      /jobs/{role}/{country?}/{city?}/{band}
 *      /jobs/location/{country}
 *      /remote/{role?}
 */
export function buildSliceCanonicalPath(filters: SliceFilters): string {
  const band = bandSlugFromMinAnnual(filters.minAnnual)
  const role = cleanSlug(filters.roleSlugs?.[0] ?? null)
  const country = filters.countryCode
    ? cleanSlug(countryCodeToSlug(filters.countryCode) ?? filters.countryCode)
    : null
  const city = cleanSlug(filters.citySlug)
  const remoteOnly =
    filters.remoteOnly === true ||
    (filters.remoteMode === 'remote' && !country && !city)

  if (remoteOnly) {
    return role ? `/remote/${role}` : '/remote'
  }

  if (!role && country && !city) {
    return `/jobs/location/${country}`
  }

  const parts: string[] = ['jobs']

  if (role) parts.push(role)
  if (country) parts.push(country)
  if (city) parts.push(city)
  parts.push(band)

  return '/' + parts.join('/')
}

/**
 * Resolve canonical path.
 * Keep route canonicalization deterministic and non-redirecting.
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
