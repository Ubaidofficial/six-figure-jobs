import { scrapeWorkday } from '../../lib/scrapers/ats/workday'

// Workday's job search (checked on zoom.wd5, 2026-11-09): 400 above 20 per page, and the real total on the first page
// only, `total: 0` after it. The scraper asked for 100 per page, so every Workday board failed.
describe('scrapeWorkday paging', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
  })

  it('asks for at most 20 a page and reads every page although later pages report total 0', async () => {
    const limits: number[] = []
    global.fetch = jest.fn(async (url: any, init: any) => {
      const u = String(url)
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body)
        limits.push(body.limit)
        if (body.limit > 20) return new Response('bad', { status: 400 })
        const all = 45
        const n = Math.max(0, Math.min(body.limit, all - body.offset))
        const jobPostings = Array.from({ length: n }, (_, i) => ({ title: `Job ${body.offset + i}`, externalPath: `/job/x/Job_${body.offset + i}` }))
        return new Response(JSON.stringify({ total: body.offset === 0 ? all : 0, jobPostings }), { status: 200 })
      }
      const id = u.split('Job_')[1]
      return new Response(JSON.stringify({ jobPostingInfo: { id, title: `Job ${id}`, jobDescription: '<p>Pay $150,000 - $200,000</p>', location: 'Remote, US' } }), { status: 200 })
    }) as any

    const jobs = await scrapeWorkday('https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs')
    expect(Math.max(...limits)).toBeLessThanOrEqual(20)
    expect(jobs).toHaveLength(45)
    // Requisition numbers repeat across employers; the id carries the Workday tenant.
    expect(jobs[0].externalId).toBe('acme:0')
  })
})
