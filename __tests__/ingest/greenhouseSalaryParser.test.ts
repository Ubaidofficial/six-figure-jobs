import { parseGreenhouseSalary } from '../../lib/ingest/greenhouseSalaryParser'

describe('parseGreenhouseSalary (real-world Greenhouse formats)', () => {
  it('parses hourly pay range with decimals', () => {
    const html =
      '&lt;p&gt;&lt;strong&gt;COMPENSATION AND BENEFITS:&lt;/strong&gt;&lt;/p&gt;' +
      '&lt;p&gt;Pay range: $22.00 - $25.00/hour&lt;/p&gt;'

    const parsed = parseGreenhouseSalary({
      html,
      locationText: 'Starbase, TX',
      countryCode: null,
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.min).toBeCloseTo(22)
    expect(parsed?.max).toBeCloseTo(25)
    expect(parsed?.currency).toBe('USD')
    expect(parsed?.interval).toBe('hour')
  })

  it('parses annual range with k suffix', () => {
    const html = '&lt;p&gt;Base salary range: $124k - $187k annually&lt;/p&gt;'

    const parsed = parseGreenhouseSalary({
      html,
      locationText: 'New York, NY',
      countryCode: 'US',
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.min).toBe(124000)
    expect(parsed?.max).toBe(187000)
    expect(parsed?.currency).toBe('USD')
    expect(parsed?.interval).toBe('year')
  })

  it('infers CAD for $ salaries when location indicates Canada', () => {
    const html = '&lt;p&gt;Salary range: $150,000 - $200,000 per year&lt;/p&gt;'

    const parsed = parseGreenhouseSalary({
      html,
      locationText: 'Toronto, Canada',
      countryCode: null,
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.currency).toBe('CAD')
    expect(parsed?.interval).toBe('year')
  })

  it('falls back to legacy pay-range span markup', () => {
    const html =
      '&lt;div class=&quot;pay-range&quot;&gt;' +
      '&lt;span&gt;$230,000&lt;/span&gt;' +
      '&lt;span&gt;$300,000 USD&lt;/span&gt;' +
      '&lt;/div&gt;'

    const parsed = parseGreenhouseSalary({
      html,
      locationText: 'Remote',
      countryCode: null,
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.min).toBe(230000)
    expect(parsed?.max).toBe(300000)
    expect(parsed?.currency).toBe('USD')
    expect(parsed?.interval).toBe('year')
  })
})

