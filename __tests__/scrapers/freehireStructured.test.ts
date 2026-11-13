import { freehireCountryCodes, freehireRemoteScope, freehireStructuredLocationText } from '@/lib/scrapers/freehireStructured'
import { processLocation } from '@/lib/ingest'
import { buildJobJsonLd } from '@/lib/seo/jobJsonLd'

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

describe('freehireStructuredLocationText (what mapFreehireJob stores for a bare "Remote")', () => {
  it('worldwide, one country, several countries and one region become text the site reads', () => {
    expect(freehireStructuredLocationText({ work_mode: 'remote', location: 'Remote', regions: ['global'] })).toBe('Remote - Worldwide')
    expect(freehireStructuredLocationText({ work_mode: 'remote', location: 'Remote', countries: ['us'], regions: ['north_america'] })).toBe(
      'Remote - United States',
    )
    expect(freehireStructuredLocationText({ work_mode: 'remote', location: '', countries: ['us', 'ca'] })).toBe(
      'Remote - United States; Remote - Canada',
    )
    expect(freehireStructuredLocationText({ work_mode: 'remote', location: null, regions: ['eu'] })).toBe('Remote - Europe')
    expect(freehireStructuredLocationText({ work_mode: 'remote', location: 'Remote', regions: ['eu', 'uk'] })).toBe('Remote - Europe')
    expect(freehireStructuredLocationText({ work_mode: 'remote', location: 'Remote', regions: ['north_america'] })).toBe('Remote - North America')
  })

  it("keeps freehire's text when it names a place, the job is not remote, or the fields say too little", () => {
    expect(freehireStructuredLocationText({ work_mode: 'remote', location: 'Remote - US only', countries: ['us'] })).toBeNull()
    expect(freehireStructuredLocationText({ work_mode: 'remote', location: 'Город Москва', countries: ['ru'] })).toBeNull()
    expect(freehireStructuredLocationText({ work_mode: 'hybrid', location: 'Remote', countries: ['us'] })).toBeNull()
    expect(freehireStructuredLocationText({ work_mode: 'remote', location: 'Remote', countries: [], regions: [] })).toBeNull()
    expect(freehireStructuredLocationText({ work_mode: 'remote', location: 'Remote', regions: ['latam'] })).toBeNull()
    expect(freehireStructuredLocationText({ work_mode: 'remote', location: 'Remote', regions: ['eu', 'apac'] })).toBeNull()
    expect(
      freehireStructuredLocationText({ work_mode: 'remote', location: 'Remote', countries: ['us', 'ca', 'gb', 'de', 'fr', 'es', 'it'] }),
    ).toBeNull()
  })

  // The texts above go through the normal ingest and JobPosting markup: check what a remote job ends up with.
  it.each([
    ['Remote - Worldwide', null, 190],
    ['Remote - United States', 'US', ['United States']],
    ['Remote - United States; Remote - Canada', null, ['United States', 'Canada']],
    ['Remote - Europe', null, 45],
    ['Remote - North America', null, ['United States', 'Canada']],
  ] as const)('%s: stored country %s, JobPosting applicantLocationRequirements %j', (text, country, expected) => {
    const loc = processLocation({ locationText: text, isRemote: true, salaryCurrency: 'USD' } as any)
    expect(loc.countryCode).toBe(country)
    expect(loc.remoteMode).toBe('remote')
    const ld = buildJobJsonLd({
      id: 'job_1', title: 'Engineer', descriptionHtml: '<p>Build things.</p>', postedAt: new Date(), createdAt: new Date(),
      locationRaw: text, countryCode: loc.countryCode, remoteMode: loc.remoteMode, remote: true, isRemote: true,
      remoteRegion: 'Global', salaryCurrency: 'USD', company: 'Acme', companyRef: { name: 'Acme' },
    } as any)
    const req = ld.applicantLocationRequirements
    const names = (Array.isArray(req) ? req : [req]).map((r: any) => r.name)
    if (typeof expected === 'number') expect(names).toHaveLength(expected)
    else expect(names).toEqual(expected)
  })
})
