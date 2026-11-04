import { getMinimumSalaryRejection } from '../../lib/jobs/salaryPublicationGate'

describe('getMinimumSalaryRejection', () => {
  it('rejects a missing salary', () => {
    expect(getMinimumSalaryRejection({ salaryMin: null, salaryCurrency: 'USD' })).toBe('missing-salary-min')
  })

  it('keeps the flat $100k minimum when there is no currency', () => {
    expect(getMinimumSalaryRejection({ salaryMin: 90_000 })).toBe('salary-min-below-100k')
    expect(getMinimumSalaryRejection({ salaryMin: 100_000 })).toBeNull()
  })

  it.each([
    ['USD', 99_999, 100_000],
    ['GBP', 74_999, 75_000],
    ['EUR', 79_999, 80_000],
    ['CAD', 119_999, 120_000],
    ['AUD', 139_999, 140_000],
  ])('applies the %s threshold from lib/currency/thresholds.ts', (currency, below, atThreshold) => {
    expect(getMinimumSalaryRejection({ salaryMin: below, salaryCurrency: currency })).toBe(
      `salary-min-below-threshold:${currency}`,
    )
    expect(getMinimumSalaryRejection({ salaryMin: atThreshold, salaryCurrency: currency })).toBeNull()
  })

  it('accepts a UK salary the old flat gate wrongly rejected', () => {
    expect(getMinimumSalaryRejection({ salaryMin: BigInt(80_000), salaryCurrency: 'gbp' })).toBeNull()
  })

  it('rejects a CAD/AUD salary the old flat gate wrongly accepted', () => {
    expect(getMinimumSalaryRejection({ salaryMin: BigInt(100_000), salaryCurrency: 'CAD' })).not.toBeNull()
    expect(getMinimumSalaryRejection({ salaryMin: BigInt(100_000), salaryCurrency: 'AUD' })).not.toBeNull()
  })

  it('falls back to the flat minimum for a currency with no configured threshold', () => {
    expect(getMinimumSalaryRejection({ salaryMin: 50_000, salaryCurrency: 'INR' })).toBe('salary-min-below-100k')
  })
})
