import { notFoundPastLastPage } from '../../lib/seo/listingSearchParams'

// Live 2026-11-08: /jobs/software-engineer?page=999 was an indexable page with no jobs (a soft 404).
describe('notFoundPastLastPage', () => {
  it('404s a page past the last one', () => {
    expect(() => notFoundPastLastPage(999, 25)).toThrow()
    expect(() => notFoundPastLastPage(2, 1)).toThrow()
  })

  it('lets the first page and every real page through, even with no jobs at all', () => {
    expect(() => notFoundPastLastPage(1, 0)).not.toThrow()
    expect(() => notFoundPastLastPage(1, 25)).not.toThrow()
    expect(() => notFoundPastLastPage(25, 25)).not.toThrow()
  })
})
