import { buildJobJsonLd } from '@/lib/seo/jobJsonLd'
import { validateJobPostingEligibility } from '@/lib/seo/jobPostingEligibility'

// A remote job as the live site stores it: remoteRegion is "Global" on every remote job, so the location text decides.
const remoteJob = (over: Record<string, unknown> = {}): any => ({
  id: 'ats:test:region',
  title: 'Staff Platform Engineer',
  company: 'Acme',
  descriptionHtml: '<p>Build and run our platform. This role is fully remote.</p>'.repeat(3),
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-12T00:00:00Z'),
  postedAt: new Date('2026-11-01T00:00:00Z'),
  remote: true,
  remoteMode: 'remote',
  remoteRegion: 'Global',
  countryCode: null,
  locationRaw: 'Remote',
  salaryValidated: false,
  companyRef: { name: 'Acme', countryCode: 'DE', website: null, logoUrl: null },
  ...over,
})

const names = (over: Record<string, unknown>): string[] => {
  const a = buildJobJsonLd(remoteJob(over)).applicantLocationRequirements
  return a ? (Array.isArray(a) ? a : [a]).map((x: any) => x.name) : []
}

describe('remote jobs that name a region', () => {
  it('"Remote - Europe" lists the countries of Europe, not the company country or a short sample', () => {
    const list = names({ locationRaw: 'Remote - Europe' })
    expect(list.length).toBeGreaterThan(40)
    expect(list).toEqual(expect.arrayContaining(['United Kingdom', 'France', 'Spain', 'Poland', 'Germany', 'Switzerland']))
    expect(list).not.toContain('United States')
    expect(list).not.toContain('XK') // Kosovo has no ISO code, so no name Google would know
    expect(new Set(list).size).toBe(list.length)
  })

  it('"Remote - EMEA" adds the Middle East and Africa, "Remote - APAC" and "Asia-Pacific" give the Asia-Pacific countries', () => {
    expect(names({ locationRaw: 'Remote - EMEA' })).toEqual(
      expect.arrayContaining(['United Kingdom', 'United Arab Emirates', 'South Africa']),
    )
    for (const locationRaw of ['Remote - APAC', 'Remote, Asia-Pacific', 'Asia Pacific (remote)']) {
      expect(names({ locationRaw })).toEqual(expect.arrayContaining(['Australia', 'Japan', 'Singapore', 'India']))
    }
    expect(names({ locationRaw: 'Remote - Middle East' })).toEqual(expect.arrayContaining(['Israel', 'United Arab Emirates']))
  })

  it('keeps the job marked remote, with no workplace, and eligible for Google Jobs', () => {
    const jsonLd = buildJobJsonLd(remoteJob({ locationRaw: 'Remote - Europe' }))
    expect(jsonLd.jobLocationType).toBe('TELECOMMUTE')
    expect(jsonLd.jobLocation).toBeUndefined()
    expect(validateJobPostingEligibility(jsonLd)).toEqual([])
  })

  it('a stored country is real data and wins over the region text', () => {
    expect(names({ locationRaw: 'Remote - Europe', countryCode: 'FR' })).toEqual(['France'])
  })

  it('does not widen or narrow the region when the text says more than one thing', () => {
    for (const locationRaw of ['Remote - Eastern Europe', 'Remote - Europe & Asia', 'Remote - Europe and EMEA', 'Remote - Nordics, Europe']) {
      expect(names({ locationRaw })).not.toContain('France')
    }
  })

  // Seen live 2026-11-24: ClickHouse's "Europe or US" job (stored country US) listed the United States alone, and an
  // office in the US it does not have.
  describe('a region or a country ("Europe or US")', () => {
    it.each([
      ['Europe or US', 'US'],
      ['Europe or US', null],
      ['Remote (US or Europe)', null],
      ['Remote - United States or Europe', 'US'],
    ])('"%s" (stored country %s) lists Europe and the United States', (locationRaw, countryCode) => {
      const list = names({ locationRaw, countryCode })
      expect(list).toEqual(expect.arrayContaining(['United States', 'France', 'Germany', 'Poland']))
      expect(list.length).toBeGreaterThan(40)
      expect(new Set(list).size).toBe(list.length)
    })

    it('a stored country the text does not name still wins', () => {
      expect(names({ locationRaw: 'Europe or Canada', countryCode: 'US' })).toEqual(['United States'])
    })

    it.each([null, 'Europe or US'])('is TELECOMMUTE with no office (city %s), and stays eligible for Google Jobs', (city) => {
      const jsonLd = buildJobJsonLd(remoteJob({ locationRaw: 'Europe or US', city, countryCode: 'US' }))
      expect(jsonLd.jobLocationType).toBe('TELECOMMUTE')
      expect(jsonLd.jobLocation).toBeUndefined()
      expect(validateJobPostingEligibility(jsonLd)).toEqual([])
    })
  })

  it('a remote job whose text names only countries has no office either', () => {
    for (const locationRaw of ['United States', 'Remote (US/Canada)']) {
      const jsonLd = buildJobJsonLd(remoteJob({ locationRaw, countryCode: 'US' }))
      expect(jsonLd.jobLocationType).toBe('TELECOMMUTE')
      expect(jsonLd.jobLocation).toBeUndefined()
    }
  })

  it('a remote job that names a city keeps its office', () => {
    const jsonLd = buildJobJsonLd(remoteJob({ locationRaw: 'San Francisco, CA, US; Remote, US', countryCode: 'US' }))
    expect(jsonLd.jobLocation).toBeDefined()
  })

  it('a region stored by the older pipeline gives the same full lists; UK & Ireland stays two countries', () => {
    expect(names({ remoteRegion: 'europe' }).length).toBeGreaterThan(40)
    expect(names({ remoteRegion: 'emea' })).toEqual(expect.arrayContaining(['South Africa', 'France']))
    expect(names({ remoteRegion: 'apac' })).toEqual(expect.arrayContaining(['Australia', 'Japan']))
    expect(names({ remoteRegion: 'uk-ireland' })).toEqual(['United Kingdom', 'Ireland'])
  })

  it('leaves single-country jobs as they were', () => {
    expect(names({ locationRaw: 'Remote (US)' })).toEqual(['United States'])
    expect(names({ locationRaw: 'Remote, Germany' })).toEqual(['Germany'])
    expect(names({ remoteRegion: 'us-only', countryCode: 'US' })).toEqual(['United States'])
  })
})
