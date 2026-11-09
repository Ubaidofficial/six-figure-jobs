import { atsTenantKey, duplicateJobIdsToExpire, type DuplicateCandidate } from '../../lib/jobs/crossSourceDuplicates'

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

  it('expires the second copy from one Workday tenant filed under two company records (live: GDIT, 2026-11-09)', () => {
    const title = 'Senior System Administrator - DISA E-ICAM Program'
    const referral = job({
      id: 'referral', companyId: 'gdit', title, locationRaw: 'USA MD Fort Meade',
      applyUrl: 'https://gdit.wd5.myworkdayjobs.com/GDIT_Empl_Ref/job/USA-MD-Fort-Meade/Senior-System-Administrator---DISA-E-ICAM-Program--Hybrid-_RQ231857',
      postedAt: new Date('2026-11-08T00:00:00Z'), createdAt: new Date('2026-11-08T01:00:00Z'),
    })
    const external = job({
      id: 'external', companyId: 'general-dynamics-it', title, locationRaw: 'USA MD Fort Meade',
      applyUrl: 'https://gdit.wd5.myworkdayjobs.com/External_Career_Site/job/USA-MD-Fort-Meade/Senior-System-Administrator---DISA-E-ICAM-Program--Hybrid-_RQ231857-1',
      postedAt: new Date('2026-11-08T00:00:00Z'), createdAt: new Date('2026-11-08T02:00:00Z'),
    })
    expect(duplicateJobIdsToExpire([referral, external])).toEqual(['referral'])
    // the public career site wins even when the referral copy is newer
    const newerReferral = { ...referral, createdAt: new Date('2026-11-08T03:00:00Z') }
    expect(duplicateJobIdsToExpire([newerReferral, external])).toEqual(['referral'])
  })

  it('leaves different Workday tenants and different titles in one tenant alone', () => {
    const wd = (id: string, tenant: string, title = 'Cloud Architect') =>
      job({ id, companyId: id, title, locationRaw: 'Austin, TX', applyUrl: `https://${tenant}.wd1.myworkdayjobs.com/External/job/Austin/x_R1` })
    expect(duplicateJobIdsToExpire([wd('a', 'acme'), wd('b', 'globex'), wd('c', 'acme', 'Data Architect')])).toEqual([])
  })
})

describe('atsTenantKey', () => {
  it('names the employer account on subdomain and path based platforms', () => {
    expect(atsTenantKey('https://gdit.wd5.myworkdayjobs.com/GDIT_Empl_Ref/job/x')).toBe('myworkdayjobs.com:gdit')
    expect(atsTenantKey('https://gdit.wd1.myworkdayjobs.com/External/job/x')).toBe('myworkdayjobs.com:gdit')
    expect(atsTenantKey('https://jobs.ashbyhq.com/iwoca.co.uk/e00f2ee1')).toBe('jobs.ashbyhq.com:iwoca.co.uk')
    expect(atsTenantKey('https://job-boards.greenhouse.io/Stripe/jobs/1')).toBe('boards.greenhouse.io:stripe')
    expect(atsTenantKey('https://boards.greenhouse.io/stripe/jobs/2')).toBe('boards.greenhouse.io:stripe')
  })

  it('returns null for job boards, other sites and bad links', () => {
    expect(atsTenantKey('https://www.adzuna.co.uk/jobs/details/5957977760')).toBeNull()
    expect(atsTenantKey('https://careers.example.com/jobs/1')).toBeNull()
    expect(atsTenantKey('not a url')).toBeNull()
    expect(atsTenantKey(null)).toBeNull()
  })
})
