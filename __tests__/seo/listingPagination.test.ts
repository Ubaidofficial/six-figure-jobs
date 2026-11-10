import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Pagination is a plain component; the CSS module and the two job-list imports next to it are not part of what is tested.
jest.mock('@/components/listing/Listing.module.css', () => new Proxy({}, { get: (_t, key) => String(key) }))
jest.mock('@/components/jobs/JobRow', () => ({ JobRow: () => null, JobRowList: () => null }))
jest.mock('@/components/layout/Breadcrumb', () => ({ Breadcrumb: () => null }))
jest.mock('@/components/alerts/JobAlertBox', () => ({ JobAlertBox: () => null }))

import { Pagination } from '@/components/listing/ListingParts'
import { clicksFromFirstPage, pageLinkNumbers } from '@/lib/listing/pageNumbers'
import {
  MAX_INDEXABLE_LISTING_PAGE,
  buildCleanJobsCanonicalPath,
  shouldNoindexListingPage,
} from '@/lib/seo/listingSearchParams'

describe('which pages /jobs lets Google index', () => {
  it('plain pagination is indexable and each page is its own canonical', () => {
    expect(shouldNoindexListingPage({})).toBe(false)
    expect(shouldNoindexListingPage({ page: '2' })).toBe(false)
    expect(shouldNoindexListingPage({ page: '184' })).toBe(false)
    expect(buildCleanJobsCanonicalPath({})).toBe('/jobs')
    expect(buildCleanJobsCanonicalPath({ page: '1' })).toBe('/jobs')
    expect(buildCleanJobsCanonicalPath({ page: '2' })).toBe('/jobs?page=2')
    expect(buildCleanJobsCanonicalPath({ page: '37' })).toBe('/jobs?page=37')
  })

  it('a filtered or searched list stays noindex, with its old canonical (no new indexable duplicates)', () => {
    for (const sp of [{ q: 'seo' }, { country: 'us' }, { role: 'data-scientist', page: '2' }, { remoteMode: 'remote' }, { minSalary: '200000' }]) {
      expect(shouldNoindexListingPage(sp)).toBe(true)
    }
    expect(buildCleanJobsCanonicalPath({ role: 'data-scientist', page: '2' })).toBe('/jobs/data-scientist')
    expect(buildCleanJobsCanonicalPath({ q: 'seo' })).toBe('/jobs')
  })

  it('pages beyond the cap are noindex again, and nonsense page numbers fall back to page 1', () => {
    expect(shouldNoindexListingPage({ page: String(MAX_INDEXABLE_LISTING_PAGE) })).toBe(false)
    expect(shouldNoindexListingPage({ page: String(MAX_INDEXABLE_LISTING_PAGE + 1) })).toBe(true)
    expect(buildCleanJobsCanonicalPath({ page: 'abc' })).toBe('/jobs')
    expect(buildCleanJobsCanonicalPath({ page: '-5' })).toBe('/jobs')
    expect(buildCleanJobsCanonicalPath({ page: '2.9' })).toBe('/jobs?page=2')
  })
})

describe('pageLinkNumbers', () => {
  it('links the first and last page, a window, and jumps of 5, 25 and 100 either way', () => {
    expect(pageLinkNumbers(50, 184)).toEqual([1, 25, 45, 48, 49, 50, 51, 52, 55, 75, 150, 184])
    expect(pageLinkNumbers(1, 184)).toEqual([1, 2, 3, 6, 26, 101, 184])
  })
  it('stays inside the real pages and handles tiny and odd lists', () => {
    expect(pageLinkNumbers(1, 1)).toEqual([1])
    expect(pageLinkNumbers(3, 4)).toEqual([1, 2, 3, 4])
    expect(pageLinkNumbers(999, 10).every((n) => n >= 1 && n <= 10)).toBe(true)
    expect(pageLinkNumbers(0, 0)).toEqual([1])
  })
  it('puts every page within a handful of clicks of page 1 (184 pages today, up to the 250 cap)', () => {
    for (const total of [184, 250]) {
      let worst = 0
      for (let p = 1; p <= total; p++) worst = Math.max(worst, clicksFromFirstPage(p, total))
      expect(worst).toBeLessThanOrEqual(8)
    }
    expect(clicksFromFirstPage(1, 184)).toBe(0)
    expect(clicksFromFirstPage(999, 184)).toBe(Infinity)
  })
})

describe('Pagination markup', () => {
  const hrefFor = (n: number) => (n > 1 ? `/jobs?page=${n}` : '/jobs')
  const html = (props: { page: number; totalPages: number; numbered?: boolean }) =>
    renderToStaticMarkup(createElement(Pagination, { ...props, hrefFor }))

  it('without `numbered` it is unchanged: only Previous and Next', () => {
    const out = html({ page: 5, totalPages: 184 })
    expect(out).toContain('href="/jobs?page=4"')
    expect(out).toContain('href="/jobs?page=6"')
    expect(out).not.toContain('href="/jobs?page=184"')
  })

  it('with `numbered` it renders plain crawlable links to the first, last, jump and neighbouring pages', () => {
    const out = html({ page: 50, totalPages: 184, numbered: true })
    for (const n of [25, 45, 49, 51, 55, 75, 150, 184]) expect(out).toContain(`href="/jobs?page=${n}"`)
    expect(out).toContain('href="/jobs"') // page 1
    expect(out).toContain('aria-current="page"')
    expect(out).toContain('rel="prev"')
    expect(out).toContain('rel="next"')
  })

  it('renders nothing for a single page', () => {
    expect(html({ page: 1, totalPages: 1, numbered: true })).toBe('')
  })
})
