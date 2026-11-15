import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/app/job/[slug]/JobDetail.module.css', () => mockClassNames())
jest.mock('../../app/job/[slug]/JobDetail.module.css', () => mockClassNames())
jest.mock('@/components/companies/CompanyLogo', () => ({ CompanyLogo: () => null }))
jest.mock('@/components/ui/CountryFlag', () => ({ CountryFlag: () => null }))
jest.mock('@/components/ui/Link', () => ({ __esModule: true, default: (props: any) => createElement('a', props) }))
jest.mock('../../app/job/[slug]/JobActions', () => ({ JobActions: () => null }))
jest.mock('../../app/job/[slug]/ApplyLink', () => ({ ApplyLink: () => null }))
jest.mock('../../app/job/[slug]/ReportJob', () => ({ ReportJob: () => null }))
jest.mock('../../app/job/[slug]/MobileBarShell', () => ({ MobileBarShell: () => null }))

import { JobPageNav } from '../../app/job/[slug]/JobPageNav'
import { JobSection, SkillChip } from '../../app/job/[slug]/JobDetailParts'
import { resolveSkillSlug } from '../../lib/jobs/skillSlug'

describe('JobPageNav', () => {
  it('renders in-page links for each section and marks the first as current', () => {
    const html = renderToStaticMarkup(
      createElement(JobPageNav, {
        items: [
          { id: 'job-requirements', label: 'Requirements' },
          { id: 'job-skills', label: 'Skills' },
          { id: 'job-description', label: 'Full description' },
        ],
      }),
    )
    expect(html).toContain('aria-label="On this page"')
    expect(html).toContain('href="#job-requirements"')
    expect(html).toContain('href="#job-description"')
    expect(html.match(/aria-current="location"/g)).toHaveLength(1)
    expect(html.indexOf('aria-current="location"')).toBeLessThan(html.indexOf('Skills'))
  })
})

describe('JobSection', () => {
  it('carries the id the nav points at', () => {
    const html = renderToStaticMarkup(createElement(JobSection, { id: 'job-skills', title: 'Skills', children: 'x' }))
    expect(html).toContain('id="job-skills"')
    expect(html).toContain('Skills')
  })
})

describe('skill links', () => {
  it('resolves names to our skill pages, and to nothing for an unknown skill', () => {
    expect(resolveSkillSlug('Go')).toBe('golang')
    expect(resolveSkillSlug('Node.js')).toBe('node-js')
    expect(resolveSkillSlug('Underwater Basket Weaving')).toBeNull()
  })

  it('links a skill that has a page and leaves an unknown one as a plain badge', () => {
    const linked = renderToStaticMarkup(createElement(SkillChip, { skill: 'Python', variant: 'required' }))
    expect(linked).toContain('href="/jobs/skills/python"')
    const plain = renderToStaticMarkup(createElement(SkillChip, { skill: 'Underwater Basket Weaving', variant: 'nice' }))
    expect(plain).not.toContain('href=')
  })
})
