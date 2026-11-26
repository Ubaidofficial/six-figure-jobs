import { applySiteOf, isJobBoardApplyUrl } from '../../lib/jobs/applyUrl'

describe('isJobBoardApplyUrl', () => {
  it('catches job boards on any country domain or subdomain', () => {
    for (const u of [
      'https://www.linkedin.com/jobs/view/4300000000',
      'https://www.xing.com/jobs/berlin-engineer-123',
      'https://de.indeed.com/viewjob?jk=1',
      'https://www.efinancialcareers.co.uk/jobs-UK-London-x.id123',
      'https://jobgether.com/offer/abc',
      'https://www.jobbank.gc.ca/jobsearch/jobposting/1',
      'https://www.adzuna.com.au/details/1',
    ]) expect(isJobBoardApplyUrl(u)).toBe(true)
  })

  it('leaves employers and their applicant tracking systems alone', () => {
    for (const u of [
      'https://jobs.ashbyhq.com/acme/1',
      'https://boards.greenhouse.io/acme/jobs/1',
      'https://acme.wd5.myworkdayjobs.com/en-US/External/job/1',
      'https://jobs.lever.co/acme/1',
      'https://careers.acme.com/jobs/1',
      'https://www.coveto.de/jobs/1',
      null,
      'not a link',
    ]) expect(isJobBoardApplyUrl(u)).toBe(false)
  })

  it('reads the registrable site, keeping two-part endings whole', () => {
    expect(applySiteOf('https://jobs.ashbyhq.com/x')).toBe('ashbyhq.com')
    expect(applySiteOf('https://www.jobbank.gc.ca/x')).toBe('jobbank.gc.ca')
    expect(applySiteOf('https://www.efinancialcareers.co.uk/x')).toBe('efinancialcareers.co.uk')
  })
})
