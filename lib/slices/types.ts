// lib/slices/types.ts

import type { JobSlice as JobSliceRow } from '@prisma/client'

/**
 * Filters we support on Job queries.
 * These correspond to what you store in JobSlice.filtersJson.
 *
 * IMPORTANT:
 * - We intentionally DO NOT set defaults here (especially for maxJobAgeDays).
 * - If a field is absent in filtersJson, it stays undefined.
 */
export type SliceFilters = {
  // Core
  roleSlugs?: string[]
  skillSlugs?: string[]
  stateCode?: string
  minAnnual?: number
  maxAnnual?: number
  countryCode?: string
  citySlug?: string
  remoteOnly?: boolean
  remoteRegion?: string
  companySlug?: string
  isHundredKLocal?: boolean
  maxJobAgeDays?: number // only applied if explicitly present

  // Ranking / leakage controls
  sortBy?: 'salary' | 'date'
  excludeInternships?: boolean

  // Advanced
  seniorityLevels?: string[]
  employmentTypes?: string[]
  remoteMode?: 'remote' | 'hybrid' | 'onsite'
  companySizeBuckets?: string[]

  // SEO-ish fields (stored on Job)
  experienceLevel?: string
  industry?: string
  workArrangement?: string
}

/**
 * Enriched JobSlice returned by our loaders.
 */
export type JobSlice = JobSliceRow & {
  filters: SliceFilters
}

function asStringArray(v: any): string[] | undefined {
  if (!v) return undefined
  if (Array.isArray(v)) {
    const out = v.filter((x) => typeof x === 'string' && x.trim().length > 0)
    return out.length ? out : undefined
  }
  if (typeof v === 'string' && v.trim().length > 0) return [v.trim()]
  return undefined
}

function asNumber(v: any): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return undefined
}

function asBoolean(v: any): boolean | undefined {
  if (typeof v === 'boolean') return v
  return undefined
}

function asString(v: any): string | undefined {
  if (typeof v === 'string' && v.trim().length > 0) return v
  return undefined
}

/**
 * Parse filtersJson from the raw Prisma JobSlice row
 * and normalize into a strongly-typed filters object.
 *
 * CRITICAL:
 * - maxJobAgeDays has NO default here. If missing, it stays undefined.
 * - This ensures queryJobs() will NOT apply a cutoff unless explicitly set.
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
    roleSlugs: asStringArray(raw.roleSlugs ?? raw.roleSlug),

    // Skills (support legacy keys too, just in case)
    skillSlugs: asStringArray(raw.skillSlugs ?? raw.skillSlug),

    stateCode: asString(raw.stateCode),
    minAnnual: asNumber(raw.minAnnual),
    maxAnnual: asNumber(raw.maxAnnual),
    countryCode: asString(raw.countryCode),
    citySlug: asString(raw.citySlug),

    remoteOnly: asBoolean(raw.remoteOnly),
    remoteRegion: asString(raw.remoteRegion),
    companySlug: asString(raw.companySlug),
    isHundredKLocal: asBoolean(raw.isHundredKLocal),

    // CRITICAL: no default; only use if present in JSON
    maxJobAgeDays: asNumber(raw.maxJobAgeDays),

    // Advanced filters
    seniorityLevels: asStringArray(raw.seniorityLevels),
    employmentTypes: asStringArray(raw.employmentTypes),
    remoteMode: (raw.remoteMode === 'remote' ||
      raw.remoteMode === 'hybrid' ||
      raw.remoteMode === 'onsite')
      ? raw.remoteMode
      : undefined,
    companySizeBuckets: asStringArray(raw.companySizeBuckets),

    // SEO-ish filters
    experienceLevel: asString(raw.experienceLevel),
    industry: asString(raw.industry),
    workArrangement: asString(raw.workArrangement),

    // Ranking / leakage controls
    sortBy: raw.sortBy === 'date' || raw.sortBy === 'salary' ? raw.sortBy : undefined,
    excludeInternships: asBoolean(raw.excludeInternships),
  }

  return {
    ...row,
    filters,
  }
}
