import {
  assertFiltersApplied,
  mapFreehireJob,
  normalizeFreehireSkills,
  stripFreehireUtm,
  type FreehireJob,
} from '../../lib/scrapers/freehire'

// Trimmed from a real freehire.me /jobs/search record.
const job: FreehireJob = {
  public_slug: 'financial-analyst-marketing-and-commercial-zoox-n43jspaa',
  external_id: 'zoox:eacbb34f-e823-4827-90bf-bc8044b660b1',
  url: 'https://jobs.lever.co/zoox/eacbb34f-e823-4827-90bf-bc8044b660b1?utm_source=freehire.me',
  title: 'Financial Analyst, Marketing and Commercial',
  company: 'Zoox',
  location: 'Foster City, CA',
  description: '<p>The FP&amp;A team at Zoox drives financial analysis.</p>',
  work_mode: 'hybrid',
  posted_at: '2026-11-04T22:36:45Z',
  updated_at: '2026-11-04T22:55:21Z',
  closed_at: null,
  reality: { class: 'fresh', age_days: 0, fake_freshness: false },
  enrichment: {
    employment_type: 'full_time',
    salary_min: 165000,
    salary_max: 204000,
    salary_currency: 'USD',
    salary_period: 'year',
  },
}

describe('stripFreehireUtm', () => {
  it('removes only the freehire utm_source tag', () => {
    expect(stripFreehireUtm('https://jobs.lever.co/zoox/abc?utm_source=freehire.me')).toBe(
      'https://jobs.lever.co/zoox/abc',
    )
    expect(stripFreehireUtm('https://x.com/j?gh_jid=1&utm_source=freehire.me')).toBe('https://x.com/j?gh_jid=1')
  })

  it('leaves other utm sources and unparseable values alone', () => {
    expect(stripFreehireUtm('https://x.com/j?utm_source=newsletter')).toBe('https://x.com/j?utm_source=newsletter')
    expect(stripFreehireUtm('not a url')).toBe('not a url')
  })
})

