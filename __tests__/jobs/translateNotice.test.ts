import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// CSS modules are not processed by jest; a proxy returns each class name as written.
jest.mock('../../app/job/[slug]/JobDetail.module.css', () => new Proxy({}, { get: (_t, key) => String(key) }))
// The notice does not use these; stubbing them keeps the import light (they pull in client components and images).
jest.mock('../../app/job/[slug]/JobActions', () => ({ JobActions: () => null }))
jest.mock('../../app/job/[slug]/ApplyLink', () => ({ ApplyLink: () => null }))
jest.mock('../../app/job/[slug]/ReportJob', () => ({ ReportJob: () => null }))
jest.mock('../../app/job/[slug]/MobileBarShell', () => ({ MobileBarShell: () => null }))
jest.mock('@/components/companies/CompanyLogo', () => ({ CompanyLogo: () => null }))
jest.mock('@/components/ui/CountryFlag', () => ({ CountryFlag: () => null }))

import { TranslateNotice } from '../../app/job/[slug]/JobDetailParts'

const URL = 'https://www.6figjobs.com/job/senior-software-engineer-j-abc123'

describe('TranslateNotice', () => {
  it('names the language and links to Google Translate for this page, in a new tab', () => {
    const html = renderToStaticMarkup(createElement(TranslateNotice, { language: 'es', pageUrl: URL }))
    expect(html).toContain('This job is posted in Spanish.')
    expect(html).toContain('Translate to English')
    expect(html).toContain(
      'href="https://translate.google.com/translate?sl=auto&amp;tl=en&amp;u=https%3A%2F%2Fwww.6figjobs.com%2Fjob%2Fsenior-software-engineer-j-abc123"',
    )
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer nofollow"')
  })

  it('says "another language" for a non-Latin script it cannot name', () => {
    const html = renderToStaticMarkup(createElement(TranslateNotice, { language: 'other', pageUrl: URL }))
    expect(html).toContain('This job is posted in another language.')
  })
})
