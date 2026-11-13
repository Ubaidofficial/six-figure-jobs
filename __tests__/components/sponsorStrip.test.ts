import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/sponsors/SponsorStrip.module.css', () => mockClassNames())
jest.mock('@/components/companies/CompanyLogo', () => ({ CompanyLogo: () => null }))

import { SponsorStrip } from '@/components/sponsors/SponsorStrip'

const slot = { id: 1, name: 'Acme Jobs', text: 'Hire faster.', href: 'https://acme.example/?utm_source=6figjobs', logo: null, until: '2026-12-31' }

describe('SponsorStrip', () => {
  it('renders nothing when there are no active slots', () => {
    expect(renderToStaticMarkup(createElement(SponsorStrip, { slots: [] }))).toBe('')
  })

  it('labels the card Sponsored and marks the link as a paid link that opens safely', () => {
    const html = renderToStaticMarkup(createElement(SponsorStrip, { slots: [slot] }))
    expect(html).toContain('>Sponsored<')
    expect(html).toContain('Acme Jobs')
    expect(html).toContain('Hire faster.')
    expect(html).toContain('href="https://acme.example/?utm_source=6figjobs"')
    expect(html).toContain('rel="sponsored noopener"')
    expect(html).toContain('target="_blank"')
    expect(html).not.toContain('application/ld+json')
  })

  it('leaves out the text line when there is none', () => {
    const html = renderToStaticMarkup(createElement(SponsorStrip, { slots: [{ ...slot, text: null }] }))
    expect(html).not.toContain('blurb')
  })
})
