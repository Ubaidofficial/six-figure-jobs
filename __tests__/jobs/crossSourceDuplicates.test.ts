import { duplicateJobIdsToExpire, type DuplicateCandidate } from '../../lib/jobs/crossSourceDuplicates'

const job = (over: Partial<DuplicateCandidate>): DuplicateCandidate => ({
  id: 'x',
  companyId: 'c1',
  title: 'Applied AI Engineer',
  locationRaw: 'London',
  city: null,
  applyUrl: null,
  url: null,
  postedAt: new Date('2026-11-06T00:00:00Z'),
  createdAt: new Date('2026-11-06T00:00:00Z'),
  ...over,
})

describe('duplicateJobIdsToExpire', () => {
  it('keeps the employer copy of one opening listed again by a job board (live: iwoca, 2026-11-08)', () => {
    const ats = job({ id: 'ats', locationRaw: 'London', applyUrl: 'https://jobs.ashbyhq.com/iwoca.co.uk/e00f2ee1' })
    const board = job({ id: 'board', locationRaw: 'London, UK', applyUrl: 'https://www.adzuna.co.uk/jobs/details/5957977760', postedAt: new Date('2026-11-08T00:00:00Z') })
    expect(duplicateJobIdsToExpire([board, ats])).toEqual(['board'])
  })

  it('keeps the newest when both copies are on the same kind of site', () => {
    const older = job({ id: 'older', applyUrl: 'https://jobs.ashbyhq.com/a/1' })
    const newer = job({ id: 'newer', applyUrl: 'https://jobs.ashbyhq.com/a/2', postedAt: new Date('2026-11-08T00:00:00Z') })
    expect(duplicateJobIdsToExpire([older, newer])).toEqual(['older'])
  })

  it('leaves different cities, companies, titles and remote regions alone', () => {
    const jobs = [
      job({ id: 'sunnyvale', title: 'Staff Software Engineer, Infrastructure', locationRaw: 'Sunnyvale, CA, USA' }),
      job({ id: 'cambridge', title: 'Staff Software Engineer, Infrastructure', locationRaw: 'Cambridge, MA, USA' }),
      job({ id: 'other-co', companyId: 'c2' }),
      job({ id: 'other-title', title: 'Senior Applied AI Engineer' }),
      job({ id: 'remote-us', locationRaw: 'Remote, United States' }),
      job({ id: 'remote-ca', locationRaw: 'Remote, Canada' }),
      job({ id: 'no-place', locationRaw: null }),
    ]
    expect(duplicateJobIdsToExpire([...jobs, job({ id: 'london' })])).toEqual([])
  })
})
