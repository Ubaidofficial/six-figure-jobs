import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

jest.mock('../../components/account/account.module.css', () => new Proxy({}, { get: (_t, key) => String(key) }))

import { PlanComparison } from '../../components/account/PlanComparison'
import { COMPETITOR_PRICES, COMPETITOR_PRICES_CHECKED_ON } from '../../lib/billing/competitorPrices'

const plans = [
  {
    key: 'subscription_weekly' as const,
    priceText: '$4.99',
    interval: 'week',
    credits: 25,
    discount: { percentOff: 50, discountedText: '$2.50', duration: 'on your first payment' },
    savingsPercent: null,
  },
  { key: 'subscription' as const, priceText: '$9.99', interval: 'month', credits: 100, discount: null, savingsPercent: 54 },
]
const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(PlanComparison, { plans, instantAlerts: true, ...over }))

describe('PlanComparison', () => {
  it('shows our price with the discount and every rival price with its date', () => {
    const html = render()
    expect(html).toContain('$4.99')
    expect(html).toContain('$2.50')
    expect(html).toContain('50% off on your first payment')
    for (const c of COMPETITOR_PRICES) expect(html).toContain(c.name)
    expect(html).toContain(COMPETITOR_PRICES_CHECKED_ON)
    expect(html).toContain('4dayweek.io Pro')
  })

  it('shows how much the monthly plan saves against paying weekly', () => {
    expect(render()).toContain('Save 54% compared with paying weekly')
  })

  it('leaves out the instant row when alerts are off', () => {
    expect(render({ instantAlerts: false })).not.toContain('Instant alerts')
    expect(render()).toContain('Instant alerts')
  })

  it('no longer carries the live numbers: they are the hero strip now, the same as the homepage', () => {
    expect(render()).not.toContain('What we collect for you')
  })

  it('does not invent a price for a plan Stripe could not return', () => {
    const html = render({ plans: [{ ...plans[1], priceText: null }] })
    expect(html).toContain('Not available')
  })
})
