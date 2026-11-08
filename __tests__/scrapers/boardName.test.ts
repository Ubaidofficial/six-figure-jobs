import { boardNameFor } from '../../lib/scrapers/utils/boardHosts'

// Apply buttons are labelled by where they go; live apply links seen on 2026-11-08.
describe('boardNameFor', () => {
  it('names the job board an apply link points at', () => {
    expect(boardNameFor('https://www.xing.com/jobs/berlin-senior-engineer-123')).toBe('XING')
    expect(boardNameFor('https://www.adzuna.co.uk/jobs/land/ad/123')).toBe('Adzuna')
    expect(boardNameFor('https://en-ca.whatjobs.com/pub_api__cpl__159933264__7103')).toBe('WhatJobs')
    expect(boardNameFor('https://himalayas.app/companies/acme/jobs/engineer')).toBe('Himalayas')
    expect(boardNameFor('https://www.jobs.ch/en/vacancies/detail/123/')).toBe('jobs.ch')
  })

  it('returns null for an employer site or its applicant tracking system', () => {
    expect(boardNameFor('https://jobs.ashbyhq.com/acme/123')).toBeNull()
    expect(boardNameFor('https://job-boards.greenhouse.io/acme/jobs/1')).toBeNull()
    expect(boardNameFor('https://careers.acme.com/jobs/1')).toBeNull()
    expect(boardNameFor(null)).toBeNull()
  })
})
