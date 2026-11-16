import { coveredBy, skillTokens } from '../../scripts/auditSkillCoverage'

describe('skillTokens', () => {
  it('reads a stored JSON array, lowercased and trimmed', () => {
    expect(skillTokens('["Python"," React ","AWS"]')).toEqual(['python', 'react', 'aws'])
  })

  it('gives nothing for empty, null or broken values', () => {
    expect(skillTokens(null)).toEqual([])
    expect(skillTokens('')).toEqual([])
    expect(skillTokens('not json')).toEqual([])
    expect(skillTokens('{"a":1}')).toEqual([])
    expect(skillTokens('["ok", 3, null]')).toEqual(['ok'])
  })
})

describe('coveredBy', () => {
  it('knows the spellings the skill pages match on', () => {
    expect(coveredBy('python')).toEqual(['python'])
    expect(coveredBy('nodejs')).toEqual(['node-js'])
    expect(coveredBy('go')).toEqual(['golang'])
    expect(coveredBy('cpp')).toEqual(['c-plus-plus'])
  })

  it('says none for a skill with no page', () => {
    expect(coveredBy('shopify')).toEqual([])
    expect(coveredBy('wordpress')).toEqual([])
    expect(coveredBy('salesforce')).toEqual(['salesforce']) // added 2026-11-17
  })
})
