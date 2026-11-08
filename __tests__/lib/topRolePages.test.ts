import { rankTopRolePages } from '@/lib/roles/topRolePages'

describe('rankTopRolePages', () => {
  it('folds seniority variants into the base role page and sorts by jobs', () => {
    const roles = rankTopRolePages([
      { roleSlug: 'software-engineer', count: 10 },
      { roleSlug: 'senior-software-engineer', count: 8 },
      { roleSlug: 'product-manager', count: 12 },
    ])
    expect(roles.map((r) => [r.slug, r.count])).toEqual([
      ['software-engineer', 18],
      ['product-manager', 12],
    ])
    expect(roles[0].label).toBe('Software Engineer')
  })

  it('drops slugs with no role page, tiny roles, excluded roles and empty slugs', () => {
    const roles = rankTopRolePages(
      [
        { roleSlug: 'not-a-real-role-xyz', count: 50 },
        { roleSlug: 'data-scientist', count: 1 },
        { roleSlug: 'product-manager', count: 5 },
        { roleSlug: null, count: 99 },
      ],
      { exclude: ['product-manager'] },
    )
    expect(roles).toEqual([])
  })

  it('never links the catch-all "other" role', () => {
    const roles = rankTopRolePages([
      { roleSlug: 'other', count: 500 },
      { roleSlug: 'software-engineer', count: 10 },
    ])
    expect(roles.map((r) => r.slug)).toEqual(['software-engineer'])
  })

  it('caps the list', () => {
    const rows = ['software-engineer', 'product-manager', 'data-scientist', 'data-engineer'].map((roleSlug, i) => ({ roleSlug, count: 10 - i }))
    expect(rankTopRolePages(rows, { limit: 2 }).map((r) => r.slug)).toEqual(['software-engineer', 'product-manager'])
  })
})
