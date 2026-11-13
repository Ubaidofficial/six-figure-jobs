import { freehireCountryCodes, freehireRemoteScope } from '@/lib/scrapers/freehireStructured'

// Shapes taken from freehire's API on 2026-11-13 (regions=global sample of 100 and the newest 100 remote USD jobs).
describe('freehireRemoteScope', () => {
  it('a remote job freehire marks global, with no country and text that names no place, is worldwide', () => {
    for (const location of ['Worldwide', 'Remote', 'Anywhere', 'Remote - Worldwide', 'Fully Remote', '']) {
      expect(freehireRemoteScope({ work_mode: 'remote', location, countries: [], regions: ['global'] })).toEqual({ scope: 'worldwide' })
    }
  })

  it('does not believe "global" on its own: a country freehire lists wins', () => {
    expect(freehireRemoteScope({ work_mode: 'remote', location: 'Remote', countries: ['us'], regions: ['global'] })).toEqual({
      scope: 'countries',
      countries: ['US'],
    })
  })

  it('does not believe "global" for jobs that are not remote or whose text names a place', () => {
    expect(freehireRemoteScope({ work_mode: 'hybrid', location: 'New York Metropolitan - Hybrid', regions: ['global'] })).toEqual({ scope: 'unknown' })
    expect(freehireRemoteScope({ work_mode: 'onsite', location: 'In-Office', regions: ['global'] })).toEqual({ scope: 'unknown' })
    expect(freehireRemoteScope({ work_mode: 'remote', location: 'USEAST', regions: ['global'] })).toEqual({ scope: 'unknown' })
    expect(freehireRemoteScope({ work_mode: 'remote', location: 'Remote - US only', regions: ['global'] })).toEqual({ scope: 'unknown' })
  })

  it('a remote job with countries is open in those countries, as ISO codes without repeats', () => {
    expect(freehireRemoteScope({ work_mode: 'remote', countries: ['us', 'ca', 'US'], regions: ['north_america'] })).toEqual({
      scope: 'countries',
      countries: ['US', 'CA'],
    })
  })

  it('a remote job with only regions is open in those regions', () => {
    expect(freehireRemoteScope({ work_mode: 'remote', location: 'Remote - EU', countries: [], regions: ['eu', 'uk'] })).toEqual({
      scope: 'regions',
      regions: ['eu', 'uk'],
    })
  })

  it('says unknown when freehire resolved nothing, or sent nothing usable', () => {
    for (const job of [
      { work_mode: 'remote', regions: ['none'] },
      { work_mode: 'remote', countries: [], regions: [] },
      { work_mode: 'remote' },
      { work_mode: 'remote', countries: null, regions: null },
      { work_mode: 'remote', regions: ['atlantis'] },
      {},
    ]) {
      expect(freehireRemoteScope(job)).toEqual({ scope: 'unknown' })
    }
  })
})

describe('freehireCountryCodes', () => {
  it('keeps real countries only, as ISO codes, once each', () => {
    expect(freehireCountryCodes(['us', 'CA', 'uk', 'xx', 'usa', '', 7, 'us'])).toEqual(['US', 'CA', 'GB'])
    expect(freehireCountryCodes(null)).toEqual([])
    expect(freehireCountryCodes('us')).toEqual([])
  })
})
