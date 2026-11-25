import { scrapeWorkday, workplaceFromWorkday } from '../../lib/scrapers/ats/workday'

// Some Workday tenants publish each job's work arrangement as `remoteType` (values seen on 2026-11-25); the reader used
// to ignore it, so their jobs had no work mode unless the location text said "remote" (quality check
// `work_mode_not_stated`).
describe('workplaceFromWorkday', () => {
  it.each([
    ['Remote', 'remote'],
    ['Fully Remote', 'remote'],
    ['Work from Home', 'remote'],
    ['Hybrid', 'hybrid'],
    ['Flex', 'hybrid'],
    ['Office - Flexible', 'hybrid'],
    ['Partially Remote', 'hybrid'],
    ['Onsite', 'onsite'],
    ['On-site', 'onsite'],
    ['Fully Onsite', 'onsite'],
    ['Office', 'onsite'],
    ['Assigned Desk', 'onsite'],
    ['Non-Desk', 'onsite'],
  ])('%s -> %s', (value, mode) => {
    expect(workplaceFromWorkday(value)).toBe(mode)
  })

  it.each(['Field', 'Open to Remote', '', undefined, null, 'Something new'])('%p says nothing about where the work is done', (value) => {
    expect(workplaceFromWorkday(value as string | null | undefined)).toBeNull()
  })
})

describe('scrapeWorkday work mode', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
  })

  const run = async (info: Record<string, unknown>) => {
    global.fetch = jest.fn(async (_url: any, init: any) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body)
        const jobPostings = body.offset === 0 ? [{ title: 'Engineer', externalPath: '/job/x/Engineer_1' }] : []
        return new Response(JSON.stringify({ total: 1, jobPostings }), { status: 200 })
      }
      return new Response(JSON.stringify({ jobPostingInfo: { id: '1', title: 'Engineer', jobDescription: '<p>Build things.</p>', ...info } }), { status: 200 })
    }) as any
    const [job] = await scrapeWorkday('https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs')
    return job
  }

  it("takes the tenant's remoteType over the location text", async () => {
    const job = await run({ location: 'Remote - Texas', remoteType: 'Hybrid' })
    expect(job.workplaceType).toBe('hybrid')
    expect(job.remote).toBe(false)
  })

  it('marks a remoteType of Remote as remote', async () => {
    const job = await run({ location: 'Austin, TX', remoteType: 'Remote' })
    expect(job.workplaceType).toBe('remote')
    expect(job.remote).toBe(true)
  })

  it('keeps reading the location text when there is no remoteType', async () => {
    const job = await run({ location: 'Remote - Texas' })
    expect(job.workplaceType).toBeNull()
    expect(job.remote).toBe(true)
  })
})
