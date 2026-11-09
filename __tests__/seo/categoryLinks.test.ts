import { LOCATIONS } from '@/lib/constants/homepage'
import { isCanonicalSlug } from '@/lib/roles/canonicalSlugs'
import { JOB_CATEGORY_MAP } from '@/lib/seo/jobCategories'
import { categoryLinkRole, categoryLocationHref, categorySalaryChips } from '@/lib/seo/categoryLinks'

describe('category page chips', () => {
  it('link a category to its first role that has pages', () => {
    expect(categoryLinkRole(JOB_CATEGORY_MAP.engineering.roleSlugs)).toBe('software-engineer')
    expect(categoryLinkRole(JOB_CATEGORY_MAP.sales.roleSlugs)).toBe('account-executive') // "sales" has no page of its own
    expect(categoryLinkRole(JOB_CATEGORY_MAP.mlai.roleSlugs)).toBe('machine-learning-engineer')
  })

  it('send each salary band to a different page, not four chips to one role page', () => {
    const hrefs = categorySalaryChips(JOB_CATEGORY_MAP.engineering.roleSlugs).map((c) => c.href)
    expect(hrefs).toEqual([
      '/jobs/software-engineer/100k-plus',
      '/jobs/software-engineer/200k-plus',
      '/jobs/software-engineer/300k-plus',
      '/jobs/software-engineer/400k-plus',
    ])
    expect(categorySalaryChips(JOB_CATEGORY_MAP.engineering.roleSlugs).map((c) => c.label)).toEqual(['100k+', '200k+', '300k+', '400k+'])
  })

  it('leave out a role band that has no jobs (its page would redirect), but not the site-wide bands', () => {
    const roles = JOB_CATEGORY_MAP.data.roleSlugs
    expect(categorySalaryChips(roles, new Set([100_000, 200_000, 300_000])).map((c) => c.href)).toEqual([
      '/jobs/data-scientist/100k-plus',
      '/jobs/data-scientist/200k-plus',
      '/jobs/data-scientist/300k-plus',
    ])
    expect(categorySalaryChips(roles, new Set())).toEqual([])
    expect(categorySalaryChips(JOB_CATEGORY_MAP.marketing.roleSlugs, new Set())).toHaveLength(4)
  })

  it('fall back to the site-wide pages for a category with no role page (Marketing)', () => {
    const roles = JOB_CATEGORY_MAP.marketing.roleSlugs
    expect(categoryLinkRole(roles)).toBeNull()
    expect(categorySalaryChips(roles).map((c) => c.href)).toEqual(['/jobs/100k-plus', '/jobs/200k-plus', '/jobs/300k-plus', '/jobs/400k-plus'])
    expect(categoryLocationHref(roles, 'remote')).toBe('/remote')
  })

  it('send countries to the country page and remote to the role remote page', () => {
    const roles = JOB_CATEGORY_MAP.data.roleSlugs
    expect(categoryLocationHref(roles, 'germany')).toBe('/jobs/location/germany')
    expect(categoryLocationHref(roles, 'remote')).toBe('/remote/data-scientist')
  })

  it('never produce the legacy salary-first URLs that 404 or redirect', () => {
    for (const [slug, cfg] of Object.entries(JOB_CATEGORY_MAP)) {
      const hrefs = [
        ...categorySalaryChips(cfg.roleSlugs).map((c) => c.href),
        ...LOCATIONS.map((l) => categoryLocationHref(cfg.roleSlugs, l.code)),
      ]
      for (const href of hrefs) {
        expect({ slug, href }).toEqual({ slug, href: expect.not.stringMatching(/-jobs$/) })
        expect({ slug, href }).toEqual({ slug, href: expect.not.stringMatching(/\/\d+k-plus-/) })
      }
    }
  })

  it('only name roles that exist', () => {
    for (const cfg of Object.values(JOB_CATEGORY_MAP)) {
      const role = categoryLinkRole(cfg.roleSlugs)
      if (role) expect(isCanonicalSlug(role)).toBe(true)
    }
  })
})
