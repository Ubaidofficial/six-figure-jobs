import { bandFloorFor, currencyForInput, describeVsMarket, summarizeByLevel } from '../../lib/jobs/listingSalaryStats'

jest.mock('../../lib/prisma', () => ({ prisma: {} }))
jest.mock('../../lib/jobs/queryJobs', () => ({ buildWhere: () => ({}) }))

describe('currencyForInput', () => {
  it('uses USD unless the page is for one country with a known pay floor', () => {
    expect(currencyForInput({})).toBe('USD')
    expect(currencyForInput({ remoteOnly: true })).toBe('USD')
    expect(currencyForInput({ countryCode: 'GB' })).toBe('GBP')
    expect(currencyForInput({ countryCode: 'CA' })).toBe('CAD')
    expect(currencyForInput({ countryCode: 'AU' })).toBe('AUD')
  })

  it('falls back to USD for a country without its own floor', () => {
    expect(currencyForInput({ countryCode: 'ZZ' })).toBe('USD')
  })
})

describe('bandFloorFor', () => {
  it('starts at the currency floor, or at the page minimum when that is higher', () => {
    expect(bandFloorFor({}, 'USD')).toBe(100_000)
    expect(bandFloorFor({ minAnnual: 200_000 }, 'USD')).toBe(200_000)
    expect(bandFloorFor({ minAnnual: 50_000 }, 'USD')).toBe(100_000)
  })
})

describe('describeVsMarket', () => {
  it('says how far a segment sits above or below the whole market', () => {
    expect(describeVsMarket(210_000, 175_000, 'USD')).toBe('20% above all listings ($175k median).')
    expect(describeVsMarket(140_000, 175_000, 'USD')).toBe('20% below all listings ($175k median).')
  })

  it('calls a difference under 3% in line, and returns null without usable figures', () => {
    expect(describeVsMarket(176_000, 175_000, 'USD')).toBe('In line with all listings ($175k median).')
    expect(describeVsMarket(0, 175_000, 'USD')).toBeNull()
    expect(describeVsMarket(150_000, NaN, 'USD')).toBeNull()
  })
})

describe('summarizeByLevel', () => {
  const rows = (level: string, values: number[]) => values.map((value) => ({ level, value }))

  it('gives one median per level, in career order, with listing counts', () => {
    const out = summarizeByLevel([
      ...rows('senior', [150_000, 160_000, 170_000, 180_000, 190_000, 200_000]),
      ...rows('entry', [100_000, 105_000, 110_000, 115_000, 120_000]),
      ...rows('lead', [200_000, 220_000, 240_000, 260_000, 280_000]),
    ])
    expect(out).toEqual([
      { level: 'entry', count: 5, median: 110_000 },
      { level: 'senior', count: 6, median: 175_000 },
      { level: 'lead', count: 5, median: 240_000 },
    ])
  })

  it('leaves out levels with under five listings, and returns null unless two levels remain', () => {
    expect(summarizeByLevel([...rows('senior', [150_000, 160_000, 170_000, 180_000, 190_000]), ...rows('lead', [200_000, 210_000, 220_000, 230_000])])).toBeNull()
    expect(summarizeByLevel([])).toBeNull()
  })

  it('ignores unknown levels and junk values', () => {
    const out = summarizeByLevel([
      ...rows('senior', [150_000, 160_000, 170_000, 180_000, 190_000, NaN, -1, 0]),
      ...rows('mid', [120_000, 125_000, 130_000, 135_000, 140_000]),
      ...rows('wizard', [1, 2, 3, 4, 5, 6]),
      { level: null, value: 100_000 },
    ])
    expect(out?.map((l) => l.level)).toEqual(['mid', 'senior'])
    expect(out?.[1].count).toBe(5)
  })
})
