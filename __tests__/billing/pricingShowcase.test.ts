import { statSync } from 'node:fs'
import { join } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/account/PricingShowcase.module.css', () => mockClassNames())
jest.mock('@/components/home/SiteStatsStrip.module.css', () => mockClassNames())
jest.mock('@/components/ui/AnimatedNumber.module.css', () => mockClassNames())

import { CAPTION_DATE, PricingClosing, PricingFeatures, PricingHero, PricingShowcase, type PricingStats } from '../../components/account/PricingShowcase'
import { FREE_MAX_ALERTS_PER_EMAIL, PRO_MAX_ALERTS_PER_EMAIL } from '../../lib/alerts/config'
import { DIRECT_EMPLOYERS } from '../../lib/constants/directEmployers'

// The shape and size of what the homepage showed on 2026-11-16 (the owner's screenshot).
const stats: PricingStats = {
  jobs: 13280,
  companies: 3170,
  newThisWeek: 7434,
  countries: 24,
  catalog: { jobs: 4831788, companies: 9000, sources: 440, atsPlatforms: 179 },
  refreshedAt: new Date('2026-11-16T02:25:00Z'),
}
const render = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)

describe('PricingHero', () => {
  it('shows the same numbers the homepage strip shows, formatted the same way', () => {
    const html = render(createElement(PricingHero, { stats, instantAlerts: true }))
    for (const text of ['4,831,788', '13,280', '3,170', '7,434', 'about 1 in 364', 'Nov 16, 2026, 02:25 UTC']) expect(html).toContain(text)
    expect(html).toContain('440 sources')
    expect(html).toContain('179 hiring platforms')
    expect(html).toContain(`${DIRECT_EMPLOYERS.length} careers sites`)
  })

  it('says what is free and what Pro adds, and only mentions instant alerts when they are on', () => {
    const on = render(createElement(PricingHero, { stats, instantAlerts: true }))
    const off = render(createElement(PricingHero, { stats, instantAlerts: false }))
    expect(on).toContain('Browsing every job, its salary and its apply link is free.')
    expect(on).toContain('Pro adds instant alerts')
    expect(off).not.toContain('instant alerts')
    expect(off).toContain('Pro adds more saved searches')
  })

  it('leaves the strip out when the numbers could not be read, and keeps the headline', () => {
    const html = render(createElement(PricingHero, { stats: null, instantAlerts: false }))
    expect(html).not.toContain('6figjobs today')
    expect(html).toContain('Six-figure jobs, with the pay on every listing')
  })
})

describe('PricingShowcase', () => {
  const html = render(createElement(PricingShowcase))

  it('shows the three product screenshots, each with a description', () => {
    for (const file of ['home-hero.webp', 'latest-jobs.webp', 'pay-report.webp']) expect(html).toContain(encodeURIComponent(`/images/pricing/${file}`))
    expect((html.match(/<img /g) ?? []).length).toBe(3)
    expect((html.match(/alt="[^"]{40,}"/g) ?? []).length).toBe(3) // real descriptions, not empty or one word
    expect(html).toContain(CAPTION_DATE)
  })

  it('names the number of employers read directly, from the list in the code', () => {
    expect(html).toContain(`Roles from ${DIRECT_EMPLOYERS.length.toLocaleString('en-US')} employers`)
  })

  it('states what the figures are and are not', () => {
    expect(html).toContain('advertised ranges, not what people are paid')
    expect(html).toContain('/high-paying-jobs-report')
  })

  it('writes no price: those come from Stripe', () => {
    expect(html).not.toMatch(/\$\s?\d+\.\d{2}/)
    expect(render(createElement(PricingFeatures, { stats, instantAlerts: true }))).not.toMatch(/\$\s?\d+\.\d{2}/)
  })

  it('has images that exist and stay light', () => {
    for (const file of ['home-hero.webp', 'latest-jobs.webp', 'pay-report.webp']) {
      const { size } = statSync(join(__dirname, '../../public/images/pricing', file))
      expect(size).toBeGreaterThan(5_000)
      expect(size).toBeLessThan(150_000)
    }
  })
})

describe('PricingFeatures', () => {
  it('states the alert limits from the code, and instant alerts only when they are on', () => {
    const on = render(createElement(PricingFeatures, { stats, instantAlerts: true }))
    const off = render(createElement(PricingFeatures, { stats, instantAlerts: false }))
    for (const html of [on, off]) expect(html).toContain(`Free accounts can save ${FREE_MAX_ALERTS_PER_EMAIL}; Pro up to ${PRO_MAX_ALERTS_PER_EMAIL}`)
    expect(on).toContain('instant alerts')
    expect(off).not.toContain('instant alerts')
  })

  it('uses the live counts when it has them and plain wording when it has not', () => {
    const withStats = render(createElement(PricingFeatures, { stats, instantAlerts: false }))
    expect(withStats).toContain('3,170 companies are hiring now')
    expect(withStats).toContain('Jobs in 24 countries')
    const without = render(createElement(PricingFeatures, { stats: null, instantAlerts: false }))
    expect(without).not.toMatch(/\d,\d{3} companies/)
    expect(without).toContain('Jobs in many countries')
  })

  it('links to how it works', () => {
    expect(render(createElement(PricingFeatures, { stats, instantAlerts: false }))).toContain('href="/method"')
  })
})

describe('PricingClosing', () => {
  it('points to the free jobs and to how it works', () => {
    const html = render(createElement(PricingClosing))
    expect(html).toContain('href="/jobs"')
    expect(html).toContain('href="/method"')
    expect(html).toContain('without an account')
  })
})
