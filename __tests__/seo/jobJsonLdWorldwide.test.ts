import { buildJobJsonLd } from '@/lib/seo/jobJsonLd'
import { validateJobPostingEligibility } from '@/lib/seo/jobPostingEligibility'
import { WORLDWIDE_COUNTRY_CODES } from '@/lib/location/worldwideCountries'

// A remote job as the live site stores it (remoteRegion "Global" on every remote job), from a US company paying in USD:
// the old fallback guessed United States for any of these.
const remoteJob = (over: Record<string, unknown> = {}): any => ({
  id: 'ats:test:worldwide',
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
  currency: 'USD',
  salaryCurrency: 'USD',
  salaryValidated: false,
  companyRef: { name: 'Acme', countryCode: 'US', website: null, logoUrl: null },
  ...over,
})

const names = (over: Record<string, unknown>): string[] => {
  const a = buildJobJsonLd(remoteJob(over)).applicantLocationRequirements
  return a ? (Array.isArray(a) ? a : [a]).map((x: any) => x.name) : []
}

describe('worldwide remote jobs', () => {
  it.each(['Worldwide', 'Remote - Worldwide', 'Anywhere', 'Remote (Global)', 'Work from anywhere'])(
    '"%s" lists every eligible country, not the company or currency country',
    (locationRaw) => {
      const list = names({ locationRaw })
      expect(list).toHaveLength(WORLDWIDE_COUNTRY_CODES.length)
      expect(list).toEqual(expect.arrayContaining(['United States', 'India', 'Brazil', 'Nigeria', 'Germany', 'Japan', 'South Africa']))
      expect(list.every((name) => name.length > 2)).toBe(true) // a real name for every code, never a bare "XX"
      expect(new Set(list).size).toBe(list.length)
    },
  )

  it('leaves out the excluded countries', () => {
    const list = names({ locationRaw: 'Worldwide' })
    for (const excluded of ['Cuba', 'Iran', 'North Korea']) expect(list).not.toContain(excluded)
  })

  it('stays remote, with no workplace, and eligible for Google Jobs', () => {
    const jsonLd = buildJobJsonLd(remoteJob({ locationRaw: 'Remote - Worldwide' }))
    expect(jsonLd.jobLocationType).toBe('TELECOMMUTE')
    expect(jsonLd.jobLocation).toBeUndefined()
    expect(validateJobPostingEligibility(jsonLd)).toEqual([])
  })

  it('adds a bounded amount of markup (a guard against the list growing)', () => {
    const size = JSON.stringify(buildJobJsonLd(remoteJob({ locationRaw: 'Worldwide' })).applicantLocationRequirements).length
    expect(size).toBeLessThan(12_000)
  })

  it('a stored country is real data and wins over the text', () => {
    expect(names({ locationRaw: 'Worldwide', countryCode: 'IN' })).toEqual(['India'])
  })

  it('does not treat text that limits the place as worldwide', () => {
    for (const locationRaw of ['Worldwide (US preferred)', 'Anywhere in the US', 'Remote - Worldwide, EST hours', 'Global (EMEA)']) {
      expect(names({ locationRaw }).length).toBeLessThan(100)
    }
    expect(names({ locationRaw: 'Anywhere in the US' })).toEqual(['United States'])
  })

  it('leaves a bare "Remote" and single-country text as they were', () => {
    expect(names({ locationRaw: 'Remote' })).toEqual(['United States']) // the company-country guess, still to be decided
    expect(names({ locationRaw: 'Remote (US)' })).toEqual(['United States'])
    expect(names({ locationRaw: 'Remote, Germany' })).toEqual(['Germany'])
  })
})
