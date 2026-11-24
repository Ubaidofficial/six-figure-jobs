// freehire fields beyond pay and place (owner's choice, 2026-11-24): the application deadline, and (below, as they are
// added) seniority, experience, education, clearance, recruiter and ghost signals.
import { applicationDeadline, mapFreehireJob, type FreehireJob } from '../../lib/scrapers/freehire'

const NOW = Date.parse('2026-11-24T12:00:00Z')
const job: FreehireJob = {
  public_slug: 'staff-engineer-acme-abc',
  external_id: 'acme:1',
  url: 'https://jobs.lever.co/acme/1',
  title: 'Staff Engineer',
  company: 'Acme',
  location: 'Austin, TX',
  description: '<p>Build things.</p>',
  work_mode: 'onsite',
  posted_at: '2026-11-20T10:00:00Z',
  closed_at: null,
  reality: { class: 'fresh', age_days: 4, fake_freshness: false },
  enrichment: { salary_min: 180000, salary_max: 220000, salary_currency: 'USD', salary_period: 'year' },
}

describe('application deadline', () => {
  it('reads a bare date as the end of that day (the day is inclusive)', () => {
    expect(applicationDeadline('2026-12-15')?.toISOString()).toBe('2026-12-15T23:59:59.999Z')
    expect(applicationDeadline('2026-12-15T17:00:00Z')?.toISOString()).toBe('2026-12-15T17:00:00.000Z')
    expect(applicationDeadline('')).toBeNull()
    expect(applicationDeadline('soon')).toBeNull()
  })
  it('becomes the job expiry when it is ahead', () => {
    expect(mapFreehireJob({ ...job, application_deadline: '2026-12-15' }, NOW)?.validThrough?.toISOString()).toBe('2026-12-15T23:59:59.999Z')
    expect(mapFreehireJob(job, NOW)?.validThrough).toBeNull()
  })
  it('keeps out a job whose deadline has passed, and keeps one whose deadline is today', () => {
    expect(mapFreehireJob({ ...job, application_deadline: '2026-11-23' }, NOW)).toBeNull()
    expect(mapFreehireJob({ ...job, application_deadline: '2026-11-24' }, NOW)).not.toBeNull()
  })
})

describe('company profile from freehire', () => {
  // Trimmed from freehire's /companies/datadog record (2026-11-24).
  const datadog = {
    slug: 'datadog',
    name: 'Datadog',
    hq_country: 'US',
    year_founded: 2010,
    employee_count: 8100,
    company_sizes: ['1000+'],
    company_info: {
      website: 'https://datadoghq.com',
      linkedin: 'https://linkedin.com/company/datadog',
      employee_range: '1001-5000',
      description: 'Modern monitoring &amp; analytics. See inside any stack, any app, at any scale, anywhere.',
      summary: '<p>Explore our open opportunities.</p>',
    },
  }
  it('reads the fields a company page shows', () => {
    const { companyProfileFrom } = require('../../lib/scrapers/freehire')
    expect(companyProfileFrom(datadog)).toEqual({
      website: 'https://datadoghq.com',
      description: 'Modern monitoring & analytics. See inside any stack, any app, at any scale, anywhere.',
      foundedYear: 2010,
      employeeCount: 8100,
      countryCode: 'US',
      sizeBucket: '1000+',
      linkedinUrl: 'https://linkedin.com/company/datadog',
    })
  })
  it('leaves out what is missing, odd or a careers-page line', () => {
    const { companyProfileFrom } = require('../../lib/scrapers/freehire')
    expect(companyProfileFrom({ hq_country: 'usa', year_founded: 3020, employee_count: -1, company_info: { description: 'Join us!', linkedin: 'https://evil.example/company/x' } })).toEqual({})
    expect(companyProfileFrom(null)).toEqual({})
  })
})

describe('which companies are looked up', () => {
  it('asks about a company that has a website but no description, once every 30 days', () => {
    const { companiesToLookUp } = require('../../lib/scrapers/freehireCompanyWebsites')
    const now = new Date('2026-11-24T00:00:00Z')
    const known = new Map([
      ['acme', { hasWebsite: true, hasProfile: true, checkedAt: null }],
      ['beta', { hasWebsite: true, hasProfile: false, checkedAt: null }],
      ['gamma', { hasWebsite: true, hasProfile: false, checkedAt: new Date('2026-11-20T00:00:00Z') }],
    ])
    const plan = companiesToLookUp(
      [{ slug: 'acme', key: 'acme' }, { slug: 'beta', key: 'beta' }, { slug: 'gamma', key: 'gamma' }],
      known,
      now,
    )
    expect(plan).toEqual({ lookUp: ['beta'], hasWebsite: 1, checkedRecently: 1 })
  })
})
