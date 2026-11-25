/**
 * @jest-environment node
 */
// Oracle Recruiting Cloud and Gem readers (lib/scrapers/ats/oraclecloud.ts, gem.ts; 2026-11-25, remote100k coverage).
import { mapGemPost, parseGemBoard, scrapeGemResult, workplaceFromGem } from '../../lib/scrapers/ats/gem'
import { mapOracleJob, parseOracleBoard, scrapeOracleCloudResult, workplaceFromOracle } from '../../lib/scrapers/ats/oraclecloud'

const ORACLE = 'https://fa-eyau-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1'

describe('Oracle Recruiting Cloud', () => {
  it('reads host, site and language from a candidate-site URL', () => {
    expect(parseOracleBoard(`${ORACLE}/job/2046?ref=x`)).toEqual({ host: 'fa-eyau-saasfaprod1.fa.ocs.oraclecloud.com', lang: 'en', site: 'CX_1' })
    expect(parseOracleBoard('https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis')?.site).toBe('Jobs-at-Icertis')
    expect(parseOracleBoard('https://example.com/hcmUI/CandidateExperience/en/sites/CX_1')).toBeNull()
  })
  it('maps a job, with pay only from a pay sentence in the posting (Argano, live 2026-11-25)', () => {
    const job = mapOracleJob(parseOracleBoard(ORACLE)!, {
      Id: '2046',
      Title: 'Senior Manager, Solution & Account-Based Marketing',
      ExternalDescriptionStr: '<p>This is a fully remote, U.S.-based position with an annual salary range of $140,000- $160,000.</p>',
      PrimaryLocation: 'United States',
      PrimaryLocationCountry: 'US',
      WorkplaceTypeCode: 'ORA_REMOTE',
      ExternalPostedStartDate: '2026-11-13T21:02:21+00:00',
    })
    expect(job).toMatchObject({
      externalId: '2046', workplaceType: 'remote', remote: true, locationText: 'United States', salaryMin: 140000, salaryMax: 160000, salaryCurrency: 'USD', salaryInterval: 'year',
      url: `${ORACLE}/job/2046`,
    })
    expect(job.salaryRaw).toContain('annual salary range of $140,000- $160,000')
    expect(job.postedAt?.toISOString()).toBe('2026-11-13T21:02:21.000Z')
  })
  it('leaves pay empty when the posting states none, and knows the workplace codes', () => {
    expect(mapOracleJob(parseOracleBoard(ORACLE)!, { Id: '1', Title: 'Consultant', ExternalDescriptionStr: '<p>Great benefits.</p>' }).salaryMin).toBeNull()
    expect([workplaceFromOracle('ORA_HYBRID'), workplaceFromOracle('ORA_ON_SITE'), workplaceFromOracle(null)]).toEqual(['hybrid', 'onsite', null])
  })
  it('pages the list (with requisitionList expanded) and reads each job', async () => {
    const calls: string[] = []
    const fetchFn = (async (url: string) => {
      calls.push(url)
      const body = url.includes('recruitingCEJobRequisitions?')
        ? { items: [{ TotalJobsCount: 2, requisitionList: [{ Id: '1' }, { Id: '2' }] }] }
        : { items: [{ Id: decodeURIComponent(url).includes('Id="1"') ? '1' : '2', Title: 'Staff Engineer', ExternalDescriptionStr: '<p>x</p>' }] }
      return { ok: true, status: 200, json: async () => body }
    }) as unknown as typeof fetch
    const r = await scrapeOracleCloudResult(ORACLE, fetchFn)
    expect(r.success && r.jobs.map((j) => j.externalId).sort()).toEqual(['1', '2'])
    expect(calls[0]).toContain('expand=requisitionList&finder=findReqs;siteNumber=CX_1,limit=25,offset=0')
  })
})

describe('Gem', () => {
  it('reads the board from a jobs.gem.com URL', () => {
    expect(parseGemBoard('https://jobs.gem.com/linktree/am9icG9zdDpJgxk7?ref=remote100k')).toBe('linktree')
    expect(parseGemBoard('https://api.gem.com/job_board/v0/bigpanda/job_posts/')).toBe('bigpanda')
    expect(parseGemBoard('https://example.com/linktree')).toBeNull()
  })
  it('maps a post, with pay from the posting (Linktree, live 2026-11-25)', () => {
    const job = mapGemPost('linktree', {
      id: 'am9icG9zdDpJgxk7m2CvuLCl1rrJICCz',
      title: 'Staff Product Designer, Mobile',
      absolute_url: 'https://jobs.gem.com/linktree/am9icG9zdDpJgxk7m2CvuLCl1rrJICCz',
      content: '<p>Our cash compensation amount for this role is targeted at $200,000-$230,000 in the San Francisco Bay or Los Angeles area.</p>',
      location: { name: 'San Francisco, United States' },
      location_type: 'hybrid',
      employment_type: 'full_time',
      first_published_at: '2025-05-19T20:59:38.385Z',
    })
    expect(job).toMatchObject({ workplaceType: 'hybrid', salaryMin: 200000, salaryMax: 230000, salaryCurrency: 'USD', employmentType: 'full-time', locationText: 'San Francisco, United States' })
    expect(workplaceFromGem('remote')).toBe('remote')
  })
  it('reports a board that does not answer as a failure, not as no jobs', async () => {
    const fetchFn = (async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch
    expect(await scrapeGemResult('https://jobs.gem.com/nope', fetchFn)).toMatchObject({ success: false, error: 'HTTP 404' })
  })
})
