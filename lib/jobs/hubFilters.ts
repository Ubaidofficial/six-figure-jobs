// The filters of the /jobs hub sidebar that are not plain query-input fields, read the same way by the page and by
// /api/jobs (the page's "load more" calls the API with the page's own query string, so any filter the page applies and
// the API ignores would silently disappear from page 2 on).

import type { JobQueryInput } from './queryJobs'
import { normalizeRemoteRegionSlug } from './remoteRegions'

export type HubFacetItem = { value: string; count: number }

/** Choices the sidebar offers beyond role / country / work type, each only when the data has them. */
export type HubExtraFacets = {
  /** Seniority levels that exist on current jobs, most senior last (see SENIORITY_LEVELS for the order). */
  seniorities?: HubFacetItem[]
  /** Company-size buckets that exist on companies with open jobs. No counts: they are per company, not per job. */
  companySizes?: string[]
  /** Remote regions with at least one remote job under the current filters. */
  remoteRegions?: HubFacetItem[]
  /** Most common cities under the current filters. `value` is the city slug, `label` its name. */
  cities?: Array<HubFacetItem & { label: string }>
}

/**
 * The seniority values stored in `Job.experienceLevel`. They come from keywords in the job title at ingest
 * (`inferExperienceLevelFromTitle`), so there is no "entry" or "mid": a title without a level word has none.
 */
export const SENIORITY_LEVELS = [
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'staff', label: 'Staff' },
  { value: 'principal', label: 'Principal' },
  { value: 'director', label: 'Director' },
  { value: 'vp', label: 'VP' },
  { value: 'c-level', label: 'C-level' },
] as const

/** The `Company.sizeBucket` values the company enricher writes (lib/ai/companyEnricher.ts ALLOWED_SIZES). */
export const COMPANY_SIZE_BUCKETS = [
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-1000', label: '201–1000' },
  { value: '1001-5000', label: '1,001–5,000' },
  { value: '5000+', label: '5,000+' },
] as const

/** Reads every value of a query key. */
export type ParamReader = (key: string) => string[]

/** A city slug from a URL (`new-york`), or undefined when it is not shaped like one. */
function readCitySlug(raw: string | undefined): string | undefined {
  const slug = (raw ?? '').trim().toLowerCase()
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 80 ? slug : undefined
}

/** The query-input fields behind `remoteRegion` and `city`. Unknown values are dropped. */
export function readHubExtraFilters(read: ParamReader): Pick<JobQueryInput, 'remoteRegion' | 'citySlug'> {
  return {
    remoteRegion: normalizeRemoteRegionSlug(read('remoteRegion')) ?? undefined,
    citySlug: readCitySlug(read('city')[0]),
  }
}
