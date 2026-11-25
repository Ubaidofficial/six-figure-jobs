// The homepage's moving logo strips repeat their list so the loop has no seam. The repeats must stay clickable: they were
// `inert` until 2026-11-25, and `inert` ignores clicks, so most logos on screen (the repeats) did nothing when clicked.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/home/FeaturedCompaniesCarousel.module.css', () => mockClassNames())
jest.mock('@/components/home/NewRolesStrip.module.css', () => mockClassNames())
jest.mock('@/components/companies/CompanyLogo', () => ({ CompanyLogo: () => null }))

import { FeaturedCompaniesCarousel, type FeaturedCompany } from '@/components/home/FeaturedCompaniesCarousel'
import { NewRolesStrip } from '@/components/home/NewRolesStrip'

const featured = (i: number): FeaturedCompany => ({
  id: `c${i}`, name: `Company ${i}`, slug: `company-${i}`, logoUrl: null, website: null, activeHighPayingJobs: 10 + i,
})

describe('homepage logo strips', () => {
  it('Top Companies: every logo, repeats included, links to its company page and none is inert', () => {
    const html = renderToStaticMarkup(createElement(FeaturedCompaniesCarousel, { companies: Array.from({ length: 12 }, (_, i) => featured(i)) }))
    expect(html).not.toContain('inert')
    expect(html.match(/href="\/company\/company-0"/g)!.length).toBeGreaterThan(1)
    // Repeats stay out of the tab order and away from screen readers, so each company is announced once.
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('tabindex="-1"')
  })
  it('Added in the last 24 hours: the second copy is clickable too', () => {
    const companies = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, name: `Company ${i}`, slug: `company-${i}`, logoUrl: null, website: null, newJobs: 2 }))
    const html = renderToStaticMarkup(createElement(NewRolesStrip, { companies }))
    expect(html).not.toContain('inert')
    expect(html.match(/href="\/company\/company-0"/g)).toHaveLength(2)
  })
})
