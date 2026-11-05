import {
  PSEO_COMBO_MIN_JOBS,
  PSEO_COMBO_SITEMAP_MIN_JOBS,
  getPseoHubMinJobs,
  getPseoRoleMinJobs,
  isPseoHubUnlocked,
  isPseoRoleUnlocked,
} from '../../lib/seo/pseoUnlock'
import { SKILL_TARGETS, skillStoredTokens } from '../../lib/seo/pseoTargets'

describe('pseoUnlock', () => {
  beforeEach(() => {
    delete process.env.PSEO_UNLOCK
    delete process.env.PSEO_HUB_MIN_JOBS
    delete process.env.PSEO_ROLE_MIN_JOBS
  })

  it('unlocks hubs at 25 and roles at 10 by default', () => {
    expect(getPseoHubMinJobs()).toBe(25)
    expect(getPseoRoleMinJobs()).toBe(10)
    expect(isPseoHubUnlocked(24, '/jobs/skills/python')).toBe(false)
    expect(isPseoHubUnlocked(25, '/jobs/skills/python')).toBe(true)
    expect(isPseoRoleUnlocked(9, '/jobs/senior-software-engineer')).toBe(false)
    expect(isPseoRoleUnlocked(10, '/jobs/senior-software-engineer')).toBe(true)
  })

  it('treats missing or invalid counts as zero', () => {
    expect(isPseoHubUnlocked(null, '/jobs/skills/python')).toBe(false)
    expect(isPseoHubUnlocked(undefined, '/jobs/skills/python')).toBe(false)
    expect(isPseoHubUnlocked(Number.NaN, '/jobs/skills/python')).toBe(false)
  })

  it('reads thresholds from env and ignores junk values', () => {
    process.env.PSEO_HUB_MIN_JOBS = '40'
    process.env.PSEO_ROLE_MIN_JOBS = 'abc'
    expect(isPseoHubUnlocked(39, '/jobs/skills/python')).toBe(false)
    expect(isPseoHubUnlocked(40, '/jobs/skills/python')).toBe(true)
    expect(getPseoRoleMinJobs()).toBe(10)
  })

  it('PSEO_UNLOCK=0 switches the unlock off', () => {
    process.env.PSEO_UNLOCK = '0'
    expect(isPseoHubUnlocked(1000, '/jobs/skills/python')).toBe(false)
    expect(isPseoRoleUnlocked(1000, '/jobs/senior-software-engineer')).toBe(false)
  })

  it('keeps the sitemap bar for combos above the page bar', () => {
    expect(PSEO_COMBO_SITEMAP_MIN_JOBS).toBeGreaterThan(PSEO_COMBO_MIN_JOBS)
  })
})

describe('skillStoredTokens', () => {
  it('maps slugs to the spellings freehire stores', () => {
    expect(skillStoredTokens('node-js')).toContain('nodejs')
    expect(skillStoredTokens('golang')).toContain('go')
    expect(skillStoredTokens('c-plus-plus')).toContain('cpp')
    expect(skillStoredTokens('python')).toEqual(['python'])
  })

  it('has a unique slug for every skill hub, including csharp and gcp', () => {
    const slugs = SKILL_TARGETS.map((s) => s.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs).toEqual(expect.arrayContaining(['csharp', 'gcp']))
  })
})
