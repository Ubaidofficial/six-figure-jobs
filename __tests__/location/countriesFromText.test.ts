import { countriesFromText } from '@/lib/location/jobLocation'

describe('countriesFromText', () => {
  it.each<[string, string[]]>([
    // the most common texts of country-less remote jobs in the 2026-11-13 audit
    ['Remote, Canada; Remote, United States', ['CA', 'US']],
    ['US, CA, Remote', ['US', 'CA']],
    ['United States & Canada', ['US', 'CA']],
    ['Remote (United States | Canada)', ['US', 'CA']],
    ['Remote (US/Canada)', ['US', 'CA']],
    ['San Francisco, CA, New York, NY, Portland, OR, or Remote within Canada or United States', ['CA', 'US']],
    // other ways of listing countries
    ['Remote in the US or Canada', ['US', 'CA']],
    ['US/CA', ['US', 'CA']],
    ['Remote - UK or Ireland', ['GB', 'IE']],
    ['Berlin, Germany or London, UK', ['DE', 'GB']],
  ])('"%s" names %j', (text, expected) => {
    expect(countriesFromText(text)).toEqual(expected)
  })

  it('does not read a state code beside a city as a country', () => {
    expect(countriesFromText('San Francisco, CA, US; Remote, US')).toEqual(['US'])
    expect(countriesFromText('Wilmington, DE')).toEqual([])
    expect(countriesFromText('Austin, TX, Remote')).toEqual([])
    expect(countriesFromText('Portland, OR')).toEqual([])
  })

  it('gives one country, or none, when the text names one or none', () => {
    expect(countriesFromText('Canada - Remote (ON, AB, BC, or NS Only)')).toEqual(['CA'])
    expect(countriesFromText('Cardiff, London or Remote (UK)')).toEqual(['GB'])
    expect(countriesFromText('Remote (US)')).toEqual(['US'])
    for (const text of ['Remote', 'Worldwide', 'Boston or Remote', 'Remote - US: Select locations', '', '   ']) {
      expect(countriesFromText(text).length).toBeLessThanOrEqual(1)
    }
    expect(countriesFromText('Remote')).toEqual([])
  })

  it('leaves out words that are also common codes (IN, IT, OR, ES), and any non-text', () => {
    expect(countriesFromText('US, IT')).toEqual(['US'])
    expect(countriesFromText('IN, ES')).toEqual([])
    for (const value of [null, undefined, 42, {}, []]) expect(countriesFromText(value)).toEqual([])
  })

  it('lists each country once', () => {
    expect(countriesFromText('US, United States, USA')).toEqual(['US'])
    expect(countriesFromText('Canada; Canada or United States')).toEqual(['CA', 'US'])
  })
})
