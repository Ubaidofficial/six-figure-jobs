import fs from 'fs'
import path from 'path'

import { COUNTRY_NAMES, countryName, hasFlag, normalizeCountryCode } from '../country'

describe('normalizeCountryCode', () => {
  it('upper-cases and trims', () => {
    expect(normalizeCountryCode('au')).toBe('AU')
    expect(normalizeCountryCode(' de ')).toBe('DE')
  })
  it('uses ISO GB for UK', () => {
    expect(normalizeCountryCode('UK')).toBe('GB')
    expect(normalizeCountryCode('GB')).toBe('GB')
  })
  it('rejects anything that is not two letters', () => {
    for (const v of [null, undefined, '', 'None', 'USA', 'U1', 'HQ', 'SF', 'ZZ', 42, {}]) expect(normalizeCountryCode(v)).toBeNull()
  })
})

describe('countryName', () => {
  it('names the countries in the table', () => {
    expect(countryName('AU')).toBe('Australia')
    expect(countryName('gb')).toBe('United Kingdom')
    expect(countryName('UK')).toBe('United Kingdom')
  })
  it('has a short form for tight spaces', () => {
    expect(countryName('US', { short: true })).toBe('USA')
    expect(countryName('GB', { short: true })).toBe('UK')
    expect(countryName('DE', { short: true })).toBe('Germany')
  })
  it('falls back to Intl for a country outside the table', () => {
    expect(countryName('ZA')).toBe('South Africa')
  })
  it('is null for anything that is not an ISO country code', () => {
    expect(countryName('ZZ')).toBeNull()
    expect(countryName('HQ')).toBeNull()
    expect(countryName(null)).toBeNull()
    expect(countryName('Global')).toBeNull()
  })
})

describe('hasFlag', () => {
  it('is true for the table, false otherwise', () => {
    expect(hasFlag('us')).toBe(true)
    expect(hasFlag('UK')).toBe(true)
    expect(hasFlag('ZA')).toBe(false)
    expect(hasFlag(null)).toBe(false)
  })
  it('has an image in public/flags for every country in the table, and no stray images', () => {
    const dir = path.join(__dirname, '../../../public/flags')
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.replace('.svg', '').toUpperCase())
    expect(files.sort()).toEqual(Object.keys(COUNTRY_NAMES).sort())
  })
})