describe('mapFreehireJob', () => {
  it('maps a $100k+ USD yearly job to the employer apply URL', () => {
    const mapped = mapFreehireJob(job)
    expect(mapped).toMatchObject({
      externalId: 'zoox:eacbb34f-e823-4827-90bf-bc8044b660b1',
      title: 'Financial Analyst, Marketing and Commercial',
      rawCompanyName: 'Zoox',
      url: 'https://jobs.lever.co/zoox/eacbb34f-e823-4827-90bf-bc8044b660b1',
      applyUrl: 'https://jobs.lever.co/zoox/eacbb34f-e823-4827-90bf-bc8044b660b1',
      isRemote: false,
      salaryMin: 165000,
      salaryMax: 204000,
      salaryCurrency: 'USD',
      salaryInterval: 'year',
    })
    expect(mapped?.postedAt).toEqual(new Date('2026-11-04T22:36:45Z'))
  })

  it('marks remote work mode', () => {
    expect(mapFreehireJob({ ...job, work_mode: 'remote' })?.isRemote).toBe(true)
  })

  it("fills a bare \"Remote\" from freehire's own geography and keeps text that names a place", () => {
    expect(mapFreehireJob({ ...job, work_mode: 'remote', location: 'Remote', countries: ['us'] })?.locationText).toBe('Remote - United States')
    expect(mapFreehireJob({ ...job, work_mode: 'remote', location: 'Remote', regions: ['global'] })?.locationText).toBe('Remote - Worldwide')
    expect(mapFreehireJob({ ...job, work_mode: 'remote', location: 'Austin, TX', countries: ['us'] })?.locationText).toBe('Austin, TX')
    expect(mapFreehireJob({ ...job, work_mode: 'remote', location: 'Remote' })?.locationText).toBe('Remote')
  })

  it('skips stale, evergreen and fake-fresh postings (old jobs with a bumped posted_at)', () => {
    expect(mapFreehireJob({ ...job, reality: { class: 'stale', age_days: 95, fake_freshness: false } })).toBeNull()
    expect(mapFreehireJob({ ...job, reality: { class: 'likely-evergreen', age_days: 40 } })).toBeNull()
    expect(mapFreehireJob({ ...job, reality: { class: 'fresh', age_days: 1, fake_freshness: true } })).toBeNull()
  })

  it('keeps ordinary open postings freehire calls stale (15-30 days old, not flagged), but not older ones', () => {
    expect(mapFreehireJob({ ...job, reality: { class: 'stale', age_days: 20, fake_freshness: false } })).not.toBeNull()
    expect(mapFreehireJob({ ...job, reality: { class: 'stale', age_days: 30, fake_freshness: false } })).not.toBeNull()
    expect(mapFreehireJob({ ...job, reality: { class: 'stale', age_days: 31, fake_freshness: false } })).toBeNull()
    expect(mapFreehireJob({ ...job, reality: { class: 'stale', age_days: 20, fake_freshness: true } })).toBeNull()
    expect(mapFreehireJob({ ...job, reality: { class: 'stale', fake_freshness: false } })).toBeNull() // no age: cannot tell
  })

  describe('company names that are ATS identifiers', () => {
    // The shape of the job reported from the live site: freehire named the company with an Ashby organisation id.
    const amplitude: FreehireJob = {
      ...job,
      company: '9c26369c-d400-4eb7-a9b3-ab8f6469f9e8',
      company_slug: '9c26369c-d400-4eb7-a9b3-ab8f6469f9e8',
      url: 'https://jobs.ashbyhq.com/amplitude/70e2f3f0-71fd-473e-9c69-c6ed937ca57d?utm_source=freehire.me',
      title: 'Content Marketing Manager',
      description: '<p>Amplitude is the leading AI analytics platform, helping over 5,200 customers.</p>',
    }

    it('recovers the real name, and does not look the id up as a company at freehire', () => {
      const mapped = mapFreehireJob(amplitude)
      expect(mapped?.rawCompanyName).toBe('Amplitude')
      expect(mapped?.companyRef).toBeNull()
    })

    it('leaves a real name and its freehire company handle untouched', () => {
      const mapped = mapFreehireJob({ ...job, company_slug: 'zoox' })
      expect(mapped?.rawCompanyName).toBe('Zoox')
      expect(mapped?.companyRef).toBe('zoox')
    })

    it('skips a job whose company is only an id that nothing in the record can name', () => {
      expect(
        mapFreehireJob({
          ...job,
          company: '8a788267536ec009015376c7bcda018f',
          url: 'https://recruitingbypaycor.com/career/JobIntroduction.action?clientId=8a788267536ec009015376c7bcda018f',
          description: '<p>Position: Senior Director of Quality.</p>',
        }),
      ).toBeNull()
    })
  })

  it('keeps a job when freehire gives no reality verdict', () => {
    expect(mapFreehireJob({ ...job, reality: null })).not.toBeNull()
  })

  it('skips closed jobs', () => {
    expect(mapFreehireJob({ ...job, closed_at: '2026-11-05T00:00:00Z' })).toBeNull()
  })

  it('skips non-yearly salaries and jobs with no enrichment', () => {
    const enrichment = job.enrichment!
    expect(mapFreehireJob({ ...job, enrichment: { ...enrichment, salary_period: 'hour' } })).toBeNull()
    expect(mapFreehireJob({ ...job, enrichment: null })).toBeNull()
  })

  it.each([
    ['USD', 99_999, 100_000],
    ['GBP', 74_999, 75_000],
    ['CAD', 119_999, 120_000],
    ['AUD', 139_999, 140_000],
  ])('applies the %s threshold from lib/currency/thresholds.ts', (currency, below, atThreshold) => {
    const enrichment = job.enrichment!
    const at = { ...enrichment, salary_currency: currency, salary_min: atThreshold, salary_max: atThreshold * 1.2 }
    expect(mapFreehireJob({ ...job, enrichment: { ...at, salary_min: below } })).toBeNull()
    expect(mapFreehireJob({ ...job, enrichment: at })).toMatchObject({
      salaryCurrency: currency,
      salaryMin: atThreshold,
      salaryInterval: 'year',
    })
  })

  describe('euro jobs: the top of the range counts', () => {
    const eur = (salary_min: number, salary_max: number | null) => ({
      ...job,
      enrichment: { ...job.enrichment!, salary_currency: 'EUR', salary_min, salary_max },
    })

    it('publishes a range whose bottom is below EUR 80,000 but whose top reaches it', () => {
      expect(mapFreehireJob(eur(70_000, 95_000))?.salaryMin).toBe(70_000)
      expect(mapFreehireJob(eur(60_000, 80_000))?.salaryMax).toBe(80_000)
    })

    it('skips a range whose top falls short, has no top, or whose bottom is under EUR 60,000', () => {
      expect(mapFreehireJob(eur(70_000, 79_999))).toBeNull()
      expect(mapFreehireJob(eur(70_000, null))).toBeNull()
      expect(mapFreehireJob(eur(59_999, 95_000))).toBeNull()
    })

    it('still publishes a range that starts at the threshold', () => {
      expect(mapFreehireJob(eur(80_000, 100_000))?.salaryMin).toBe(80_000)
    })
  })

  it('skips currencies outside the target markets', () => {
    const enrichment = job.enrichment!
    for (const currency of ['RUB', 'INR', 'PLN']) {
      expect(mapFreehireJob({ ...job, enrichment: { ...enrichment, salary_currency: currency } })).toBeNull()
    }
  })

  it('publishes Swiss-franc jobs from CHF 90,000 and not below it', () => {
    const enrichment = job.enrichment!
    const chf = (salary_min: number) => ({ ...job, enrichment: { ...enrichment, salary_currency: 'CHF', salary_min, salary_max: salary_min + 20000 } })
    expect(mapFreehireJob(chf(90_000))?.salaryCurrency).toBe('CHF')
    expect(mapFreehireJob(chf(89_999))).toBeNull()
  })

  it('falls back to public_slug when external_id is missing', () => {
    expect(mapFreehireJob({ ...job, external_id: null })?.externalId).toBe(job.public_slug)
  })
})

