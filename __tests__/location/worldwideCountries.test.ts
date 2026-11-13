import { ISO_COUNTRY_CODES } from '@/lib/location/country'
import { UN_MEMBER_STATES, WORLDWIDE_COUNTRY_CODES, WORLDWIDE_EXCLUDED_COUNTRIES } from '@/lib/location/worldwideCountries'

describe('UN member states', () => {
  it('are the 193 members, each with a distinct, real ISO code and a name', () => {
    expect(UN_MEMBER_STATES).toHaveLength(193)
    const codes = UN_MEMBER_STATES.map(([code]) => code)
    expect(new Set(codes).size).toBe(193)
    expect(codes.filter((code) => !ISO_COUNTRY_CODES.has(code))).toEqual([])
    expect(UN_MEMBER_STATES.every(([, name]) => name.trim().length > 2)).toBe(true)
  })

  it('leave out places that are not UN members', () => {
    const codes = new Set(UN_MEMBER_STATES.map(([code]) => code))
    for (const notMember of ['HK', 'TW', 'PR', 'PS', 'VA', 'XK', 'GL', 'MO', 'AQ']) expect(codes.has(notMember)).toBe(false)
    for (const member of ['US', 'IN', 'BR', 'NG', 'DE', 'JP', 'ZA', 'TR', 'GB', 'CZ', 'KP', 'SY']) expect(codes.has(member)).toBe(true)
  })
})

describe('worldwide eligible countries', () => {
  it('are the UN members minus the excluded ones, which must all be members', () => {
    const members = new Set(UN_MEMBER_STATES.map(([code]) => code))
    for (const code of WORLDWIDE_EXCLUDED_COUNTRIES) expect(members.has(code)).toBe(true)
    expect(WORLDWIDE_COUNTRY_CODES).toHaveLength(193 - WORLDWIDE_EXCLUDED_COUNTRIES.size)
    for (const code of WORLDWIDE_EXCLUDED_COUNTRIES) expect(WORLDWIDE_COUNTRY_CODES).not.toContain(code)
  })

  it('start with the owner-approved exclusions only: Cuba, Iran, North Korea (Syria is still undecided)', () => {
    expect([...WORLDWIDE_EXCLUDED_COUNTRIES].sort()).toEqual(['CU', 'IR', 'KP'])
    expect(WORLDWIDE_COUNTRY_CODES).toContain('SY')
  })
})
