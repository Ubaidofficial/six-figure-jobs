import { MIN_JOBS_FOR_MEDIAN, summarizeCompanyJobs, type CompanyJobRow } from '@/lib/jobs/companyHiringStats'

const now = new Date('2026-11-13T12:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)
const job = (over: Partial<CompanyJobRow> = {}): CompanyJobRow => ({
  companyId: 'c1',
  currency: 'USD',
  minAnnual: 150_000,
  maxAnnual: 190_000,
  postedAt: daysAgo(2),
  createdAt: daysAgo(2),
  ...over,
})

describe('summarizeCompanyJobs', () => {
  it('counts jobs posted in the last 7 days, by posting date and else by the day we first saw the job', () => {
    const stats = summarizeCompanyJobs(
      [
        job({ postedAt: daysAgo(1) }),
        job({ postedAt: daysAgo(6) }),
        job({ postedAt: daysAgo(9), createdAt: daysAgo(1) }), // old posting date wins: not new
        job({ postedAt: null, createdAt: daysAgo(3) }), // no posting date: first seen 3 days ago
        job({ postedAt: null, createdAt: daysAgo(20) }),
      ],
      now,
    )
    expect(stats.get('c1')?.newThisWeek).toBe(3)
  })

  it('gives the median of job midpoints in the main currency, rounded', () => {
    const rows = [
      job({ minAnnual: 100_000, maxAnnual: 120_000 }), // 110k
      job({ minAnnual: 150_000, maxAnnual: 170_000 }), // 160k
      job({ minAnnual: 200_000, maxAnnual: 240_000 }), // 220k
    ]
    expect(summarizeCompanyJobs(rows, now).get('c1')?.medianPay).toEqual({ amount: 160_000, currency: 'USD' })
    // an even count averages the two middle midpoints
    expect(
      summarizeCompanyJobs([...rows, job({ minAnnual: 300_000, maxAnnual: 300_000 })], now).get('c1')?.medianPay?.amount,
    ).toBe(190_000)
  })

  it('uses the one figure a job has, bigint or number', () => {
    const rows = [
      job({ minAnnual: BigInt(120_000), maxAnnual: null }),
      job({ minAnnual: null, maxAnnual: 140_000 }),
      job({ minAnnual: 160_000, maxAnnual: BigInt(160_000) }),
    ]
    expect(summarizeCompanyJobs(rows, now).get('c1')?.medianPay?.amount).toBe(140_000)
  })

  it('never mixes currencies: the currency with the most salaried jobs is used', () => {
    const rows = [
      job({ currency: 'EUR', minAnnual: 90_000, maxAnnual: 110_000 }),
      job({ currency: 'EUR', minAnnual: 100_000, maxAnnual: 120_000 }),
      job({ currency: 'EUR', minAnnual: 110_000, maxAnnual: 130_000 }),
      job({ currency: 'USD', minAnnual: 400_000, maxAnnual: 500_000 }),
    ]
    expect(summarizeCompanyJobs(rows, now).get('c1')?.medianPay).toEqual({ amount: 110_000, currency: 'EUR' })
  })

  it(`gives no median under ${MIN_JOBS_FOR_MEDIAN} salaried jobs, but still counts new jobs`, () => {
    const stats = summarizeCompanyJobs([job(), job()], now).get('c1')
    expect(stats?.medianPay).toBeNull()
    expect(stats?.newThisWeek).toBe(2)
  })

  it('skips rows with no currency or no figure, and amounts beyond the sanity cap', () => {
    const rows = [
      job({ currency: null }),
      job({ minAnnual: null, maxAnnual: null }),
      job({ minAnnual: 0, maxAnnual: 0 }),
      job({ minAnnual: 900_000_000, maxAnnual: 900_000_000 }), // cents read as dollars
      job(),
      job(),
      job(),
    ]
    expect(summarizeCompanyJobs(rows, now).get('c1')?.medianPay).toEqual({ amount: 170_000, currency: 'USD' })
  })

  it('keeps companies apart and ignores jobs without a company', () => {
    const stats = summarizeCompanyJobs([job(), job({ companyId: 'c2', postedAt: daysAgo(30), createdAt: daysAgo(30) }), job({ companyId: null })], now)
    expect([...stats.keys()].sort()).toEqual(['c1', 'c2'])
    expect(stats.get('c1')?.newThisWeek).toBe(1)
    expect(stats.get('c2')?.newThisWeek).toBe(0)
  })
})
