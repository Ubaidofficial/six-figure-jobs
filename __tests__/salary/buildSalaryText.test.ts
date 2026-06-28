import { buildSalaryText, resolveSalaryCurrency } from "../../lib/jobs/salary"

// Regression: the page and JobPosting JSON-LD must resolve currency identically
// so structured data sent to Google never disagrees with the visible salary.
describe('resolveSalaryCurrency', () => {
  it('trusts the country over a mislabelled parsed currency for non-remote jobs', () => {
    expect(resolveSalaryCurrency({ salaryCurrency: 'AUD', countryCode: 'US', remote: false })).toBe('USD')
    expect(resolveSalaryCurrency({ salaryCurrency: 'SEK', countryCode: 'DE', remote: false })).toBe('EUR')
  })

  it('keeps the parsed currency for remote jobs (no country to trust)', () => {
    expect(resolveSalaryCurrency({ salaryCurrency: 'AUD', countryCode: 'AU', remoteMode: 'remote' })).toBe('AUD')
    expect(resolveSalaryCurrency({ salaryCurrency: 'USD', countryCode: 'CA', remote: true })).toBe('USD')
  })

  it('falls back to the parsed currency when country is unknown', () => {
    expect(resolveSalaryCurrency({ salaryCurrency: 'GBP', countryCode: null, remote: false })).toBe('GBP')
  })
})

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
