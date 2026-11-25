import { normalizeTitle, normalizeTitleForMatch } from '../../lib/ingest/dedupeHelpers'
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

  it('treats a title with a gender note, "(m/f/d)", and the same title without one as one opening', () => {
    const plain = job({ id: 'plain', title: 'Senior Backend Engineer', locationRaw: 'Berlin', applyUrl: 'https://jobs.lever.co/acme/1' })
    const noted = job({ id: 'noted', title: 'Senior Backend Engineer (m/f/d)', locationRaw: 'Berlin', applyUrl: 'https://www.adzuna.de/details/2', postedAt: new Date('2026-11-08T00:00:00Z') })
    expect(duplicateJobIdsToExpire([plain, noted])).toEqual(['noted'])
    const wmx = job({ id: 'wmx', title: 'Senior Backend Engineer [w/m/x]', locationRaw: 'Berlin', applyUrl: 'https://www.adzuna.de/details/3' })
    expect(duplicateJobIdsToExpire([plain, wmx])).toEqual(['wmx'])
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

describe('normalizeTitleForMatch', () => {
  it('drops gender notes but nothing that defines the role', () => {
    expect(normalizeTitleForMatch('Product Manager (m/f/d)')).toBe('product manager')
    expect(normalizeTitleForMatch('Product Manager (all genders)')).toBe('product manager')
    expect(normalizeTitleForMatch('Product Manager m/w/d')).toBe('product manager')
    expect(normalizeTitleForMatch('Senior Product Manager (I/O Platform)')).toBe('senior product manager i o platform')
  })

  it('leaves the stored dedupe key alone', () => {
    expect(normalizeTitle('Product Manager (m/f/d)')).toBe('product manager m f d')
  })
})

// 2026-11-25: Chainguard had two open Greenhouse postings with one title in one place (4716831006 and 4727461006); this
// step expired one of them every day. Different employer posting ids are different openings.
describe('duplicateJobIdsToExpire: same title, different postings', () => {
  const at = (iso: string) => new Date(iso)
  it('keeps two employer postings with different ids', () => {
    const a = job({ id: 'a', companyId: 'cg', title: 'Staff Software Engineer, Chainguard Harness', locationRaw: 'Remote', applyUrl: 'https://job-boards.greenhouse.io/chainguard/jobs/4716831006' })
    const b = job({ id: 'b', companyId: 'cg', title: 'Staff Software Engineer, Chainguard Harness', locationRaw: 'Remote', applyUrl: 'https://job-boards.greenhouse.io/chainguard/jobs/4727461006', postedAt: at('2026-11-08T00:00:00Z') })
    expect(duplicateJobIdsToExpire([a, b])).toEqual([])
  })
  it('still drops a board re-post, and a second copy of one posting, when there are two postings', () => {
    const a = job({ id: 'a', applyUrl: 'https://job-boards.greenhouse.io/acme/jobs/1111111' })
    const a2 = job({ id: 'a-again', applyUrl: 'https://acme.com/careers/x?gh_jid=1111111', postedAt: at('2026-11-01T00:00:00Z') })
    const b = job({ id: 'b', applyUrl: 'https://job-boards.greenhouse.io/acme/jobs/2222222' })
    const board = job({ id: 'board', applyUrl: 'https://www.adzuna.co.uk/jobs/details/5957977760' })
    expect(duplicateJobIdsToExpire([board, a2, a, b]).sort()).toEqual(['a-again', 'board'])
  })
  it('one posting shown on two career sites of one Workday tenant is still one opening (GDIT, 2026-11-09)', () => {
    const ext = job({ id: 'ext', companyId: 'c1', title: 'Senior System Administrator', locationRaw: 'Fort Meade, MD', applyUrl: 'https://gdit.wd5.myworkdayjobs.com/External_Career_Site/job/Fort-Meade/Senior-System-Administrator_RQ212345' })
    const ref = job({ id: 'ref', companyId: 'c2', title: 'Senior System Administrator', locationRaw: 'Fort Meade, MD', applyUrl: 'https://gdit.wd5.myworkdayjobs.com/GDIT_Empl_Ref/job/Fort-Meade/Senior-System-Administrator_RQ212345' })
    expect(duplicateJobIdsToExpire([ext, ref])).toEqual(['ref'])
  })
  it('reads posting ids from the usual places', () => {
    const { atsPostingId } = jest.requireActual('../../lib/jobs/crossSourceDuplicates')
    expect(atsPostingId('https://boards.greenhouse.io/acme/jobs/4716831006')).toBe('greenhouse:4716831006')
    expect(atsPostingId('https://www.hubspot.com/careers/jobs/8397522?gh_jid=8397522')).toBe('greenhouse:8397522')
    expect(atsPostingId('https://jobs.ashbyhq.com/webflow/4078c63c-4251-4c85-9615-851a0956ec51')).toBe('uuid:4078c63c-4251-4c85-9615-851a0956ec51')
    expect(atsPostingId('https://abbott.wd5.myworkdayjobs.com/abbottcareers/job/Remote/Sr-Manager_R123456')).toBe('workday:R123456')
    expect(atsPostingId('https://www.adzuna.co.uk/jobs/details/5957977760')).toBeNull()
  })
})
