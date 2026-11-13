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
    for (const locationRaw of ['Remote - Eastern Europe', 'Remote (US or Europe)', 'Remote - Europe & Asia', 'Remote - Europe and EMEA', 'Remote - Nordics, Europe']) {
      expect(names({ locationRaw })).not.toContain('France')
    }
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
