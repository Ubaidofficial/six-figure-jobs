import {
  COMPANY_CANDIDATES,
  MIN_DEMAND_CLICKS,
  TOP_COUNTRIES,
  buildMarketTrends,
  demandRoles,
  isAggregatorName,
  type TrendJobRow,
} from '../../lib/trends/marketTrends'

const NOW = new Date('2026-11-22T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

const job = (over: Partial<TrendJobRow> = {}): TrendJobRow => ({
  companyId: 'c1',
  roleSlug: 'software-engineer',
  remote: false,
  remoteMode: null,
  countryCode: 'US',
  currency: 'USD',
  minAnnual: 150_000,
  maxAnnual: 170_000,
  postedAt: daysAgo(1),
  createdAt: daysAgo(1),
  ...over,
})

describe('buildMarketTrends', () => {
  it('counts open and remote jobs overall (flag or mode)', () => {
    const t = buildMarketTrends([job({ remote: true }), job({ remoteMode: 'remote' }), job({ remoteMode: 'hybrid' }), job()], NOW)
    expect(t.overall.open).toBe(4)
    expect(t.overall.remote).toBe(2)
  })

  it('puts each job in one area by role, and the rest in "other"', () => {
    const t = buildMarketTrends(
      [job({ roleSlug: 'software-engineer' }), job({ roleSlug: 'devops-engineer' }), job({ roleSlug: 'product-manager' }), job({ roleSlug: 'account-executive' }), job({ roleSlug: 'nurse' }), job({ roleSlug: null })],
      NOW,
    )
    const open = Object.fromEntries(t.areas.map((a) => [a.slug, a.open]))
    expect(open).toMatchObject({ engineering: 2, product: 1, sales: 1, data: 0, design: 0, marketing: 0 })
    expect(t.other.open).toBe(2)
    // every job is counted exactly once across the areas and "other"
    expect(t.areas.reduce((s, a) => s + a.open, 0) + t.other.open).toBe(t.overall.open)
  })

  it('does not count an overlapping category twice (ML / data-scientist stays in data only)', () => {
    const t = buildMarketTrends([job({ roleSlug: 'data-scientist' })], NOW)
    expect(t.areas.find((a) => a.slug === 'data')?.open).toBe(1)
    expect(t.areas.reduce((s, a) => s + a.open, 0)).toBe(1)
  })

  it('splits the last 14 days into the last 7 and the 7 before, by the same rule as the company pages', () => {
    const t = buildMarketTrends(
      [job({ postedAt: daysAgo(0) }), job({ postedAt: daysAgo(6) }), job({ postedAt: daysAgo(8) }), job({ postedAt: daysAgo(13) }), job({ postedAt: daysAgo(20) })],
      NOW,
    )
    expect(t.overall.newThisWeek).toBe(2)
    expect(t.overall.newPreviousWeek).toBe(2)
  })

  it('does not call dateless jobs new for a company whose jobs were all stored this week', () => {
    const fresh = [1, 2, 3].map((d) => job({ companyId: 'workday-like', postedAt: null, createdAt: daysAgo(d) }))
    expect(buildMarketTrends(fresh, NOW).overall.newThisWeek).toBe(0)
  })

  it('takes the median of US-dollar midpoints only, with at least 3 jobs, and never mixes currencies', () => {
    const jobs = [
      job({ minAnnual: 100_000, maxAnnual: 120_000 }), // 110k
      job({ minAnnual: 140_000, maxAnnual: 160_000 }), // 150k
      job({ minAnnual: 190_000, maxAnnual: 210_000 }), // 200k
      job({ currency: 'EUR', minAnnual: 900_000, maxAnnual: 900_000 }), // not USD: left out of the median
    ]
    const t = buildMarketTrends(jobs, NOW)
    expect(t.overall.medianUsd).toBe(150_000)
    expect(t.overall.usdJobs).toBe(3)
    expect(t.overall.open).toBe(4)
  })

  it('has no median under 3 US-dollar jobs, and ignores pay beyond the sanity cap', () => {
    expect(buildMarketTrends([job(), job()], NOW).overall.medianUsd).toBeNull()
    const capped = [job(), job(), job({ minAnnual: 90_000_000, maxAnnual: 90_000_000 })]
    expect(buildMarketTrends(capped, NOW).overall.usdJobs).toBe(2)
  })

  it('ranks countries and companies by open jobs, ties by key, and keeps only the top few', () => {
    const rows: TrendJobRow[] = []
    for (let i = 0; i < TOP_COUNTRIES + 3; i++) for (let k = 0; k <= i; k++) rows.push(job({ countryCode: `C${String(i).padStart(2, '0')}`, companyId: `co${String(i).padStart(2, '0')}` }))
    const t = buildMarketTrends(rows, NOW)
    expect(t.countries).toHaveLength(TOP_COUNTRIES)
    expect(t.countries[0]).toMatchObject({ code: `C${String(TOP_COUNTRIES + 2).padStart(2, '0')}`, open: TOP_COUNTRIES + 3 })
    expect(t.countries.map((c) => c.open)).toEqual([...t.countries.map((c) => c.open)].sort((a, b) => b - a))
    // the loader takes job boards out of these candidates, then keeps the top few (TOP_COMPANIES)
    expect(t.companies.length).toBeLessThanOrEqual(COMPANY_CANDIDATES)
    expect(t.companies[0].open).toBeGreaterThanOrEqual(t.companies[t.companies.length - 1].open)
    expect(buildMarketTrends([job({ countryCode: 'B' }), job({ countryCode: 'A' })], NOW).countries.map((c) => c.code)).toEqual(['A', 'B'])
  })

  it('counts a company\'s new jobs and leaves out jobs without a country or company from those lists', () => {
    const t = buildMarketTrends([job({ countryCode: null, companyId: null }), job({ companyId: 'c9', postedAt: daysAgo(1) }), job({ companyId: 'c9', postedAt: daysAgo(10) })], NOW)
    expect(t.countries).toEqual([{ code: 'US', open: 2, remote: 0 }])
    expect(t.companies).toEqual([{ companyId: 'c9', open: 2, newThisWeek: 1 }])
  })

  it('handles no jobs', () => {
    const t = buildMarketTrends([], NOW)
    expect(t.overall).toMatchObject({ open: 0, remote: 0, newThisWeek: 0, medianUsd: null })
    expect(t.countries).toEqual([])
    expect(t.companies).toEqual([])
  })
})

describe('isAggregatorName', () => {
  it('matches the pay report\'s job boards by name, as its ILIKE patterns do (prefix, any case)', () => {
    for (const name of ['Jobgether', 'jobgether', '  Jobgether  ', 'Jobgether Inc', 'Jooble', 'Adzuna UK', 'Talent.com', 'ZipRecruiter', 'Remote Rocketship', 'RemoteRocketship']) {
      expect(isAggregatorName(name)).toBe(true)
    }
  })

  it('leaves employers alone, including names that only contain a board\'s name or differ at the dot', () => {
    for (const name of ['Anthropic', 'Capital One', 'Not Jobgether', 'Talentxcom', 'Zlensa Labs', '']) {
      expect(isAggregatorName(name)).toBe(false)
    }
  })
})

describe('demandRoles', () => {
  const row = (key: string, clicks: number) => ({ key, clicks })

  it('shows the roles at or above the floor, most clicks first', () => {
    const r = demandRoles([row('a', MIN_DEMAND_CLICKS), row('b', MIN_DEMAND_CLICKS + 5), row('c', MIN_DEMAND_CLICKS + 1), row('d', MIN_DEMAND_CLICKS - 1)])
    expect(r.map((x) => x.roleSlug)).toEqual(['b', 'c', 'a'])
  })

  it('shows nothing when fewer than 3 roles reach the floor, and never the unknown bucket', () => {
    expect(demandRoles([row('a', 50), row('b', 40)])).toEqual([])
    expect(demandRoles([row('a', 50), row('b', 40), row('(unknown)', 99)])).toEqual([])
  })

  it('keeps five at most', () => {
    expect(demandRoles(Array.from({ length: 9 }, (_, i) => row(`r${i}`, 100 - i)))).toHaveLength(5)
  })
})