describe('assertFiltersApplied', () => {
  it('passes when freehire reports no ignored params', () => {
    expect(() => assertFiltersApplied({ total: 1, limit: 100, offset: 0 })).not.toThrow()
  })

  it('throws when freehire ignored a param, so an unfiltered catalogue is never ingested', () => {
    expect(() =>
      assertFiltersApplied({ total: 4_700_000, limit: 100, offset: 0, ignored_params: ['salary_min'] }),
    ).toThrow(/ignored request params/)
  })
})

describe('skills and visa sponsorship', () => {
  it('passes freehire skills through, cleaned', () => {
    const mapped = mapFreehireJob({ ...job, skills: ['Python', 'react', 'python', ' Terraform ', 'x', ''] })
    expect(mapped?.skills).toEqual(['python', 'react', 'terraform'])
  })

  it('maps no skills to an empty list', () => {
    expect(mapFreehireJob({ ...job, skills: null })?.skills).toEqual([])
    expect(mapFreehireJob(job)?.skills).toEqual([])
  })

  it('caps the list at 12 and drops very long or non-string entries', () => {
    const many = Array.from({ length: 20 }, (_, i) => `skill-${i}`)
    expect(normalizeFreehireSkills(many)).toHaveLength(12)
    expect(normalizeFreehireSkills(['a'.repeat(41), 42, null, 'ok'])).toEqual(['ok'])
    expect(normalizeFreehireSkills('python')).toEqual([])
  })

  it('maps visa_sponsorship only when freehire says true', () => {
    const withVisa = (v: boolean | null | undefined) =>
      mapFreehireJob({ ...job, enrichment: { ...job.enrichment, visa_sponsorship: v } })?.visaSponsorship
    expect(withVisa(true)).toBe(true)
    expect(withVisa(false)).toBe(false)
    expect(withVisa(null)).toBe(false)
    expect(withVisa(undefined)).toBe(false)
  })
})

describe('sourceRef', () => {
  it('keeps freehire\'s public_slug so the job can be re-checked at the source', () => {
    expect(mapFreehireJob(job)?.sourceRef).toBe('financial-analyst-marketing-and-commercial-zoox-n43jspaa')
  })
})
