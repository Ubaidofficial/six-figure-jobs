import { fallbackHue, getInitials } from '../../lib/companies/logoFallback'

describe('getInitials', () => {
  it('uses the first letters of the first two words', () => {
    expect(getInitials('Notion Labs')).toBe('NL')
    expect(getInitials('stripe')).toBe('S')
    expect(getInitials('Palo Alto Networks')).toBe('PA')
  })

  it('ignores punctuation and handles empty names', () => {
    expect(getInitials('  Ramp, Inc. ')).toBe('RI')
    expect(getInitials('')).toBe('C')
    expect(getInitials(null)).toBe('C')
    expect(getInitials('!!!')).toBe('C')
  })
})

describe('fallbackHue', () => {
  it('is stable for the same company regardless of case or spacing', () => {
    expect(fallbackHue('Ramp')).toBe(fallbackHue('  ramp '))
  })

  it('stays within 0-359 and differs between companies', () => {
    for (const n of ['Ramp', 'Linear', 'Cloudflare', 'Atlassian', '']) {
      const h = fallbackHue(n)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
    }
    expect(fallbackHue('Ramp')).not.toBe(fallbackHue('Linear'))
  })
})
