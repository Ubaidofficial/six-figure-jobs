import { summarizeRoleMedians } from '../../lib/salary/indexMedians'
import { pluralize } from '../../lib/utils/number'

const rows = (slug: string, n: number, min = 120_000, max = 160_000) =>
  Array.from({ length: n }, () => ({ roleSlug: slug, minAnnual: min, maxAnnual: max }))

describe('summarizeRoleMedians', () => {
  it('uses the midpoint of each range, not every endpoint pooled', () => {
    // 20 listings, ranges 100-200k: midpoint 150k. The old pooled method would sort [100k x20, 200k x20] and
    // pick index 20, i.e. 200k.
    const out = summarizeRoleMedians(rows('software-engineer', 20, 100_000, 200_000), ['software-engineer'])
    expect(out.get('software-engineer')).toEqual({ listings: 20, median: 150_000, p25: 150_000, p75: 150_000 })
  })

  it('gives no median for a thin sample but still reports the count', () => {
    const out = summarizeRoleMedians(rows('product-manager', 3), ['product-manager', 'data-engineer'])
    expect(out.get('product-manager')).toEqual({ listings: 3, median: null, p25: null, p75: null })
    expect(out.get('data-engineer')).toEqual({ listings: 0, median: null, p25: null, p75: null })
  })

  it('reads bigint salaries, single-ended ranges, and ignores other roles and empty rows', () => {
    const data = [
      ...rows('data-scientist', 19),
      { roleSlug: 'data-scientist', minAnnual: BigInt(140_000), maxAnnual: null },
      { roleSlug: 'data-scientist', minAnnual: null, maxAnnual: null },
      { roleSlug: 'other-role', minAnnual: 1, maxAnnual: 1 },
      { roleSlug: null, minAnnual: 1, maxAnnual: 1 },
    ]
    const out = summarizeRoleMedians(data, ['data-scientist'])
    expect(out.get('data-scientist')).toEqual({ listings: 20, median: 140_000, p25: 140_000, p75: 140_000 })
  })
})

describe('summarizeRoleMedians middle half', () => {
  it('reports the 25th and 75th percentile of the midpoints', () => {
    // 20 listings with midpoints 100k, 110k, ... 290k.
    const data = Array.from({ length: 20 }, (_, i) => ({
      roleSlug: 'product-manager',
      minAnnual: 100_000 + i * 10_000,
      maxAnnual: 100_000 + i * 10_000,
    }))
    const stats = summarizeRoleMedians(data, ['product-manager']).get('product-manager')
    expect(stats?.median).toBe(195_000)
    expect(stats?.p25).toBeCloseTo(147_500)
    expect(stats?.p75).toBeCloseTo(242_500)
  })
})

describe('pluralize', () => {
  it('singular only for exactly one', () => {
    expect(pluralize(1, 'job')).toBe('job')
    expect(pluralize(0, 'job')).toBe('jobs')
    expect(pluralize(2, 'listing')).toBe('listings')
    expect(pluralize(2, 'company', 'companies')).toBe('companies')
  })
})
