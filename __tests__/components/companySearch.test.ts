import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/companies/CompanySearch.module.css', () => mockClassNames())
jest.mock('@/components/companies/CompanyLogo', () => ({ CompanyLogo: () => null }))

import { CompanySearch, hiringFacts } from '@/components/companies/CompanySearch'

const companies = [
  { id: 'c1', name: 'Acme', slug: 'acme', logoUrl: null, website: null, _count: { jobs: 12 } },
  { id: 'c2', name: 'Globex', slug: 'globex', logoUrl: null, website: null, _count: { jobs: 1 } },
]
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('hiringFacts', () => {
  it('lists new jobs and median pay, and nothing when there is nothing to say', () => {
    expect(hiringFacts({ newThisWeek: 3, medianPay: { amount: 185_000, currency: 'USD' } })).toEqual(['3 new this week', 'median $185k'])
    expect(hiringFacts({ newThisWeek: 0, medianPay: { amount: 90_000, currency: 'EUR' } })).toEqual(['median €90k'])
    expect(hiringFacts({ newThisWeek: 0, medianPay: null })).toEqual([])
    expect(hiringFacts(undefined)).toEqual([])
  })
})

describe('CompanySearch with stats', () => {
  it('shows the facts under the job count, only for companies that have them', () => {
    const t = text(
      renderToStaticMarkup(
        createElement(CompanySearch, {
          companies,
          stats: { c1: { newThisWeek: 4, medianPay: { amount: 210_000, currency: 'USD' } } },
        }),
      ),
    )
    expect(t).toContain('12 jobs')
    expect(t).toContain('4 new this week · median $210k')
    expect(t).toContain('1 job')
    expect(t.match(/new this week/g)).toHaveLength(1)
  })

  it('renders as before without stats', () => {
    const t = text(renderToStaticMarkup(createElement(CompanySearch, { companies })))
    expect(t).toContain('12 jobs')
    expect(t).not.toContain('new this week')
    expect(t).not.toContain('median')
  })
})
