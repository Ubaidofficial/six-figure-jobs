import { countryCodeFromContext, countryCodeFromSubdivision } from '../../lib/location/subdivisionCountry'

describe('countryCodeFromSubdivision', () => {
  it.each([
    ['Nürnberg, Bayern', 'DE'],
    ['München, Bayern', 'DE'],
    ['Heidelberg, Baden-Württemberg', 'DE'],
    ['Frankfurt am Main, Hessen', 'DE'],
    ['Ludwigshafen am Rhein, Rheinland-Pfalz', 'DE'],
    ['Düsseldorf, Nordrhein-Westfalen', 'DE'],
    ['Munich, Bavaria', 'DE'],
    ['Bayern', 'DE'],
    ['Wien', 'AT'],
    ['Graz, Steiermark', 'AT'],
    ['Linz, Oberösterreich', 'AT'],
    ['Zürich, Kanton Zürich', 'CH'],
    ['Kanton Bern', 'CH'],
    ['St. Gallen, Kanton St. Gallen', 'CH'],
    ['Lausanne, Canton de Vaud', 'CH'],
    ['Geneva, Canton of Geneva', 'CH'],
  ])('%s -> %s', (text, code) => {
    expect(countryCodeFromSubdivision(text)).toBe(code)
  })

  it('ignores accents, letter case and extra spaces', () => {
    expect(countryCodeFromSubdivision('  nürnberg ,   BAYERN  ')).toBe('DE')
    expect(countryCodeFromSubdivision('Kanton   Zürich')).toBe('CH')
  })

  it.each([
    'Berlin',
    'Berlin, NH',
    'Vienna',
    'Vienna, VA',
    'Hamburg',
    'Bremen',
    'Munich',
    'Brandenburg, KY',
    'Dällikon',
    'London, United Kingdom',
    'Remote',
    '',
  ])('leaves "%s" alone, because it names no German or Austrian state or Swiss canton', (text) => {
    expect(countryCodeFromSubdivision(text)).toBeNull()
  })

  it('reads only the last segment, so a state earlier in the text does not count', () => {
    expect(countryCodeFromSubdivision('Bayern, Austin, TX')).toBeNull()
  })

  it('returns null for missing text', () => {
    expect(countryCodeFromSubdivision(null)).toBeNull()
    expect(countryCodeFromSubdivision(undefined)).toBeNull()
  })

  it('does not treat a word that merely starts with "kanton" as a canton', () => {
    expect(countryCodeFromSubdivision('Kantonsstrasse')).toBeNull()
  })
})

describe('countryCodeFromContext', () => {
  it('prefers the state or canton', () => {
    expect(countryCodeFromContext('Nürnberg, Bayern', 'EUR')).toBe('DE')
    expect(countryCodeFromContext('Kanton Zürich', 'CHF')).toBe('CH')
  })

  it('gives a Swiss-franc job with a bare place name Switzerland', () => {
    expect(countryCodeFromContext('Dällikon', 'CHF')).toBe('CH')
    expect(countryCodeFromContext('Yverdon-les-Bains', 'chf')).toBe('CH')
    expect(countryCodeFromContext(null, ' CHF ')).toBe('CH')
  })

  it('gives euro and dollar jobs with a bare place name nothing', () => {
    expect(countryCodeFromContext('Munich', 'EUR')).toBeNull()
    expect(countryCodeFromContext('Vienna', 'EUR')).toBeNull()
    expect(countryCodeFromContext('Springfield', 'USD')).toBeNull()
    expect(countryCodeFromContext('Springfield', null)).toBeNull()
  })
})
