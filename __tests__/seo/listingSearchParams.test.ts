import {
  buildNormalizedListingPath,
  hasNonPaginationQueryParams,
  readListingPageParam,
} from '../../lib/seo/listingSearchParams'

describe('listing search param canonicalization', () => {
  it('drops page=1 and keeps a stable base canonical for clean listing hubs', () => {
    expect(buildNormalizedListingPath('/jobs', { page: '1' })).toBe('/jobs')
    expect(hasNonPaginationQueryParams({ page: '1' })).toBe(false)
    expect(readListingPageParam({ page: '1' })).toBe(1)
  })

  it('keeps paginated canonicals when page > 1 and no filters are active', () => {
    expect(buildNormalizedListingPath('/jobs/software-engineer', { page: '3' })).toBe(
      '/jobs/software-engineer?page=3',
    )
    expect(hasNonPaginationQueryParams({ page: '3' })).toBe(false)
    expect(readListingPageParam({ page: '3' })).toBe(3)
  })

  it('self-canonicalizes utility states with normalized query ordering', () => {
    expect(
      buildNormalizedListingPath('/jobs', {
        page: '2',
        remoteMode: 'remote',
        role: ['software-engineer', 'data-engineer'],
      }),
    ).toBe('/jobs?remoteMode=remote&role=software-engineer&role=data-engineer&page=2')
    expect(
      hasNonPaginationQueryParams({
        page: '2',
        remoteMode: 'remote',
      }),
    ).toBe(true)
  })
})
