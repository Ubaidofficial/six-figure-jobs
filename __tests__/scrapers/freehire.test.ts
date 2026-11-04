import {
  assertFiltersApplied,
  mapFreehireJob,
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

  it('skips closed jobs', () => {
    expect(mapFreehireJob({ ...job, closed_at: '2026-11-05T00:00:00Z' })).toBeNull()
  })

  it('skips salaries below $100k, non-USD and non-yearly', () => {
    const enrichment = job.enrichment!
    expect(mapFreehireJob({ ...job, enrichment: { ...enrichment, salary_min: 99999 } })).toBeNull()
    expect(mapFreehireJob({ ...job, enrichment: { ...enrichment, salary_currency: 'EUR' } })).toBeNull()
    expect(mapFreehireJob({ ...job, enrichment: { ...enrichment, salary_period: 'hour' } })).toBeNull()
    expect(mapFreehireJob({ ...job, enrichment: null })).toBeNull()
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
