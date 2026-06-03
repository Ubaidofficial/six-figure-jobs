export type ListingSearchParams = Record<string, string | string[] | undefined>

function asTrimmedValues(value: string | string[] | undefined): string[] {
  if (value == null) return []
  const values = Array.isArray(value) ? value : [value]
  return values.map((entry) => entry.trim()).filter(Boolean)
}

export function readListingPageParam(
  searchParams: ListingSearchParams,
  key = 'page',
): number {
  const values = asTrimmedValues(searchParams[key])
  const page = Number(values[0] || '1')
  return Number.isFinite(page) && page > 1 ? Math.floor(page) : 1
}

export function hasNonPaginationQueryParams(searchParams: ListingSearchParams): boolean {
  for (const key of Object.keys(searchParams)) {
    if (key === 'page') continue
    if (asTrimmedValues(searchParams[key]).length > 0) {
      return true
    }
  }
  return false
}

/**
 * Returns true if a listing page should be noindexed.
 * Reasons: non-pagination query params (search/filter state) OR page 2+.
 * Page 1 with no filters is the only indexable listing page variant.
 */
export function shouldNoindexListingPage(searchParams: ListingSearchParams): boolean {
  if (hasNonPaginationQueryParams(searchParams)) return true
  const page = readListingPageParam(searchParams)
  return page > 1
}

export function buildNormalizedListingPath(
  basePath: string,
  searchParams: ListingSearchParams,
): string {
  const params = new URLSearchParams()

  for (const key of Object.keys(searchParams).sort()) {
    if (key === 'page') continue
    for (const value of asTrimmedValues(searchParams[key])) {
      params.append(key, value)
    }
  }

  const page = readListingPageParam(searchParams)
  if (page > 1) {
    params.set('page', String(page))
  }

  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function firstValue(searchParams: ListingSearchParams, key: string): string | null {
  const values = asTrimmedValues(searchParams[key])
  return values[0] ?? null
}

function normalizeSlug(value: string | null): string | null {
  if (!value) return null
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || null
}

export function buildCleanJobsCanonicalPath(searchParams: ListingSearchParams): string {
  const hasFilters = hasNonPaginationQueryParams(searchParams)
  if (!hasFilters) return '/jobs'

  const role = normalizeSlug(firstValue(searchParams, 'role') ?? firstValue(searchParams, 'roleSlug'))
  const country = normalizeSlug(firstValue(searchParams, 'country') ?? firstValue(searchParams, 'countryCode'))
  const remoteMode = normalizeSlug(firstValue(searchParams, 'remoteMode'))

  if (role && remoteMode === 'remote') return `/jobs/${role}/remote`
  if (role && country) return `/jobs/${role}/${country}`
  if (role) return `/jobs/${role}`
  if (country) return `/jobs/${country}`

  return '/jobs'
}
