import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Only the markup JobRow produces is tested: the stylesheet, the logo and the flag are stubbed.
// A CSS module stub whose default export maps every class name to itself.
const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/jobs/JobRow.module.css', () => mockClassNames())
jest.mock('@/components/jobs/JobCard.module.css', () => mockClassNames())
jest.mock('@/components/companies/CompanyLogo', () => ({ CompanyLogo: () => null }))
jest.mock('@/components/ui/CountryFlag', () => ({ CountryFlag: () => null }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }))

import { JobRow, JobRowList } from '@/components/jobs/JobRow'

const job: any = {
  id: 'ats:greenhouse:123',
  title: 'Senior Backend Engineer',
  company: 'Acme',
  companyRef: { name: 'Acme', logoUrl: null, website: 'https://acme.example' },
  salaryMin: 150000n,
  salaryMax: 190000n,
  salaryCurrency: 'USD',
  minAnnual: 150000n,
  maxAnnual: 190000n,
  currency: 'USD',
  countryCode: 'US',
  city: 'Austin',
  remote: false,
  remoteMode: 'hybrid',
  experienceLevel: 'senior',
  postedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  skillsJson: JSON.stringify(['React', 'Some Obscure Tool']),
  aiSnippet: 'Build the APIs behind the payments product.',
}

const html = renderToStaticMarkup(createElement(JobRowList, null, createElement(JobRow, { job })))

describe('JobRow', () => {
  it('keeps the job title as a real link', () => {
    expect(html).toMatch(/<h3 class="title"><a class="titleLink" href="\/job\/[^"]+">Senior Backend Engineer<\/a><\/h3>/)
  })

  it('shows company, salary and location on the closed row', () => {
    expect(html).toContain('Acme')
    expect(html).toMatch(/class="salary">[^<]*150k[^<]*190k/i)
    expect(html).toContain('Austin')
  })

  it('starts closed, with a labelled toggle wired to the details panel', () => {
    const panelId = html.match(/aria-controls="([^"]+)"/)?.[1]
    expect(panelId).toBeTruthy()
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Show details for Senior Backend Engineer"')
    expect(html).toMatch(new RegExp(`<div id="${panelId}" class="panel" hidden="">`))
  })

  it('keeps the details in the page when closed: summary, pills, skills and the job link', () => {
    expect(html).toContain('Build the APIs behind the payments product.')
    expect(html).toContain('Hybrid')
    expect(html).toContain('Senior')
    expect(html).toContain('>React<')
    expect(html).toContain('Some Obscure Tool')
    expect(html).toMatch(/class="viewJob"/)
  })

  it('uses an h2 title when asked', () => {
    const h2 = renderToStaticMarkup(createElement(JobRow, { job, headingLevel: 2 }))
    expect(h2).toMatch(/<h2 class="title">/)
  })
})
