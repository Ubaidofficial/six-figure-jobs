import { classifyFreehireJob } from '@/scripts/freehire-gap-audit'

const job = (over: Record<string, unknown> = {}, enrichment: Record<string, unknown> = {}) =>
  ({
    public_slug: 'a',
    url: 'https://x.test/a',
    title: 'Engineer',
    company: 'Acme',
    reality: { class: 'fresh' },
    enrichment: { salary_min: 150000, salary_max: 180000, salary_currency: 'USD', salary_period: 'year', ...enrichment },
    ...over,
  }) as any

describe('classifyFreehireJob', () => {
  it('names the first reason a freehire job is not published, in the order the sync checks', () => {
    expect(classifyFreehireJob(job()).reason).toBe('ok')
    expect(classifyFreehireJob(job({ closed_at: '2026-11-01' })).reason).toBe('closed')
    expect(classifyFreehireJob(job({ reality: { class: 'stale', fake_freshness: true } })).reason).toBe('stale-or-fake-freshness')
    expect(classifyFreehireJob(job({}, { salary_min: null })).reason).toBe('no-salary')
    expect(classifyFreehireJob(job({}, { salary_currency: 'SGD' })).reason).toBe('currency-not-queried')
    expect(classifyFreehireJob(job({}, { salary_min: 60000, salary_max: 80000 })).reason).toBe('below-gate')
  })
  it('finds pay stated per month or hour that would pass the gate once annualised', () => {
    expect(classifyFreehireJob(job({}, { salary_period: 'month', salary_min: 12000, salary_max: 14000 })).reason).toBe('period-not-year-would-pass')
    expect(classifyFreehireJob(job({}, { salary_period: 'hour', salary_min: 30, salary_max: 40 })).reason).toBe('period-not-year-below-gate')
  })
})
