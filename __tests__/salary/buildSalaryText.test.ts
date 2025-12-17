import { buildSalaryText } from '@/lib/jobs/salary'

describe('buildSalaryText – annual salary enforcement', () => {
  it('blocks low monthly or local salaries', () => {
    expect(
      buildSalaryText({
        salaryMin: 30000,
        currency: 'INR',
        countryCode: 'IN',
      }),
    ).toBeNull()

    expect(
      buildSalaryText({
        salaryMin: 90000,
        currency: 'SEK',
        countryCode: 'SE',
      }),
    ).toBeNull()
  })

  it('allows valid annual salaries', () => {
    expect(
      buildSalaryText({
        minAnnual: 120000,
        currency: 'USD',
        countryCode: 'US',
      }),
    ).toBe('$120K+')
  })

  it('formats salary ranges correctly', () => {
    expect(
      buildSalaryText({
        minAnnual: 120000,
        maxAnnual: 160000,
        currency: 'USD',
        countryCode: 'US',
      }),
    ).toBe('$120K - $160K')
  })

  it('uses High salary role fallback for capped values', () => {
    expect(
      buildSalaryText({
        minAnnual: 9000000,
        currency: 'USD',
      }),
    ).toBe('$High salary role')
  })
})
