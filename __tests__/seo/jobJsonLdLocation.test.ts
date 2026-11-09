import { buildJobJsonLd, cleanLocality } from '../../lib/seo/jobJsonLd'
import { ISO_COUNTRY_CODES } from '../../lib/location/country'
import { countryFromCity } from '../../lib/location/jobLocation'

// Minimal job: only the location fields vary.
function ld(fields: Record<string, unknown>) {
  return buildJobJsonLd({
    id: 'ats:test:loc',
    title: 'Engineer',
    remote: false,
    remoteMode: 'onsite',
    ...fields,
  } as any)
}

const places = (jsonLd: any): any[] => [].concat(jsonLd.jobLocation ?? [])
const countries = (jsonLd: any): string[] => places(jsonLd).map((p) => p.address.addressCountry)

describe('JobPosting jobLocation: addressCountry', () => {
  it('knows there are 249 ISO 3166-1 alpha-2 codes', () => {
    expect(ISO_COUNTRY_CODES.size).toBe(249)
  })

  it('never takes "HQ" for a country', () => {
    const j = ld({ locationRaw: 'HQ', city: null, countryCode: null })
    expect(countries(j)).not.toContain('HQ')
    expect(j.jobLocation).toBeUndefined()
  })

  it('never takes "HQ" from a stored country code either', () => {
    expect(countries(ld({ locationRaw: 'Sunnyvale', city: 'Sunnyvale', countryCode: 'HQ', currency: 'USD' }))).toEqual(['US'])
  })

  it('never takes "SF" for a country', () => {
    const j = ld({ locationRaw: 'SF', city: null, countryCode: null })
    expect(countries(j)).not.toContain('SF')
  })

  it('does not read "am" in "Frankfurt am Main" as Armenia', () => {
    const j = ld({ locationRaw: 'Frankfurt am Main', city: 'Frankfurt am Main', countryCode: null, currency: 'EUR' })
    expect(countries(j)).not.toContain('AM')
    expect(countries(j)).toEqual(['DE']) // last resort: euro pay with nothing else to go on
    expect(countries(ld({ locationRaw: 'Frankfurt am Main', city: 'Frankfurt am Main', countryCode: 'DE' }))).toEqual(['DE'])
  })

  it('gives East Perth, WA to Australia, not the US', () => {
    const noCode = ld({ locationRaw: 'East Perth, WA', city: 'East Perth', countryCode: null, currency: 'AUD' })
    expect(countries(noCode)).toEqual(['AU'])
    const withCode = ld({ locationRaw: 'East Perth, WA', city: 'East Perth', countryCode: 'AU' })
    expect(countries(withCode)).toEqual(['AU'])
  })

  it('reads a trailing euro-area code on a euro job instead of guessing Germany', () => {
    // Live 2026-11-08: "Kerestinec, HR" (Croatia) was tagged DE.
    expect(countries(ld({ locationRaw: 'Kerestinec, HR', city: null, countryCode: null, currency: 'EUR' }))).toEqual(['HR'])
    expect(countries(ld({ locationRaw: 'Schwetzingen, Rhein-Neckar-Kreis', city: null, countryCode: null, currency: 'EUR' }))).toEqual(['DE'])
  })

  it('does not call a EUR job German: Amsterdam is not DE', () => {
    const noCode = ld({ locationRaw: 'Amsterdam', city: 'Amsterdam', countryCode: null, currency: 'EUR' })
    expect(countries(noCode)).toEqual(['NL']) // from the city, not from the euro
    expect(countries(ld({ locationRaw: 'Amsterdam', city: 'Amsterdam', countryCode: 'NL', currency: 'EUR' }))).toEqual(['NL'])
    expect(countries(ld({ locationRaw: 'Zürich, Kanton Zürich', city: 'Zürich', countryCode: null, currency: 'EUR' }))).toEqual(['CH'])
  })

  it('prefers the stored country over the text, and writes UK as GB', () => {
    expect(countries(ld({ locationRaw: 'Paris, France', city: 'Paris', countryCode: 'GB' }))).toEqual(['GB'])
    expect(countries(ld({ locationRaw: 'London', city: 'London', countryCode: 'uk' }))).toEqual(['GB'])
  })

  it('reads a country from text only when the text names one', () => {
    expect(countries(ld({ locationRaw: 'Winnipeg, Canada', city: null, countryCode: null }))).toEqual(['CA'])
    expect(countries(ld({ locationRaw: 'Kleve, Nordrhein-Westfalen', city: null, countryCode: null }))).toEqual(['DE'])
    expect(countries(ld({ locationRaw: 'France, Auvergne-Rhône-Alpes, Savoie (73)', city: null, countryCode: null, currency: 'EUR' }))).toEqual(['FR'])
  })

  it('emits only real country codes, whatever the input', () => {
    const junk = ['HQ', 'SF', 'AM', 'US-REMOTE', 'None', 'Remote', 'NYC', 'CA, US', 'XX', '']
    for (const raw of junk) {
      for (const cc of [null, 'HQ', 'XX', 'None', 'US']) {
        for (const c of countries(ld({ locationRaw: raw, city: null, countryCode: cc, currency: 'USD' }))) {
          expect(ISO_COUNTRY_CODES.has(c)).toBe(true)
        }
      }
    }
  })

  it('keeps today\'s behaviour for a plain job: city, region and country', () => {
    const j = ld({ locationRaw: 'Austin, TX', city: 'Austin', stateCode: 'TX', countryCode: 'US' })
    expect(j.jobLocation).toEqual({
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: 'Austin', addressRegion: 'TX', addressCountry: 'US' },
    })
  })

  it('lists a hybrid job at its office, not as TELECOMMUTE', () => {
    const j = ld({ remote: false, remoteMode: 'hybrid', locationRaw: 'Foster City, CA', city: 'Foster City', countryCode: 'US' })
    expect(j.jobLocationType).toBeUndefined()
    expect(j.applicantLocationRequirements).toBeUndefined()
    expect(countries(j)).toEqual(['US'])
  })

  it("reads the job's own city before the employer's country", () => {
    const j = ld({ remote: true, remoteMode: 'remote', locationRaw: 'Berlin', currency: 'EUR', companyRef: { countryCode: 'CA' } })
    expect(j.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'Germany' })
  })

  it("still falls back to the employer's country when the job names no place", () => {
    const j = ld({ remote: true, remoteMode: 'remote', locationRaw: 'Remote', companyRef: { countryCode: 'CA' } })
    expect(j.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'Canada' })
  })

  it('keeps TELECOMMUTE and applicant requirements for a remote job whose country is unknown', () => {
    const j = ld({ remote: true, remoteMode: 'remote', locationRaw: 'Remote', countryCode: 'HQ', currency: null })
    expect(j.jobLocationType).toBe('TELECOMMUTE')
    expect(j.jobLocation).toBeUndefined()
  })
})

