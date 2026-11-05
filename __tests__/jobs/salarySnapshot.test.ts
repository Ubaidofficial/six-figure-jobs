import { salaryMidpoint, summarizeSalaries } from '../../lib/jobs/salarySnapshot'

jest.mock('../../lib/prisma', () => ({ prisma: {} }))

describe('summarizeSalaries', () => {
  const spread = (n: number, from: number, to: number) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1))

  it('returns null when there are too few listings to call anything typical', () => {
    expect(summarizeSalaries(spread(19, 100_000, 200_000))).toBeNull()
    expect(summarizeSalaries([])).toBeNull()
  })

  it('computes median and the middle half', () => {
    const s = summarizeSalaries(spread(101, 100_000, 200_000))!
    expect(s.count).toBe(101)
    expect(s.median).toBe(150_000)
    expect(s.p25).toBe(125_000)
    expect(s.p75).toBe(175_000)
  })

  it('puts each listing in exactly one band, with 150k and 200k going up a band', () => {
    const values = [...Array(10).fill(100_000), ...Array(10).fill(150_000), ...Array(5).fill(199_999), ...Array(3).fill(200_000), 300_000, 450_000]
    const s = summarizeSalaries(values)!
    expect(s.bands).toEqual([
      { label: '$100k–$150k', count: 10 },
      { label: '$150k–$200k', count: 15 },
      { label: '$200k–$300k', count: 3 },
      { label: '$300k+', count: 2 },
    ])
    expect(s.bands.reduce((a, b) => a + b.count, 0)).toBe(values.length)
  })

  it('ignores junk values', () => {
    const s = summarizeSalaries([...Array(20).fill(120_000), NaN, -5, 0, Infinity])!
    expect(s.count).toBe(20)
  })
})

describe('salaryMidpoint', () => {
  it('uses the midpoint of a range or the single figure that exists', () => {
    expect(salaryMidpoint(BigInt(100_000), BigInt(140_000))).toBe(120_000)
    expect(salaryMidpoint(null, BigInt(130_000))).toBe(130_000)
    expect(salaryMidpoint(BigInt(110_000), null)).toBe(110_000)
    expect(salaryMidpoint(null, null)).toBeNull()
  })
})

describe('summarizeSalaries bands per market', () => {
  const spread = (n: number, from: number, to: number) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1))

  it('scales the band edges with the pay floor and uses the currency symbol', () => {
    const s = summarizeSalaries(spread(60, 75_000, 300_000), { floor: 75_000, currency: 'GBP' })!
    expect(s.bands.map((b) => b.label)).toEqual(['£75k–£115k', '£115k–£150k', '£150k–£225k', '£225k+'])
    expect(s.bands.reduce((a, b) => a + b.count, 0)).toBe(60)
  })

  it('keeps the USD labels unchanged when no options are given', () => {
    expect(summarizeSalaries(spread(40, 100_000, 400_000))!.bands.map((b) => b.label)).toEqual([
      '$100k–$150k',
      '$150k–$200k',
      '$200k–$300k',
      '$300k+',
    ])
  })
})
