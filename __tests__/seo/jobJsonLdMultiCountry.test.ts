import { buildJobJsonLd } from '@/lib/seo/jobJsonLd'
import { validateJobPostingEligibility } from '@/lib/seo/jobPostingEligibility'

// A remote job as the live site stores it: remoteRegion "Global" on every remote job, no stored country, from a US
// company paying in USD (the case where the old fallback guessed United States for everything).
const remoteJob = (over: Record<string, unknown> = {}): any => ({
  id: 'ats:test:multi',
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

describe('remote jobs whose text lists several countries', () => {
  it.each([
    'Remote, Canada; Remote, United States',
    'US, CA, Remote',
    'United States & Canada',
    'Remote (United States | Canada)',
    'Remote (US/Canada)', // used to give Canada only
    'San Francisco, CA, New York, NY, Portland, OR, or Remote within Canada or United States',
  ])('"%s" is open in the United States and Canada', (locationRaw) => {
    expect(names({ locationRaw }).sort()).toEqual(['Canada', 'United States'])
  })

  it('keeps the job eligible for Google Jobs', () => {
    const jsonLd = buildJobJsonLd(remoteJob({ locationRaw: 'Remote (US/Canada)' }))
    expect(jsonLd.jobLocationType).toBe('TELECOMMUTE')
    expect(validateJobPostingEligibility(jsonLd)).toEqual([])
  })

  it('a stored country wins over the text, and a state code beside a city is not Canada', () => {
    expect(names({ locationRaw: 'US, CA, Remote', countryCode: 'US' })).toEqual(['United States'])
    expect(names({ locationRaw: 'San Francisco, CA, US; Remote, US' })).toEqual(['United States'])
  })

  it('leaves single-country text and a bare "Remote" as they were', () => {
    expect(names({ locationRaw: 'Remote (US)' })).toEqual(['United States'])
    expect(names({ locationRaw: 'Canada - Remote (ON, AB, BC, or NS Only)' })).toEqual(['Canada'])
    expect(names({ locationRaw: 'Cardiff, London or Remote (UK)' })).toEqual(['United Kingdom'])
    expect(names({ locationRaw: 'Remote' })).toEqual(['United States']) // the company-country guess, still to be decided
  })
})

describe('"North America" and "Americas"', () => {
  it('"North America" is the United States and Canada', () => {
    expect(names({ locationRaw: 'North America' }).sort()).toEqual(['Canada', 'United States'])
    expect(names({ locationRaw: 'Remote - North America' }).sort()).toEqual(['Canada', 'United States'])
  })

  it('"Americas" is North, Central and South America and the Caribbean, without Cuba', () => {
    for (const locationRaw of ['Americas', 'Americas Remote']) {
      const list = names({ locationRaw })
      expect(list).toEqual(expect.arrayContaining(['United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Jamaica']))
      expect(list).not.toContain('Cuba')
      expect(list).not.toContain('Germany')
      expect(list).toHaveLength(34)
    }
  })

  it('text that narrows or widens them is left alone', () => {
    expect(names({ locationRaw: 'Remote - Europe and North America' })).not.toContain('France')
    expect(names({ locationRaw: 'North America (US only)' })).toEqual(['United States'])
  })
})

describe('the countries an employer cannot lawfully hire in are left out of every region list', () => {
  it('Iran is not in the Middle East or EMEA lists, and Cuba is not in the Americas list', () => {
    for (const locationRaw of ['Remote - Middle East', 'Remote - EMEA']) {
      const list = names({ locationRaw })
      expect(list.length).toBeGreaterThan(10)
      expect(list).not.toContain('Iran')
    }
    expect(names({ remoteRegion: 'middle-east' })).not.toContain('Iran')
    expect(names({ locationRaw: 'Remote - EMEA' })).toContain('Israel')
  })
})
