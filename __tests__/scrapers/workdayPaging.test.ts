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

// Chewy's vet-care postings (2026-11-09) say "$0.00 - $0.00" per hour and offer a 401k; the "401k" was read as a
// $401,000 salary, which put veterinary technicians at the top of the highest-paying jobs.
describe('scrapeWorkday salary text', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
  })

  const run = async (jobDescription: string) => {
    global.fetch = jest.fn(async (_url: any, init: any) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body)
        const jobPostings = body.offset === 0 ? [{ title: 'Vet Tech', externalPath: '/job/x/Vet_1' }] : []
        return new Response(JSON.stringify({ total: 1, jobPostings }), { status: 200 })
      }
      return new Response(JSON.stringify({ jobPostingInfo: { id: '1', title: 'Vet Tech', jobDescription, location: 'Plano, TX' } }), { status: 200 })
    }) as any
    const [job] = await scrapeWorkday('https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs')
    return job
  }

  it('does not read a retirement plan (401k, 401(k), 403(b)) as pay', async () => {
    const job = await run('<p>The hourly range for this role is $0.00 - $0.00. Benefits: medical, 401k with match, 403(b) and 457(b) plans.</p>')
    expect(job.salaryMin).toBeNull()
    expect(job.salaryMax).toBeNull()
  })

  it('still reads a real range next to a 401(k)', async () => {
    const job = await run('<p>The salary range for this role is $150,000 - $190,000 per year. We offer a 401(k) match.</p>')
    expect(job.salaryMin).toBe(150000)
    expect(job.salaryMax).toBe(190000)
  })
})
