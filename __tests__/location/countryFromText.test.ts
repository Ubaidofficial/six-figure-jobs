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
