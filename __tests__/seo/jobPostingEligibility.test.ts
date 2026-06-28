import { buildJobJsonLd } from '../../lib/seo/jobJsonLd'
import { validateJobPostingEligibility } from '../../lib/seo/jobPostingEligibility'

// Per-PR gate for the SAME Google Jobs eligibility rules the daily production
// schema smoke test enforces (scripts/seo-schema-smoke.ts), run against the
// JSON-LD builder output so a code regression that drops a required field is
// caught on the PR instead of ~24h later in production.

const base = {
  id: 'ats:test:elig',
  title: 'Senior Software Engineer',
  company: 'Acme',
  companyLogo: null,
  locationRaw: 'New York, US',
  city: 'New York',
  citySlug: 'new-york',
  countryCode: 'US',
  remote: false,
  remoteRegion: null,
  remoteMode: 'onsite',
  salaryRaw: null,
  descriptionHtml: '<p>Build platform systems.</p>',
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: 'USD',
  salaryPeriod: 'year',
  minAnnual: BigInt(180000),
  maxAnnual: BigInt(220000),
  currency: 'USD',
  isHighSalary: true,
  type: 'Full-time',
  source: 'greenhouse',
  applyUrl: 'https://jobs.example.com/apply',
  url: 'https://jobs.example.com/role',
  roleSlug: 'software-engineer',
  externalId: '1',
  isExpired: false,
  lastSeenAt: new Date('2026-03-20T00:00:00.000Z'),
  postedAt: new Date('2026-03-15T00:00:00.000Z'),
  createdAt: new Date('2026-03-15T00:00:00.000Z'),
  updatedAt: new Date('2026-03-20T00:00:00.000Z'),
  employmentType: 'full-time',
  salaryConfidence: 90,
  salaryValidated: true,
  salarySource: 'ats',
  companyRef: { id: 'c1', name: 'Acme', slug: 'acme', website: 'https://acme.com', countryCode: 'US' },
}

describe('JobPosting JSON-LD is Google Jobs eligible (builder output)', () => {
  it('a located role passes all eligibility rules', () => {
    const ld = buildJobJsonLd({ ...base } as any)
    expect(validateJobPostingEligibility(ld)).toEqual([])
  })

  it('a fully remote role passes (TELECOMMUTE + applicant location)', () => {
    const ld = buildJobJsonLd({
      ...base,
      id: 'ats:test:elig-remote',
      title: 'Remote Product Manager',
      locationRaw: 'Remote, US',
      remote: true,
      remoteMode: 'remote',
    } as any)
    expect(validateJobPostingEligibility(ld)).toEqual([])
  })
})

describe('validateJobPostingEligibility catches missing required fields', () => {
  it('flags a posting missing the hiring organization name and location', () => {
    const errors = validateJobPostingEligibility({
      '@type': 'JobPosting',
      title: 'X',
      description: 'Y',
      datePosted: '2026-03-15',
      validThrough: '2026-05-15',
    })
    expect(errors).toContain('Missing hiringOrganization.name')
    expect(errors).toContain('Missing jobLocation or applicantLocationRequirements/TELECOMMUTE')
  })

  it('flags a non-JobPosting object', () => {
    expect(validateJobPostingEligibility({ '@type': 'WebPage' })).toEqual(['Missing JobPosting JSON-LD'])
  })
})
