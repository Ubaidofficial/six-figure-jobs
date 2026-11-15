import { FOOTER_COLUMNS } from '@/components/layout/footerLinks'
import { ALWAYS_INDEXABLE_HUBS } from '@/lib/seo/indexingPhase'

const pathOf = (href: string) => href.split(/[?#]/)[0]

// Pages the footer does not need to list: the home page is the logo link, not a column link.
const NOT_IN_COLUMNS = new Set(['/'])

describe('footer coverage', () => {
  const linked = new Set(FOOTER_COLUMNS.flatMap((c) => c.links.map(([, href]) => pathOf(href))))

  it('links every always-indexable hub page, so a new hub is added to the footer (or excluded here on purpose)', () => {
    const missing = [...ALWAYS_INDEXABLE_HUBS].filter((hub) => !NOT_IN_COLUMNS.has(hub) && !linked.has(hub))
    expect(missing).toEqual([])
  })

  it('links the pay report and its method page', () => {
    expect(linked.has('/high-paying-jobs-report')).toBe(true)
    expect(linked.has('/high-paying-jobs-report/method')).toBe(true)
  })
})
