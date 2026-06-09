// Shared indexability thresholds for pages that can become noindex when thin.
// Sitemaps must use the same thresholds so noindex pages are never submitted.

export const MIN_COMPANY_INDEXABLE_JOBS = 5
export const MIN_CITY_INDEXABLE_JOBS = 5
export const MIN_COUNTRY_INDEXABLE_JOBS = 5
export const MIN_REMOTE_ROLE_INDEXABLE_JOBS = 5
export const MIN_ROLE_FILTER_INDEXABLE_JOBS = 5
export const MIN_SALARY_TIER_INDEXABLE_JOBS = 5
// Salary × role × location pages (e.g. /salary/software-engineer/united-states)
// share the unified threshold — fewer than this and the page rolls into the
// broader /salary/[role] guide instead of standing alone in the index.
export const MIN_SALARY_ROLE_LOCATION_INDEXABLE_JOBS = 5

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

export function isRemoteRolePageIndexable(liveJobCount: number | null | undefined): boolean {
  return toSafeCount(liveJobCount) >= MIN_REMOTE_ROLE_INDEXABLE_JOBS
}

export function isRoleFilterPageIndexable(liveJobCount: number | null | undefined): boolean {
  return toSafeCount(liveJobCount) >= MIN_ROLE_FILTER_INDEXABLE_JOBS
}

export function isSalaryTierPageIndexable(liveJobCount: number | null | undefined): boolean {
  return toSafeCount(liveJobCount) >= MIN_SALARY_TIER_INDEXABLE_JOBS
}

export function isSalaryRoleLocationPageIndexable(
  liveJobCount: number | null | undefined,
): boolean {
  return toSafeCount(liveJobCount) >= MIN_SALARY_ROLE_LOCATION_INDEXABLE_JOBS
}