describe('JobPosting jobLocation: addressLocality', () => {
  it('drops "US-REMOTE" and keeps the country', () => {
    const j = ld({ locationRaw: 'US-REMOTE', city: 'US-REMOTE', countryCode: 'US' })
    expect(j.jobLocation.address).toEqual({ '@type': 'PostalAddress', addressCountry: 'US' })
  })

  it('splits a bullet-joined list into places and drops the bare country part', () => {
    const j = ld({ locationRaw: 'San Francisco, CA • New York, NY • United States', city: null, countryCode: 'US' })
    expect(places(j).map((p) => p.address)).toEqual([
      { '@type': 'PostalAddress', addressLocality: 'San Francisco', addressRegion: 'CA', addressCountry: 'US' },
      { '@type': 'PostalAddress', addressLocality: 'New York', addressRegion: 'NY', addressCountry: 'US' },
      { '@type': 'PostalAddress', addressCountry: 'US' },
    ])
  })

  it('gives each part of a semicolon list its own country and no wrong region', () => {
    const j = ld({ locationRaw: 'Frankfurt, Germany; London, UK; Vancouver, BC, Canada', city: null, countryCode: null })
    expect(places(j).map((p) => [p.address.addressLocality, p.address.addressRegion, p.address.addressCountry])).toEqual([
      ['Frankfurt', undefined, 'DE'],
      ['London', undefined, 'GB'],
      ['Vancouver', 'BC', 'CA'],
    ])
  })

  it('does not publish prose as a locality', () => {
    const raw = 'If successful for this role you will be based in Manchester. Please note, this role is office based.'
    const j = ld({ locationRaw: raw, city: null, countryCode: 'GB' })
    expect(j.jobLocation.address.addressLocality).toBeUndefined()
  })
})

describe('cleanLocality', () => {
  it.each([
    ['Melbourne', 'Melbourne'],
    ['San Francisco Office', 'San Francisco'],
    ['Frankfurt am Main', 'Frankfurt am Main'],
    ['St. Louis', 'St. Louis'],
  ])('keeps %s', (input, out) => expect(cleanLocality(input)).toBe(out))

  it.each(['US-REMOTE', 'HQ', 'SF', 'Remote', 'HQ - Sunnyvale', 'A • B', 'A; B', 'Multiple Locations', '', 'x'.repeat(61)])(
    'drops "%s"',
    (input) => expect(cleanLocality(input)).toBeUndefined(),
  )

  it('drops non-strings', () => {
    expect(cleanLocality(null)).toBeUndefined()
    expect(cleanLocality(5)).toBeUndefined()
  })
})

describe('countryFromCity', () => {
  it('knows the cities we have pages for, with or without accents', () => {
    expect(countryFromCity('Amsterdam')).toBe('NL')
    expect(countryFromCity('Zürich')).toBe('CH')
    expect(countryFromCity('san-francisco')).toBe('US')
    expect(countryFromCity('Hong Kong')).toBe('HK')
  })
  it('is null for anything else', () => {
    expect(countryFromCity('Kleve')).toBeNull()
    expect(countryFromCity(null)).toBeNull()
  })
})
