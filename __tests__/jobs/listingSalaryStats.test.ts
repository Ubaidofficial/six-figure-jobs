import { bandFloorFor, currencyForInput, describeVsMarket } from '../../lib/jobs/listingSalaryStats'

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
