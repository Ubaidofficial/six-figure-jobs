import { shouldPreferParsedGreenhouseSalary } from '../../lib/ingest/greenhouseSalaryReconciliation'

describe('shouldPreferParsedGreenhouseSalary', () => {
  it('prefers parsed annual salary when structured greenhouse values were stored as monthly', () => {
    const shouldPrefer = shouldPreferParsedGreenhouseSalary({
      structured: {
        min: 85000,
        max: 115000,
        currency: 'EUR',
        interval: 'month',
      },
      parsed: {
        min: 85000,
        max: 115000,
        currency: 'EUR',
        interval: 'year',
      },
    })

    expect(shouldPrefer).toBe(true)
  })

  it('does not override a healthy structured annual salary', () => {
    const shouldPrefer = shouldPreferParsedGreenhouseSalary({
      structured: {
        min: 190000,
        max: 240000,
        currency: 'USD',
        interval: 'year',
      },
      parsed: {
        min: 190000,
        max: 240000,
        currency: 'USD',
        interval: 'year',
      },
    })

    expect(shouldPrefer).toBe(false)
  })
})
