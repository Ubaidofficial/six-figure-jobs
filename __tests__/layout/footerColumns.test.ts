import { FOOTER_COLUMNS, footerColumns } from '@/components/layout/footerLinks'

describe('footerColumns', () => {
  it('is the plain list while accounts are off (/pricing would redirect)', () => {
    expect(footerColumns(false)).toBe(FOOTER_COLUMNS)
    expect(FOOTER_COLUMNS.flatMap((c) => c.links).some(([, href]) => href === '/pricing')).toBe(false)
  })

  it('adds Pricing to the Company column only, just before Advertise, when accounts are on', () => {
    const cols = footerColumns(true)
    const company = cols.find((c) => c.title === 'Company')!
    const hrefs = company.links.map(([, href]) => href)
    expect(hrefs.indexOf('/pricing')).toBe(hrefs.indexOf('/post-a-job') - 1)
    expect(cols.filter((c) => c.title !== 'Company').flatMap((c) => c.links).some(([, h]) => h === '/pricing')).toBe(false)
    // the shared list is not changed
    expect(FOOTER_COLUMNS.flatMap((c) => c.links).some(([, h]) => h === '/pricing')).toBe(false)
  })
})
