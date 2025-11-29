// lib/slices/types.ts

import type { JobSlice as JobSliceRow } from '@prisma/client'

/**
 * Filters we support on Job queries.
 * These correspond to what you store in JobSlice.filtersJson.
 */
export type SliceFilters = {
  roleSlugs?: string[]
  skillSlugs?: string[]
  minAnnual?: number
  maxAnnual?: number
  countryCode?: string
  citySlug?: string
  remoteOnly?: boolean
  companySlug?: string
  isHundredKLocal?: boolean
  maxJobAgeDays?: number // NOTE: no default; only used if explicitly set
}

/**
 * Enriched JobSlice returned by our loaders.
 */
export type JobSlice = JobSliceRow & {
  filters: SliceFilters
}

/**
 * Parse filtersJson from the raw Prisma JobSlice row
 * and normalize into a strongly-typed filters object.
 *
 * IMPORTANT: we do NOT set a default for maxJobAgeDays here.
 * If it's absent from filtersJson, it stays undefined,
 * so queryJobs() will NOT apply a postedAt >= cutoff filter.
 */
export function parseSliceFilters(row: JobSliceRow): JobSlice {
  let raw: any = {}

  try {
    raw = row.filtersJson ? JSON.parse(row.filtersJson) : {}
  } catch (err) {
    console.error('Invalid filtersJson for JobSlice', row.slug, err)
    raw = {}
  }

  const filters: SliceFilters = {
    // Support either roleSlugs array or legacy roleSlug single
    roleSlugs: raw.roleSlugs ?? (raw.roleSlug ? [raw.roleSlug] : undefined),
    skillSlugs: raw.skillSlugs,
    minAnnual:
      typeof raw.minAnnual === 'number' ? raw.minAnnual : undefined,
    maxAnnual:
      typeof raw.maxAnnual === 'number' ? raw.maxAnnual : undefined,
    countryCode: raw.countryCode,
    citySlug: raw.citySlug,
    remoteOnly:
      typeof raw.remoteOnly === 'boolean' ? raw.remoteOnly : undefined,
    companySlug: raw.companySlug,
    isHundredKLocal:
      typeof raw.isHundredKLocal === 'boolean'
        ? raw.isHundredKLocal
        : undefined,
    // CRITICAL: no default. Only use if present in JSON.
    maxJobAgeDays:
      typeof raw.maxJobAgeDays === 'number'
        ? raw.maxJobAgeDays
        : undefined,
  }

  return {
    ...row,
    filters,
  }
}
