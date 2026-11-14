jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/jobs/ingestBoardJob', () => ({ ingestBoardJob: jest.fn() }))

import { parseJobicyPage } from '../../lib/scrapers/jobicy'
import { parseWorkingNomads } from '../../lib/scrapers/workingnomads'
import { boardNameFor } from '../../lib/scrapers/utils/boardHosts'

// Shapes seen live on 2026-11-14; companies and text invented.
const jobicy = {
  jobs: [
    {
      id: '1', url: 'https://jobicy.com/jobs/1-account-executive', jobTitle: 'Account Executive', companyName: 'Acme',
      jobType: "['Full-Time']", jobGeo: 'USA', pubDate: '2026-11-14T16:07:57+00:00', jobDescription: '<p>Sell things.</p>',
      salaryMin: '145000', salaryMax: '215000', salaryCurrency: 'usd', salaryPeriod: 'yearly',
    },
    { id: '2', url: 'https://jobicy.com/jobs/2-writer', jobTitle: 'Writer', companyName: 'Words', jobGeo: 'Europe', jobDescription: '<p>Write.</p>' },
    {
      id: '3', url: 'https://jobicy.com/jobs/3-engineer', jobTitle: 'Engineer', companyName: 'Code', jobGeo: 'Worldwide',
      jobDescription: '<p>The base salary range for this role is $150,000 - $180,000 per year.</p>',
    },
    { id: '4', url: 'https://evil.example/x', jobTitle: 'Not Jobicy', companyName: 'X', salaryMin: '200000' },
  ],
}

describe('parseJobicyPage', () => {
  it('reads structured pay and the Jobicy listing URL as the apply link', () => {
    const [first] = parseJobicyPage(jobicy)
    expect(first).toMatchObject({
      externalId: '1', title: 'Account Executive', company: 'Acme', url: 'https://jobicy.com/jobs/1-account-executive',
      location: 'USA', employmentType: 'Full-Time', salaryMin: 145000, salaryMax: 215000, salaryCurrency: 'USD', salaryInterval: 'year',
    })
    expect(first.postedAt?.toISOString()).toBe('2026-11-14T16:07:57.000Z')
  })

  it('keeps a job whose pay is only in the description, drops one with no pay and any non-Jobicy URL', () => {
    expect(parseJobicyPage(jobicy).map((j) => j.externalId)).toEqual(['1', '3'])
  })

  it('survives a broken page', () => {
    expect(parseJobicyPage(null)).toEqual([])
    expect(parseJobicyPage({ jobs: 'nope' })).toEqual([])
  })
})

describe('parseWorkingNomads', () => {
  const feed = [
    { url: 'https://www.workingnomads.com/job/go/2019516/', title: 'QA', company_name: 'Tester Work', location: 'Europe', tags: 'QA,Tech', pub_date: '2026-11-13T09:12:26-05:00', description: '<p>No pay stated.</p>' },
    { url: 'https://www.workingnomads.com/job/go/2019517/', title: 'Engineer', company_name: 'Code', location: 'Anywhere', tags: 'python, ml', pub_date: '2026-11-13T09:12:26-05:00', description: '<p>The salary range is $160,000 - $190,000 per year.</p>' },
  ]

  it('keeps only jobs that state pay, with the redirect as the apply link', () => {
    const jobs = parseWorkingNomads(feed)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ externalId: '2019517', title: 'Engineer', url: 'https://www.workingnomads.com/job/go/2019517/', skills: ['python', 'ml'] })
    expect(jobs[0].postedAt?.toISOString()).toBe('2026-11-13T14:12:26.000Z')
  })

  it('survives a non-array', () => {
    expect(parseWorkingNomads({})).toEqual([])
  })
})

describe('apply labels', () => {
  it('names both boards, so a button never claims to be the company site', () => {
    expect(boardNameFor('https://jobicy.com/jobs/1-account-executive')).toBe('Jobicy')
    expect(boardNameFor('https://www.workingnomads.com/job/go/2019517/')).toBe('Working Nomads')
  })
})
