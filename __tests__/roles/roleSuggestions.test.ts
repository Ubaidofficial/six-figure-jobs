import { aggregateRoleCounts, roleLabel, suggestRoles, type RoleCount } from '../../lib/roles/roleSuggestions'

describe('roleLabel', () => {
  it('title-cases a slug and keeps acronyms upper-case', () => {
    expect(roleLabel('seo-specialist')).toBe('SEO Specialist')
    expect(roleLabel('ux-researcher')).toBe('UX Researcher')
    expect(roleLabel('product-manager')).toBe('Product Manager')
  })
})

describe('aggregateRoleCounts', () => {
  it('counts seniority variants onto the base role, and drops "other", unknown slugs and zero counts', () => {
    const out = aggregateRoleCounts([
      { roleSlug: 'seo-specialist', count: 4 },
      { roleSlug: 'senior-seo-specialist', count: 3 },
      { roleSlug: 'other', count: 900 },
      { roleSlug: 'not-a-real-role-slug', count: 50 },
      { roleSlug: null, count: 7 },
      { roleSlug: 'product-manager', count: 0 },
    ])
    expect(out).toEqual([{ slug: 'seo-specialist', count: 7 }])
  })
})

describe('suggestRoles', () => {
  const roles: RoleCount[] = [
    { slug: 'seo-specialist', count: 6 },
    { slug: 'seo-manager', count: 11 },
    { slug: 'sales-development', count: 40 },
    { slug: 'product-manager', count: 80 },
    { slug: 'product-marketing-manager', count: 20 },
    { slug: 'software-engineer', count: 500 },
    { slug: 'data-scientist', count: 90 },
    { slug: 'marketing-manager', count: 0 },
  ]

  it('finds roles by what has been typed, most jobs first among equal matches', () => {
    expect(suggestRoles('seo', roles).map((r) => [r.label, r.count])).toEqual([
      ['SEO Manager', 11],
      ['SEO Specialist', 6],
    ])
  })

  it('matches on word starts, never inside a word ("pm" is not "development")', () => {
    expect(suggestRoles('pm', roles).map((r) => r.slug)).toEqual(['product-manager'])
    expect(suggestRoles('lop', roles)).toEqual([])
  })

  it('understands common short forms through exact synonyms', () => {
    expect(suggestRoles('swe', roles).map((r) => r.slug)).toEqual(['software-engineer'])
  })

  it('ranks a label that starts with the query above a later word', () => {
    expect(suggestRoles('manager', roles).map((r) => r.slug)).toEqual(['product-manager', 'product-marketing-manager', 'seo-manager'])
    expect(suggestRoles('product', roles)[0].slug).toBe('product-manager')
  })

  it('suggests nothing for under two characters, and never a role with no jobs', () => {
    expect(suggestRoles('s', roles)).toEqual([])
    expect(suggestRoles('', roles)).toEqual([])
    expect(suggestRoles('marketing manager', roles).map((r) => r.slug)).toEqual(['product-marketing-manager'])
  })

  it('limits the list and ignores punctuation and case', () => {
    expect(suggestRoles('  DATA-Sci ', roles).map((r) => r.slug)).toEqual(['data-scientist'])
    expect(suggestRoles('e', roles, 2)).toEqual([])
    expect(suggestRoles('ma', roles, 2)).toHaveLength(2)
  })
})
