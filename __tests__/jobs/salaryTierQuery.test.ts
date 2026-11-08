import { SALARY_TIERS, tierQueryInput } from '../../lib/jobs/salaryTiers'

describe('tierQueryInput', () => {
  it('is the USD band each tier page lists (and the homepage card counts)', () => {
    expect(tierQueryInput('100k-plus')).toEqual({ currency: 'USD', minAnnual: 100_000, maxAnnual: 199_999 })
    expect(tierQueryInput('300k-plus')).toEqual({ currency: 'USD', minAnnual: 300_000, maxAnnual: 399_999 })
  })

  it('leaves the top tier open-ended', () => {
    expect(tierQueryInput('400k-plus')).toEqual({ currency: 'USD', minAnnual: 400_000 })
  })

  it('matches each tier label, so a card reads the same range its page shows', () => {
    for (const tier of Object.values(SALARY_TIERS)) {
      expect(tierQueryInput(tier.id).minAnnual).toBe(tier.minAnnualUsd)
    }
  })
})
