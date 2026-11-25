import { countryFromText } from '@/lib/location/jobLocation'

describe('countryFromText', () => {
  it('reads New Mexico as the US state, not Mexico', () => {
    expect(countryFromText('Santa Fe, New Mexico')).toBe('US')
    expect(countryFromText('Albuquerque, New Mexico, United States')).toBe('US')
    expect(countryFromText('Mexico City, Mexico')).toBe('MX')
  })
  it('knows native names for the Netherlands and Austria', () => {
    expect(countryFromText('Delft, Zuid-Holland, Nederland')).toBe('NL')
    expect(countryFromText('Stockerau, Niederösterreich, Österreich')).toBe('AT')
  })
  it('still reads the plain cases and stays quiet when unsure', () => {
    expect(countryFromText('Dublin, Ireland')).toBe('IE')
    expect(countryFromText('London, UK')).toBe('GB')
    expect(countryFromText('Ghent')).toBeNull()
  })
})

// Found by the missing_country quality check (2026-11-25).
describe('countryFromText: remote jobs that name a place', () => {
  it('reads a state after "Remote" as its country', () => {
    expect(countryFromText('Remote - Texas')).toBe('US')
    expect(countryFromText('Remote, Florida')).toBe('US')
    expect(countryFromText('Ontario - Remote')).toBe('CA')
  })
  it('reads a country before a colon', () => {
    expect(countryFromText('Remote - US: Select locations')).toBe('US')
    expect(countryFromText('US: Washington Remote Worker')).toBe('US')
    expect(countryFromText('Remote - Canada: Select locations')).toBe('CA')
  })
  it('reads "ENG" as England', () => {
    expect(countryFromText('Nottingham,  ENG')).toBe('GB')
  })
  it('still says nothing for a bare state, an ambiguous name, or several countries', () => {
    expect(countryFromText('California')).toBeNull()
    expect(countryFromText('Remote - Georgia')).toBeNull()
    expect(countryFromText('Canada; United States')).toBeNull()
    expect(countryFromText('Remote')).toBeNull()
  })
})
