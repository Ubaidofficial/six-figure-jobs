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

describe('buildSalaryText – the range the site publishes is the range it shows', () => {
  // Live jobs on 2026-11-08 that showed no salary, or only the top, under older display minimums (EUR 90k, GBP 85k).
  const eur = (min: number, max: number) => buildSalaryText({ minAnnual: min, maxAnnual: max, currency: 'EUR', countryCode: 'DE' })
  it('shows euro ranges accepted by their top (EUR 80k threshold, EUR 60k floor)', () => {
    expect(eur(68000, 81000)).toBe('€68K - €81K')
    expect(eur(60000, 85000)).toBe('€60K - €85K')
    expect(eur(70000, 90000)).toBe('€70K - €90K')
  })

  it('shows UK ranges from the GBP 75k threshold', () => {
    expect(buildSalaryText({ minAnnual: 75000, maxAnnual: 90000, currency: 'GBP', countryCode: 'GB' })).toBe('£75K - £90K')
  })

  it('still hides a bound below the floor', () => {
    expect(eur(40000, 90000)).toBe('Up to €90K')
    expect(buildSalaryText({ minAnnual: 90000, currency: 'USD', countryCode: 'US' })).toBeNull()
  })
})
