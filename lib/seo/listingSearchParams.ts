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
