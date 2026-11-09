import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/home/NewRolesStrip.module.css', () => mockClassNames())
jest.mock('@/components/companies/CompanyLogo', () => ({ CompanyLogo: () => null }))

import { MIN_STRIP_COMPANIES, NewRolesStrip } from '@/components/home/NewRolesStrip'
import type { NewRolesCompany } from '@/lib/jobs/newRolesByCompany'

const company = (i: number, over: Partial<NewRolesCompany> = {}): NewRolesCompany => ({
  id: `c${i}`,
  name: `Company ${i}`,
  slug: `company-${i}`,
  logoUrl: null,
  website: null,
  newJobs: i + 1,
  ...over,
})
const render = (companies: NewRolesCompany[]) => renderToStaticMarkup(createElement(NewRolesStrip, { companies }))

describe('NewRolesStrip', () => {
  it('is left out when there are too few companies for a moving strip', () => {
    expect(render([])).toBe('')
    expect(render(Array.from({ length: MIN_STRIP_COMPANIES - 1 }, (_, i) => company(i)))).toBe('')
  })

  it('links every company to its page with the number of new roles', () => {
    const html = render(Array.from({ length: 5 }, (_, i) => company(i)))
    expect(html).toContain('href="/company/company-0"')
    expect(html).toMatch(/<span class="name">Company 4<\/span><span class="badge">\+5<\/span>/)
    expect(html).toContain('Added in the last 24 hours')
  })

  it('says "role" for one and "roles" for more in the link title', () => {
    const html = render([company(0, { newJobs: 1 }), company(1), company(2), company(3)])
    expect(html).toContain('Company 0: 1 new role in the last 24 hours')
    expect(html).toContain('Company 1: 2 new roles in the last 24 hours')
  })

  it('repeats the list once for the loop, and that copy is hidden from keyboards and screen readers', () => {
    const html = render(Array.from({ length: 4 }, (_, i) => company(i)))
    const lists = html.match(/<ul [^>]*>/g) ?? []
    expect(lists).toHaveLength(2)
    expect(lists[0]).not.toMatch(/aria-hidden|inert/)
    expect(lists[1]).toMatch(/aria-hidden="true"/)
    expect(lists[1]).toMatch(/inert/)
    // Every link in the copy is out of the tab order.
    const copy = html.slice(html.indexOf(lists[1]))
    expect((copy.match(/tabindex="-1"/g) ?? []).length).toBe(4)
  })

  it('sets the loop length from the number of companies', () => {
    expect(render(Array.from({ length: 10 }, (_, i) => company(i)))).toContain('--marquee-duration:35s')
  })
})
