import { parseJobsListing } from '../../lib/jobs/jobsListQuery'

const parse = (qs: string) => {
  const p = new URLSearchParams(qs)
  return parseJobsListing({ get: (k) => p.get(k) ?? undefined, getAll: (k) => p.getAll(k) }, 2, 24)
}

describe('parseJobsListing (shared by /jobs and /api/jobs)', () => {
  it('keeps the remote region, which /api/jobs used to drop (page 2 of a region came back unfiltered)', () => {
    expect(parse('remoteRegion=europe').queryInput).toMatchObject({ remoteRegion: 'europe', page: 2, pageSize: 24 })
  })

  it("compares a salary step in the country's currency, scaled for krona", () => {
    expect(parse('country=CH&minSalary=150000').queryInput).toMatchObject({ countryCode: 'CH', currency: 'CHF', minAnnual: 150_000 })
    expect(parse('country=fr&minSalary=200000').queryInput).toMatchObject({ countryCode: 'FR', currency: 'EUR', minAnnual: 200_000 })
    expect(parse('country=SE&minSalary=150000').queryInput).toMatchObject({ currency: 'SEK', minAnnual: 1_500_000 })
    expect(parse('minSalary=250000').queryInput).toMatchObject({ currency: 'USD', minAnnual: 250_000 })
  })

  it('treats the $100k floor as no filter, so non-USD jobs are not dropped', () => {
    const q = parse('q=developer&minSalary=100000').queryInput
    expect(q.currency).toBeUndefined()
    expect(q.minAnnual).toBeUndefined()
  })

  it('reads the other filters and picks relevance for a keyword search', () => {
    const r = parse('q=react&role=software-engineer&seniority=senior&remoteMode=remote&visa=1&tech=go&sort=bogus')
    expect(r.sort).toBe('relevant')
    expect(r.queryInput).toMatchObject({ keyword: 'react', roleSlugs: ['software-engineer'], seniorityLevels: ['senior'], remoteMode: 'remote', visaSponsorship: true, tech: 'go', sortBy: 'relevant' })
    expect(parse('remoteMode=anywhere').queryInput.remoteMode).toBeUndefined()
  })
})
