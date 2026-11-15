import { employerHostFromApplyUrl, nameMatchesHost, pickCompanyWebsite } from '../../lib/companies/websiteFromApplyUrls'

describe('employerHostFromApplyUrl', () => {
  it('returns the employer domain without www or a career-site label', () => {
    expect(employerHostFromApplyUrl('https://careers.servicenow.com/jobs/123')).toBe('servicenow.com')
    expect(employerHostFromApplyUrl('https://www.acme.io/careers/x?gh_jid=1')).toBe('acme.io')
    expect(employerHostFromApplyUrl('acme.co.uk/jobs')).toBe('acme.co.uk')
  })
  it('rejects boards, ATS portals, social sites and non-domains', () => {
    expect(employerHostFromApplyUrl('https://boards.greenhouse.io/acme/jobs/1')).toBeNull()
    expect(employerHostFromApplyUrl('https://jobs.lever.co/acme/1')).toBeNull()
    expect(employerHostFromApplyUrl('https://ats.rippling.com/acme/jobs/1')).toBeNull()
    expect(employerHostFromApplyUrl('https://www.linkedin.com/jobs/view/1')).toBeNull()
    expect(employerHostFromApplyUrl('https://www.indeed.com/viewjob?jk=1')).toBeNull()
    expect(employerHostFromApplyUrl('http://10.0.0.1/x')).toBeNull()
    expect(employerHostFromApplyUrl('mailto:jobs@acme.com')).toBeNull()
    expect(employerHostFromApplyUrl('')).toBeNull()
    expect(employerHostFromApplyUrl(null)).toBeNull()
  })
})

describe('nameMatchesHost', () => {
  it('matches a company to its own domain, either way round, ignoring suffixes', () => {
    expect(nameMatchesHost('Datadog', 'datadoghq.com')).toBe(true)
    expect(nameMatchesHost('Scale AI', 'scale.com')).toBe(true)
    expect(nameMatchesHost('Acme, Inc.', 'acme.io')).toBe(true)
    expect(nameMatchesHost('Acme', 'globex.com')).toBe(false)
  })
  it('does not match very short names', () => {
    expect(nameMatchesHost('AI', 'ai.com')).toBe(false)
    expect(nameMatchesHost('Block', 'bl.com')).toBe(false)
  })
})

describe('pickCompanyWebsite', () => {
  it('fills the domain when one employer domain is named and it looks like the company', () => {
    expect(pickCompanyWebsite('ServiceNow', ['https://careers.servicenow.com/a', 'https://careers.servicenow.com/b'])).toEqual({ ok: true, website: 'https://servicenow.com', jobs: 2, nameMatch: true })
    expect(pickCompanyWebsite('ServiceNow', ['https://careers.servicenow.com/a'])).toMatchObject({ ok: true, jobs: 1 })
  })
  it('accepts a domain that does not look like the name only with three or more jobs', () => {
    const urls = ['https://hire.x1.com/1', 'https://hire.x1.com/2']
    expect(pickCompanyWebsite('Globex', urls)).toEqual({ ok: false, reason: 'not-enough-evidence', hosts: ['x1.com'] })
    expect(pickCompanyWebsite('Globex', [...urls, 'https://hire.x1.com/3'])).toMatchObject({ ok: true, website: 'https://x1.com', jobs: 3, nameMatch: false })
  })
  it('refuses several domains and no employer link at all (portals only)', () => {
    expect(pickCompanyWebsite('Acme', ['https://acme.com/1', 'https://acme-careers.net/2']).ok).toBe(false)
    expect(pickCompanyWebsite('Acme', ['https://boards.greenhouse.io/acme/1', null]).ok).toBe(false)
    expect(pickCompanyWebsite('Acme', [])).toEqual({ ok: false, reason: 'no-employer-link', hosts: [] })
  })
})
