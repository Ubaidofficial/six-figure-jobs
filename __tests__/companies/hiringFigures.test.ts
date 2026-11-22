import { companyRemoteAndNewest, daysAgoLabel } from '../../lib/companies/hiringFigures'
import { summarizeCompanyJobs, type CompanyJobRow } from '../../lib/jobs/companyHiringStats'

const NOW = new Date('2026-11-22T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

describe('companyRemoteAndNewest', () => {
  it('counts remote jobs by flag or mode', () => {
    const f = companyRemoteAndNewest([{ remote: true }, { remoteMode: 'remote' }, { remoteMode: 'hybrid' }, { remote: false, remoteMode: null }], NOW)
    expect(f.remote).toBe(2)
  })

  it('reports the newest employer posting date in whole days', () => {
    expect(companyRemoteAndNewest([{ postedAt: daysAgo(5) }, { postedAt: daysAgo(3.4) }], NOW).newestDaysAgo).toBe(3)
  })

  it('has no newest date when no job has a posting date (the stored day says nothing about the employer)', () => {
    expect(companyRemoteAndNewest([{ postedAt: null }, {}], NOW).newestDaysAgo).toBeNull()
    expect(companyRemoteAndNewest([], NOW).newestDaysAgo).toBeNull()
  })

  it('treats a date slightly ahead of the clock as today', () => {
    expect(companyRemoteAndNewest([{ postedAt: new Date(NOW.getTime() + 3_600_000) }], NOW).newestDaysAgo).toBe(0)
  })
})

describe('daysAgoLabel', () => {
  it('reads as words', () => {
    expect(daysAgoLabel(0)).toBe('Today')
    expect(daysAgoLabel(1)).toBe('Yesterday')
    expect(daysAgoLabel(4)).toBe('4 days ago')
  })
})

describe('summarizeCompanyJobs: the 7 days before', () => {
  const row = (over: Partial<CompanyJobRow>): CompanyJobRow => ({
    companyId: 'c1',
    currency: 'USD',
    minAnnual: 100_000,
    maxAnnual: 120_000,
    postedAt: null,
    createdAt: daysAgo(1),
    ...over,
  })

  it('splits dated jobs into the last 7 days and the 7 before', () => {
    const rows = [row({ postedAt: daysAgo(0) }), row({ postedAt: daysAgo(6) }), row({ postedAt: daysAgo(8) }), row({ postedAt: daysAgo(13) }), row({ postedAt: daysAgo(20) })]
    const s = summarizeCompanyJobs(rows, NOW).get('c1')
    expect(s?.newThisWeek).toBe(2)
    expect(s?.newPreviousWeek).toBe(2)
  })

  it('counts a dateless job by the day we stored it only for a company tracked before that period', () => {
    // First stored 30 days ago: tracked before both periods, so a dateless job stored 10 days ago is in the week before.
    const tracked = [row({ createdAt: daysAgo(30), postedAt: daysAgo(30) }), row({ createdAt: daysAgo(10) }), row({ createdAt: daysAgo(2) })]
    const t = summarizeCompanyJobs(tracked, NOW).get('c1')
    expect(t?.newThisWeek).toBe(1)
    expect(t?.newPreviousWeek).toBe(1)

    // Every job stored in the last 3 days (a board just added): none of the dateless ones says anything about the employer.
    const fresh = [row({ createdAt: daysAgo(3) }), row({ createdAt: daysAgo(2) }), row({ createdAt: daysAgo(1) })]
    const f = summarizeCompanyJobs(fresh, NOW).get('c1')
    expect(f?.newThisWeek).toBe(0)
    expect(f?.newPreviousWeek).toBe(0)
  })

  it('never counts a job in both weeks', () => {
    const s = summarizeCompanyJobs([row({ postedAt: daysAgo(7.5) }), row({ postedAt: daysAgo(6.5) })], NOW).get('c1')
    expect((s?.newThisWeek ?? 0) + (s?.newPreviousWeek ?? 0)).toBe(2)
    expect(s?.newThisWeek).toBe(1)
    expect(s?.newPreviousWeek).toBe(1)
  })
})
