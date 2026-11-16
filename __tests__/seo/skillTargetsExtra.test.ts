import { getPseoBatch } from '../../lib/seo/pseoBatches'
import { SKILL_TARGETS, skillStoredTokens } from '../../lib/seo/pseoTargets'

const added = SKILL_TARGETS.filter((s) => s.hubOnly)
const original = SKILL_TARGETS.filter((s) => !s.hubOnly)

describe('the skill pages added on 2026-11-17', () => {
  it('keep the original 32 skills first and in order, so the "related skills" and browse lists do not change', () => {
    expect(original.length).toBe(32)
    expect(SKILL_TARGETS.slice(0, 32)).toEqual(original)
    expect(SKILL_TARGETS[0].slug).toBe('python')
  })

  it('add 29 hub pages with unique slugs and plain labels', () => {
    expect(added.length).toBe(29)
    const slugs = SKILL_TARGETS.map((s) => s.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of added) {
      expect(s.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(s.label.trim().length).toBeGreaterThan(1)
    }
  })

  it('match jobs on the slug as stored in skillsJson', () => {
    for (const s of added) expect(skillStoredTokens(s.slug)).toEqual([s.slug])
  })

  it('are batch 2: live pages that stay noindex and out of the sitemaps until that batch is released', () => {
    for (const s of added) expect(getPseoBatch(`/jobs/skills/${s.slug}`)).toBe(2)
    expect(getPseoBatch('/jobs/skills/python')).toBe(1)
  })

  it('call a business skill a business skill, and the technologies technologies', () => {
    const business = added.filter((s) => s.business).map((s) => s.slug).sort()
    expect(business).toEqual(['business-development', 'crm', 'erp', 'gdpr', 'go-to-market', 'program-management', 'salesforce'])
    expect(added.find((s) => s.slug === 'kafka')?.business).toBeUndefined()
  })

  it('leave out the generic terms, and include the skill a competitor links', () => {
    const slugs = new Set(SKILL_TARGETS.map((s) => s.slug))
    for (const generic of ['api', 'automation', 'agile', 'github', 'saas', 'analytics']) expect(slugs.has(generic)).toBe(false)
    expect(slugs.has('salesforce')).toBe(true)
  })
})
