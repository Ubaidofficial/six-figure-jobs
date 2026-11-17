import { anywhereSentence, worldwideGap } from '../../scripts/auditWorldwideRemote'

describe('worldwideGap', () => {
  it('says why a remote job is not in the worldwide list', () => {
    expect(worldwideGap({ locationRaw: 'Worldwide', countryCode: null })).toBe('listed')
    expect(worldwideGap({ locationRaw: 'Anywhere', countryCode: 'US' })).toBe('country-stored')
    expect(worldwideGap({ locationRaw: 'Worldwide (excluding the US)', countryCode: null })).toBe('limiting-word')
    expect(worldwideGap({ locationRaw: 'Remote', countryCode: null })).toBe('no-worldwide-words')
  })
})

describe('anywhereSentence', () => {
  it('quotes a sentence that says any country, and ignores a limited or company-only one', () => {
    expect(anywhereSentence('<p>You can work from anywhere in the world.</p>')).toContain('anywhere in the world')
    expect(anywhereSentence('<p>We are open to candidates worldwide.</p>')).toContain('worldwide')
    expect(anywhereSentence('<p>Work from anywhere in the US.</p>')).toBeNull()
    expect(anywhereSentence('<p>We are a global company with a strong culture.</p>')).toBeNull()
    expect(anywhereSentence(null)).toBeNull()
  })
})
