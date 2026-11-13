import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Same stubs as translateNotice.test.ts: jest does not process CSS modules, and the card imports pull in client parts.
jest.mock('../../app/job/[slug]/JobDetail.module.css', () => new Proxy({}, { get: (_t, key) => String(key) }))
jest.mock('../../app/job/[slug]/JobActions', () => ({ JobActions: () => null }))
jest.mock('../../app/job/[slug]/ApplyLink', () => ({ ApplyLink: () => null }))
jest.mock('../../app/job/[slug]/ReportJob', () => ({ ReportJob: () => null }))
jest.mock('../../app/job/[slug]/MobileBarShell', () => ({ MobileBarShell: () => null }))
jest.mock('@/components/companies/CompanyLogo', () => ({ CompanyLogo: () => null }))
jest.mock('@/components/ui/CountryFlag', () => ({ CountryFlag: () => null }))

import { CompanyRolesCard, RelatedSearchesCard } from '../../app/job/[slug]/JobDetailParts'

describe('CompanyRolesCard', () => {
  it('lists the roles with their pay and links to the company page with its job count', () => {
    const html = renderToStaticMarkup(
      createElement(CompanyRolesCard, {
        companyName: 'Salesforce',
        companySlug: 'salesforce',
        total: 1234,
        roles: [
          { href: '/job/a-j-1', title: 'Account Executive', pay: '$150k - $200k' },
          { href: '/job/b-j-2', title: 'Solutions Engineer', pay: null },
        ],
      }),
    )
    expect(html).toContain('More at Salesforce')
    expect(html).toContain('href="/job/a-j-1"')
    expect(html).toContain('$150k - $200k')
    expect(html).toContain('href="/company/salesforce"')
    expect(html).toContain('All 1,234 jobs at Salesforce')
    expect(html.match(/<li/g)).toHaveLength(2)
  })

  it('renders nothing when the company has no other open role', () => {
    expect(renderToStaticMarkup(createElement(CompanyRolesCard, { companyName: 'X', companySlug: 'x', total: 1, roles: [] }))).toBe('')
  })
})

describe('RelatedSearchesCard', () => {
  it('renders each link once with its label', () => {
    const html = renderToStaticMarkup(
      createElement(RelatedSearchesCard, {
        links: [
          { href: '/jobs/account-executive', label: 'All Account Executive jobs' },
          { href: '/salary/account-executive', label: 'Account Executive salary guide' },
        ],
      }),
    )
    expect(html).toContain('Related searches')
    expect(html).toContain('href="/salary/account-executive"')
    expect(html.match(/<li/g)).toHaveLength(2)
  })

  it('renders nothing without links', () => {
    expect(renderToStaticMarkup(createElement(RelatedSearchesCard, { links: [] }))).toBe('')
  })
})
