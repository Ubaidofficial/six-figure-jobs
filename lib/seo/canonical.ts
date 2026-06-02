// lib/seo/canonical.ts
// Helpers for producing a single canonical URL shape for job slices.

import { getSiteUrl } from './site'
import type { SliceFilters } from '../slices/types'
import { countryCodeToSlug } from './countrySlug'
import { isCanonicalSlug } from '../roles/canonicalSlugs'
import { findBestMatchingRole } from '../roles/slugMatcher'

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

function resolveCanonicalRoleSlug(input?: string | null): string | null {
  const slug = cleanSlug(input)
  if (!slug) return null
  if (isCanonicalSlug(slug)) return slug
  return findBestMatchingRole(slug)
}

/**
 * Canonical slice policy:
 *  - Emit only routes that resolve directly, without relying on redirects.
 *  - Role salary slices use /jobs/{role}/{band}.
 *  - Country-only and remote-only slices use their durable hub routes.
 */
export function buildSliceCanonicalPath(filters: SliceFilters): string {
  const band = bandSlugFromMinAnnual(filters.minAnnual)
  const role = resolveCanonicalRoleSlug(filters.roleSlugs?.[0] ?? null)
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

  if (role && city) {
    return `/jobs/${role}/city/${city}`
  }

  if (role && filters.minAnnual) {
    return `/jobs/${role}/${band}`
  }

  if (role) {
    return `/jobs/${role}`
  }

  if (filters.minAnnual) {
    return `/jobs/${band}`
  }

  return '/jobs'
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
