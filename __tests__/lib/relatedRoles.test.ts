import { rankRelatedRoles } from '@/lib/roles/relatedRoles'

describe('rankRelatedRoles', () => {
  const counts = [
    { roleSlug: 'software-engineer', total: 95, recent: 40 },
    { roleSlug: 'backend-engineer', total: 4, recent: 1 },
    { roleSlug: 'senior-backend-engineer', total: 3, recent: 3 },
    { roleSlug: 'frontend-engineer', total: 10, recent: 2 },
    { roleSlug: 'devops-engineer', total: 2, recent: 2 },
    { roleSlug: 'marketing-manager', total: 50, recent: 30 },
  ]

  it('returns roles from the same field, ranked by recent jobs, with counts matching the role page', () => {
    const result = rankRelatedRoles('software-engineer', counts)
    expect(result?.category).toBe('Software Engineering')
    // backend: 4 + 3 senior (contains match) = 7 total, 4 recent; frontend: 10 total, 2 recent
    expect(result?.roles.map((r) => [r.slug, r.total, r.recent])).toEqual([
      ['backend-engineer', 7, 4],
      ['frontend-engineer', 10, 2],
    ])
  })

  it('drops roles under 3 jobs, other fields, and the current role', () => {
    const slugs = rankRelatedRoles('software-engineer', counts)?.roles.map((r) => r.slug) ?? []
    expect(slugs).not.toContain('devops-engineer')
    expect(slugs).not.toContain('marketing-manager')
    expect(slugs).not.toContain('software-engineer')
  })

  it('maps seniority pages to their field and leaves out the base role', () => {
    const slugs = rankRelatedRoles('senior-backend-engineer', counts)?.roles.map((r) => r.slug) ?? []
    expect(slugs).toContain('software-engineer')
    expect(slugs).not.toContain('backend-engineer')
  })

  it('strips parentheticals from labels', () => {
    const result = rankRelatedRoles('software-engineer', [{ roleSlug: 'qa-engineer', total: 5, recent: 1 }])
    expect(result?.roles.map((r) => r.label)).toEqual(['QA Engineer'])
  })

  it('links non-canonical options to the canonical page that extends their slug, never a loose fuzzy match', () => {
    const result = rankRelatedRoles('marketing-manager', [
      { roleSlug: 'product-marketing-manager', total: 6, recent: 2 },
      { roleSlug: 'cto', total: 40, recent: 10 },
    ])
    expect(result?.roles.map((r) => [r.slug, r.label])).toEqual([['product-marketing-manager', 'Product Marketing']])

    // art-director fuzzy-matches `cto`; it must not produce a chip on design pages
    const design = rankRelatedRoles('product-designer', [{ roleSlug: 'cto', total: 40, recent: 10 }])
    expect(design).toBeNull()
  })

  it('finds the field of canonical pages that only extend or relabel an option', () => {
    expect(rankRelatedRoles('senior-marketing-manager', [{ roleSlug: 'growth-marketing-manager', total: 4, recent: 1 }])?.category).toBe('Marketing')
    const ml = rankRelatedRoles('data-scientist', [{ roleSlug: 'machine-learning-engineer', total: 9, recent: 3 }])
    expect(ml?.roles.map((r) => r.slug)).toEqual(['machine-learning-engineer'])
  })

  it('returns null for roles with no field', () => {
    expect(rankRelatedRoles('consultant', counts)).toBeNull()
    expect(rankRelatedRoles('not-a-role', counts)).toBeNull()
  })
})
