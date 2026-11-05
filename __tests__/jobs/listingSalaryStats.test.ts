import { currencyForInput } from '../../lib/jobs/listingSalaryStats'

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
