import {
  COMPANY_JOBS_PAGE_SIZE,
  companyJobsPagePath,
  companyJobsShowingText,
  companyJobsTotalPages,
  companyJobsWindow,
  parseCompanyJobsPage,
} from '../../lib/companies/jobsPaging'

describe('parseCompanyJobsPage', () => {
  it('accepts plain page numbers', () => {
    expect(parseCompanyJobsPage('1')).toBe(1)
    expect(parseCompanyJobsPage('2')).toBe(2)
    expect(parseCompanyJobsPage('37')).toBe(37)
    expect(parseCompanyJobsPage('1000')).toBe(1000)
  })

  it.each(['0', '-1', '01', '1.5', '2abc', ' 2', '', 'NaN', '1001', '99999', '1e3', '0x10'])('rejects %p', (raw) => {
    expect(parseCompanyJobsPage(raw)).toBeNull()
  })

  it('rejects anything that is not a string', () => {
    expect(parseCompanyJobsPage(undefined)).toBeNull()
    expect(parseCompanyJobsPage(null)).toBeNull()
    expect(parseCompanyJobsPage(2)).toBeNull()
    expect(parseCompanyJobsPage(['2'])).toBeNull()
  })
})

describe('companyJobsTotalPages', () => {
  it('rounds up and is never below 1', () => {
    expect(COMPANY_JOBS_PAGE_SIZE).toBe(10)
    expect(companyJobsTotalPages(0)).toBe(1)
    expect(companyJobsTotalPages(1)).toBe(1)
    expect(companyJobsTotalPages(10)).toBe(1)
    expect(companyJobsTotalPages(11)).toBe(2)
    expect(companyJobsTotalPages(37)).toBe(4)
    expect(companyJobsTotalPages(102)).toBe(11)
    expect(companyJobsTotalPages(-5)).toBe(1)
  })
})

describe('companyJobsWindow', () => {
  it('first page of 37 is jobs 1-10 with more to come', () => {
    expect(companyJobsWindow(37, 1)).toEqual({ page: 1, totalPages: 4, start: 0, end: 10, hasMore: true })
  })

  it('the last page holds the remainder and has no more', () => {
    expect(companyJobsWindow(37, 4)).toEqual({ page: 4, totalPages: 4, start: 30, end: 37, hasMore: false })
  })

  it('exactly ten jobs is one page without a button', () => {
    expect(companyJobsWindow(10, 1)).toEqual({ page: 1, totalPages: 1, start: 0, end: 10, hasMore: false })
  })

  it('zero or one job', () => {
    expect(companyJobsWindow(0, 1)).toEqual({ page: 1, totalPages: 1, start: 0, end: 0, hasMore: false })
    expect(companyJobsWindow(1, 1)).toEqual({ page: 1, totalPages: 1, start: 0, end: 1, hasMore: false })
  })

  it('clamps a page past the end (the caller compares page to detect it) and a page below 1', () => {
    expect(companyJobsWindow(37, 9).page).toBe(4)
    expect(companyJobsWindow(37, 0).page).toBe(1)
    expect(companyJobsWindow(37, Number.NaN).page).toBe(1)
  })

  it('every job is on exactly one page', () => {
    for (const total of [0, 1, 9, 10, 11, 20, 21, 102]) {
      const seen: number[] = []
      for (let p = 1; p <= companyJobsTotalPages(total); p++) {
        const w = companyJobsWindow(total, p)
        for (let i = w.start; i < w.end; i++) seen.push(i)
      }
      expect(seen).toEqual(Array.from({ length: total }, (_, i) => i))
    }
  })
})

describe('companyJobsPagePath', () => {
  it('page 1 is the company page itself', () => {
    expect(companyJobsPagePath('vida-roads', 1)).toBe('/company/vida-roads')
    expect(companyJobsPagePath('vida-roads', 2)).toBe('/company/vida-roads/page/2')
    expect(companyJobsPagePath('vida-roads', 11)).toBe('/company/vida-roads/page/11')
  })
})

describe('companyJobsShowingText', () => {
  it('reads "Showing 10 of 37 jobs" from the start and a range further in', () => {
    expect(companyJobsShowingText(0, 10, 37)).toBe('Showing 10 of 37 jobs')
    expect(companyJobsShowingText(10, 20, 37)).toBe('Showing 11–20 of 37 jobs')
    expect(companyJobsShowingText(0, 37, 37)).toBe('Showing 37 of 37 jobs')
    expect(companyJobsShowingText(0, 1, 1)).toBe('Showing 1 of 1 job')
    expect(companyJobsShowingText(0, 10, 1200)).toBe('Showing 10 of 1,200 jobs')
  })
})
