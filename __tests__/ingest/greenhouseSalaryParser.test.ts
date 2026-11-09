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

  it('parses salary from metadata when available', () => {
    const html = '&lt;p&gt;Role details&lt;/p&gt;'
    const parsed = parseGreenhouseSalary({
      html,
      locationText: 'Remote',
      countryCode: null,
      metadata: [
        {
          name: 'Compensation',
          value: '$150,000 - $180,000 USD',
        },
      ],
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.min).toBe(150000)
    expect(parsed?.max).toBe(180000)
    expect(parsed?.currency).toBe('USD')
    expect(parsed?.interval).toBe('year')
  })
})

describe('parseGreenhouseSalary: pay interval comes from the text next to the range, not the whole posting', () => {
  const payRange = (min: string, max: string, after = '') =>
    `&lt;div class="pay-range"&gt;&lt;span&gt;${min}&lt;/span&gt;&lt;span class="divider"&gt;&amp;mdash;&lt;/span&gt;&lt;span&gt;${max} USD&lt;/span&gt;&lt;/div&gt;${after}`

  it('a yearly pay-range stays yearly when the posting says "per day" elsewhere', () => {
    const html = `&lt;p&gt;Our systems handle billions of requests per day.&lt;/p&gt;${payRange('$198,500', '$248,000')}`
    const parsed = parseGreenhouseSalary({ html, locationText: 'Redwood City, CA', countryCode: 'US' })
    expect(parsed).toMatchObject({ min: 198500, max: 248000, currency: 'USD', interval: 'year' })
  })

  it('a yearly pay-range stays yearly when the posting mentions daily stand-ups', () => {
    const html = `&lt;p&gt;Join daily stand-ups and retrospectives.&lt;/p&gt;${payRange('$127,300', '$190,900', '&lt;p&gt;Benefits&lt;/p&gt;')}`
    const parsed = parseGreenhouseSalary({ html, locationText: 'Boston, MA', countryCode: 'US' })
    expect(parsed?.interval).toBe('year')
  })

  it('a sentence right above the range does not set the interval either', () => {
    const html = `&lt;p&gt;The team works three days per week in the office.&lt;/p&gt;${payRange('$150,000', '$180,000')}`
    const parsed = parseGreenhouseSalary({ html, locationText: 'Denver, CO', countryCode: 'US' })
    expect(parsed?.interval).toBe('year')
  })

  it('still reads an interval written right beside the range', () => {
    const html = payRange('$45', '$60', ' per hour')
    const parsed = parseGreenhouseSalary({ html, locationText: 'Austin, TX', countryCode: 'US' })
    expect(parsed).toMatchObject({ min: 45, max: 60, interval: 'hour' })
  })
})
