// Shared indexability thresholds for pages that can become noindex when thin.
// Sitemaps must use the same thresholds so noindex pages are never submitted.

export const MIN_COMPANY_INDEXABLE_JOBS = 3
export const MIN_CITY_INDEXABLE_JOBS = 3
export const MIN_COUNTRY_INDEXABLE_JOBS = 3

function toSafeCount(value: number | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function isCompanyPageIndexable(liveJobCount: number | null | undefined): boolean {
  return toSafeCount(liveJobCount) >= MIN_COMPANY_INDEXABLE_JOBS
}

export function isCityPageIndexable(liveJobCount: number | null | undefined): boolean {
  return toSafeCount(liveJobCount) >= MIN_CITY_INDEXABLE_JOBS
}

export function isCountryPageIndexable(liveJobCount: number | null | undefined): boolean {
  return toSafeCount(liveJobCount) >= MIN_COUNTRY_INDEXABLE_JOBS
}

