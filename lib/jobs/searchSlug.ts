// lib/jobs/searchSlug.ts
// Helpers for building/parsing SEO-friendly salary-first job URLs.
//
// Canonical patterns (under /jobs):
//   /jobs/100k-plus-jobs
//   /jobs/100k-plus-software-engineer-jobs
//   /jobs/us/100k-plus-jobs
//   /jobs/us/100k-plus-software-engineer-jobs
//   /jobs/us/chicago/100k-plus-software-engineer-jobs
//   /jobs/remote/100k-plus-jobs
//   /jobs/remote/100k-plus-software-engineer-jobs

const SALARY_SLUG_TO_MIN: Record<string, number> = {
  '100k-plus': 100_000,
  '200k-plus': 200_000,
  '300k-plus': 300_000,
  '400k-plus': 400_000,
}

const MIN_TO_SALARY_SLUG: Record<number, string> = {
  100000: '100k-plus',
  200000: '200k-plus',
  300000: '300k-plus',
  400000: '400k-plus',
}

export type SalarySegment = keyof typeof SALARY_SLUG_TO_MIN

export type BuildJobsUrlParams = {
  salaryMin?: number
  roleSlug?: string | null
  countryCode?: string | null
  citySlug?: string | null
  remoteOnly?: boolean
}

/**
 * Build the canonical /jobs URL path (without origin).
 *
 * Examples:
 *  - { salaryMin: 100000 } →
 *      /jobs/100k-plus-jobs
 *  - { salaryMin: 100000, roleSlug: 'software-engineer' } →
 *      /jobs/100k-plus-software-engineer-jobs
 *  - { countryCode: 'us', salaryMin: 100000 } →
 *      /jobs/us/100k-plus-jobs
 *  - { countryCode: 'us', citySlug: 'chicago', salaryMin: 100000, roleSlug: 'software-engineer' } →
 *      /jobs/us/chicago/100k-plus-software-engineer-jobs
 *  - { remoteOnly: true, salaryMin: 100000, roleSlug: 'software-engineer' } →
 *      /jobs/remote/100k-plus-software-engineer-jobs
 */
export function buildJobsPath(params: BuildJobsUrlParams): string {
  const segments: string[] = []

  const { salaryMin, roleSlug, countryCode, citySlug, remoteOnly } = params

  // Location / remote prefix
  if (remoteOnly) {
    segments.push('remote')
  } else if (countryCode) {
    segments.push(countryCode.toLowerCase())
    if (citySlug) {
      segments.push(citySlug.toLowerCase())
    }
  }

  // Salary slug (default to 100k+ if not provided or unknown)
  const salarySlug =
    salaryMin && MIN_TO_SALARY_SLUG[salaryMin]
      ? MIN_TO_SALARY_SLUG[salaryMin]
      : '100k-plus'

  // Tail: salary-first, then optional role, ending with "-jobs"
  let tail = `${salarySlug}-jobs`

  if (roleSlug && roleSlug.trim()) {
    tail = `${salarySlug}-${roleSlug}-jobs`
  }

  segments.push(tail)

  return `/jobs/${segments.join('/')}`
}

export type ParsedJobsSlug = {
  salaryMin?: number
  roleSlug?: string
  countryCode?: string
  citySlug?: string
  remoteOnly?: boolean
}

/**
 * Parse the `[...slug]` segments from /jobs/[...slug] into structured filters.
 *
 * This DOES NOT validate against DB – it just interprets the URL shape.
 */
export function parseJobsSlug(
  slugSegments: string[] | string | undefined
): ParsedJobsSlug {
  if (!slugSegments) return {}
  const parts = Array.isArray(slugSegments) ? slugSegments : [slugSegments]

  if (parts.length === 0) return {}

  const result: ParsedJobsSlug = {}

  let idx = 0

  // Remote prefix: /jobs/remote/...
  if (parts[0] === 'remote') {
    result.remoteOnly = true
    idx = 1
  } else if (parts[0].length === 2) {
    // Country code: /jobs/us/... or /jobs/ca/...
    result.countryCode = parts[0].toUpperCase()
    idx = 1

    // Optional city: /jobs/us/chicago/...
    if (parts.length >= 3) {
      result.citySlug = parts[1]
      idx = 2
    }
  }

  const tail = parts[idx] || parts[parts.length - 1]
  if (!tail) return result

  // Tail looks like:
  //   100k-plus-jobs
  //   100k-plus-software-engineer-jobs
  //
  // Strip "-jobs" suffix.
  const jobsSuffix = '-jobs'
  let core = tail.endsWith(jobsSuffix)
    ? tail.slice(0, -jobsSuffix.length)
    : tail

  // Find salary slug at the start:
  //   100k-plus
  //   100k-plus-software-engineer
  const salarySlug = (Object.keys(SALARY_SLUG_TO_MIN) as SalarySegment[]).find(
    (s) => core === s || core.startsWith(`${s}-`)
  )

  if (salarySlug) {
    result.salaryMin = SALARY_SLUG_TO_MIN[salarySlug]

    // If there's anything after "salarySlug-", treat that as roleSlug
    if (core.length > salarySlug.length + 1) {
      result.roleSlug = core.slice(salarySlug.length + 1)
    }
  }

  return result
}
