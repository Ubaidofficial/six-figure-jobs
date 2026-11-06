import { summarizeRoleGuide, type GuideRow } from '../../lib/salary/roleGuide'

const NOW = new Date('2026-11-06T10:00:00Z')
let n = 0
const row = (over: Partial<GuideRow> = {}): GuideRow => ({
  minAnnual: 140_000,
  maxAnnual: 180_000, // midpoint 160,000
  currency: 'USD',
  countryCode: 'US',
  experienceLevel: 'senior',
  companyName: `Company ${n++ % 40}`,
  companySlug: `company-${n % 40}`,
  updatedAt: NOW,
  ...over,
})
const rows = (count: number, over: Partial<GuideRow> | ((i: number) => Partial<GuideRow>) = {}) =>
  Array.from({ length: count }, (_, i) => row(typeof over === 'function' ? over(i) : over))

describe('summarizeRoleGuide', () => {
  it('counts each listing once at the midpoint of its range, not each end of it', () => {
    // 20 listings, all 140k-180k. Pooling both ends gave a median of 140k or 180k; the midpoint is 160k.
    const g = summarizeRoleGuide(rows(20))
    expect(g.usd?.median).toBe(160_000)
    expect(g.usd?.p25).toBe(160_000)
    expect(g.usd?.lowest).toBe(140_000)
    expect(g.usd?.highest).toBe(180_000)
    expect(g.usd?.count).toBe(20)
  })

  it('computes real percentiles over the midpoints', () => {
    const g = summarizeRoleGuide(rows(21, (i) => ({ minAnnual: 100_000 + i * 10_000, maxAnnual: 100_000 + i * 10_000 })))
    expect(g.usd?.median).toBe(200_000)
    expect(g.usd?.p25).toBe(150_000)
    expect(g.usd?.p75).toBe(250_000)
  })

  it('keeps other currencies out of the USD headline figures', () => {
    const g = summarizeRoleGuide([...rows(20), ...rows(10, { currency: 'GBP', minAnnual: 90_000, maxAnnual: 110_000, countryCode: 'GB' })])
    expect(g.listings).toBe(30)
    expect(g.usdCount).toBe(20)
    expect(g.usd?.median).toBe(160_000) // not dragged down by the 100k pounds
  })

  it('returns no headline figures below 20 USD listings', () => {
    const g = summarizeRoleGuide(rows(19))
    expect(g.usd).toBeNull()
    expect(g.listings).toBe(19)
    expect(g.usdCount).toBe(19)
  })

  it('shows each country in its own currency and leaves out countries with fewer than 5 listings', () => {
    const g = summarizeRoleGuide([
      ...rows(20),
      ...rows(6, { currency: 'GBP', minAnnual: 90_000, maxAnnual: 110_000, countryCode: 'GB' }),
      ...rows(4, { currency: 'CAD', minAnnual: 130_000, maxAnnual: 150_000, countryCode: 'CA' }),
    ])
    expect(g.countries.map((c) => [c.countryCode, c.currency, c.count])).toEqual([
      ['US', 'USD', 20],
      ['GB', 'GBP', 6],
    ])
    expect(g.countries.find((c) => c.countryCode === 'GB')?.median).toBe(100_000)
  })

  it('needs 5 listings per level and two levels', () => {
    const g = summarizeRoleGuide(
      rows(25, (i) => (i < 12 ? { experienceLevel: 'senior' } : i < 18 ? { experienceLevel: 'mid', minAnnual: 110_000, maxAnnual: 130_000 } : i < 22 ? { experienceLevel: 'lead' } : { experienceLevel: 'entry' })),
    )
    expect(g.levels?.map((l) => l.level)).toEqual(['mid', 'senior']) // lead (4) and entry (3) are too thin
    expect(g.levels?.find((l) => l.level === 'mid')?.median).toBe(120_000)
  })

  it('lists companies with at least 2 listings, most listings first, and never an ATS id as a name', () => {
    const g = summarizeRoleGuide([
      ...rows(3, { companyName: 'Stripe', companySlug: 'stripe', minAnnual: 200_000, maxAnnual: 240_000 }),
      ...rows(2, { companyName: 'Ramp', companySlug: 'ramp' }),
      ...rows(1, { companyName: 'OneOff', companySlug: 'oneoff' }),
      ...rows(5, { companyName: '9c26369c-d400-4eb7-a9b3-ab8f6469f9e8', companySlug: '9c26369c-d400-4eb7-a9b3-ab8f6469f9e8' }),
      ...rows(4, { companyName: null, companySlug: null }),
    ])
    expect(g.companies.map((c) => [c.name, c.count])).toEqual([
      ['Stripe', 3],
      ['Ramp', 2],
    ])
    expect(g.companies[0].median).toBe(220_000)
  })

  it('takes the date from the most recently refreshed listing', () => {
    const g = summarizeRoleGuide([row({ updatedAt: new Date('2026-11-01T00:00:00Z') }), row({ updatedAt: new Date('2026-11-05T12:00:00Z') })])
    expect(g.asOf?.toISOString()).toBe('2026-11-05T12:00:00.000Z')
    expect(summarizeRoleGuide([]).asOf).toBeNull()
  })

  it('handles listings with a single figure and ignores ones with none', () => {
    const g = summarizeRoleGuide([...rows(20), row({ minAnnual: null, maxAnnual: 300_000 }), row({ minAnnual: null, maxAnnual: null })])
    expect(g.listings).toBe(22)
    expect(g.usdCount).toBe(21)
    expect(g.usd?.highest).toBe(300_000)
  })
})
