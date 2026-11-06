import { countryFromText, describeJobLocation } from '../jobLocation'

describe('countryFromText', () => {
  it.each([
    ['Winnipeg, Canada', 'CA'],
    ['Remote - US', 'US'],
    ['Remote in the U.S.', 'US'],
    ['United States (Remote)', 'US'],
    ['San Francisco, CA United States', 'US'],
    ['Grand Londres, Royaume-Uni', 'GB'],
    ['Kleve, Nordrhein-Westfalen', 'DE'],
    ['Seattle, Washington', 'US'],
    ['Belfast, Northern Ireland', 'GB'],
    ['Deutschland', 'DE'],
    ['France, Auvergne-Rhône-Alpes, Savoie (73)', 'FR'],
  ])('%s -> %s', (text, code) => expect(countryFromText(text)).toBe(code))

  it.each([
    'Remote',
    'Toronto',
    'Sydney NSW',
    'Melbourne, CA', // a state code is never a country
    'United States/Canada', // two countries
    'New South Wales', // "Wales" inside a region name
    'Nordrhein-Westfalen', // a region alone is not enough
    'Tbilisi, Georgia',
    'Indianapolis, IN',
    '',
  ])('is unsure about "%s"', (text) => expect(countryFromText(text)).toBeNull())

  it('is null for a non-string', () => {
    expect(countryFromText(null)).toBeNull()
    expect(countryFromText(7)).toBeNull()
  })
})

describe('describeJobLocation', () => {
  it('names city, state and country for a single place', () => {
    const v = describeJobLocation({ city: 'Melbourne', countryCode: 'AU', locationRaw: 'Melbourne, VIC, Australia' })
    expect(v).toMatchObject({ text: 'Melbourne, Victoria, Australia', countryCode: 'AU', city: 'Melbourne', region: 'Victoria' })
  })
  it('expands a US state code from the text', () => {
    expect(describeJobLocation({ city: 'Arlington', countryCode: 'US', locationRaw: 'Arlington, VA, US' }).text).toBe(
      'Arlington, Virginia, United States',
    )
  })
  it('prefers stateCode when the database has one', () => {
    expect(describeJobLocation({ city: 'Austin', stateCode: 'tx', countryCode: 'US', locationRaw: 'Austin' }).region).toBe('Texas')
  })
  it('does not take the city for a state ("Washington, DC")', () => {
    const v = describeJobLocation({ city: 'Washington', countryCode: 'US', locationRaw: 'Washington, DC, US' })
    expect(v.text).toBe('Washington, DC, United States')
  })
  it('shows city and country when there is no state', () => {
    expect(describeJobLocation({ city: 'London', countryCode: 'GB', locationRaw: 'London, United Kingdom' }).text).toBe(
      'London, United Kingdom',
    )
  })
  it('works out the country of a place with no country code and adds its name', () => {
    const v = describeJobLocation({ city: 'Kleve', countryCode: null, locationRaw: 'Kleve, Nordrhein-Westfalen' })
    expect(v).toMatchObject({ text: 'Kleve, Nordrhein-Westfalen, Germany', countryCode: 'DE' })
  })
  it('does not trust a stored country that the text contradicts', () => {
    const v = describeJobLocation({ city: 'Paris', countryCode: 'US', locationRaw: 'Paris, France' })
    expect(v.countryCode).toBe('FR')
    expect(v.city).toBeNull()
  })
  it('replaces a bare country with its name', () => {
    expect(describeJobLocation({ countryCode: 'DE', locationRaw: 'Deutschland' }).text).toBe('Germany')
  })
  it('keeps a ";" list compact', () => {
    const v = describeJobLocation({ locationRaw: 'Vancouver, BC, Canada; Calgary, AB, Canada; Toronto, ON, Canada' })
    expect(v).toMatchObject({ compact: 'Vancouver, BC, Canada +2 more', count: 3, first: 'Vancouver, BC, Canada', countryCode: 'CA' })
    expect(v.city).toBeNull()
  })
  it('flags no country for a list that starts without one', () => {
    expect(describeJobLocation({ locationRaw: 'Los Angeles; Miami; New York City' }).countryCode).toBeNull()
  })
  it('says remote with the country, not the unreliable "Global" region', () => {
    const v = describeJobLocation({ remote: true, remoteMode: 'remote', remoteRegion: 'Global', countryCode: 'US', locationRaw: 'Remote' })
    expect(v).toMatchObject({ text: 'Remote · United States', countryCode: 'US', remote: true })
  })
  it('reads the country of a remote job from its text', () => {
    expect(describeJobLocation({ remote: true, remoteRegion: 'Global', locationRaw: 'Remote (US)' }).text).toBe('Remote · United States')
  })
  it('says worldwide only when the text does', () => {
    expect(describeJobLocation({ remote: true, remoteRegion: 'Global', locationRaw: 'Worldwide' }).text).toBe('Remote · Worldwide')
    expect(describeJobLocation({ remote: true, remoteRegion: 'Global', locationRaw: 'Remote' }).text).toBe('Remote')
  })
  it('uses a real remote region', () => {
    expect(describeJobLocation({ remote: true, remoteRegion: 'uk-ireland' }).text).toBe('Remote · UK & Ireland')
  })
  it('cuts employer prose at a word', () => {
    const raw = `If successful for this role you will be based in Manchester. ${'Please note the role is office based. '.repeat(5)}`
    const v = describeJobLocation({ locationRaw: raw })
    expect(v.text.length).toBeLessThanOrEqual(92)
    expect(v.text.endsWith('…')).toBe(true)
  })
  it('ignores a code that is not a country, and handles missing data', () => {
    expect(describeJobLocation({ city: 'Springfield', countryCode: 'ZZ', locationRaw: 'Springfield' }).text).toBe('Springfield')
    expect(describeJobLocation({}).text).toBe('Location not specified')
    expect(describeJobLocation({ countryCode: 'None' }).text).toBe('Location not specified')
  })
})
