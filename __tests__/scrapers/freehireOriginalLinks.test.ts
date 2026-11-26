import axios from 'axios'
import { collectFreehireJobs, type FreehireJob } from '../../lib/scrapers/freehire'

jest.mock('axios')
const get = axios.get as jest.Mock

// Since 2026-11-25 freehire's public reads leave `url` empty when `apply_url` (a freehire redirect) is set; the employer's
// own link comes only from the API plan's /data/jobs/{slug}.
const rec = (i: number, extra: Partial<FreehireJob> = {}): FreehireJob => ({
  public_slug: `slug-${i}`,
  external_id: `ext-${i}`,
  url: '',
  title: `Job ${i}`,
  posted_at: new Date(Date.now() - 3_600_000).toISOString(),
  closed_at: null,
  reality: { class: 'fresh', fake_freshness: false },
  enrichment: { salary_min: 200000, salary_currency: 'USD', salary_period: 'year' },
  ...extra,
})
const search = (jobs: FreehireJob[]) => ({ data: { data: jobs, meta: { total: jobs.length, limit: 100, offset: 0 } } })
const since = new Date(Date.now() - 48 * 3_600_000)

async function withImmediateTimers<T>(fn: () => Promise<T>): Promise<T> {
  const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
    cb()
    return 0
  }) as unknown as typeof setTimeout)
  try {
    return await fn()
  } finally {
    spy.mockRestore()
  }
}

describe('freehire employer links from /data/jobs', () => {
  beforeEach(() => get.mockReset())

  it('reads the link for each job it would publish, once, and lists the job under the employer link', async () => {
    const jobs = [rec(1), rec(2, { closed_at: '2026-11-20T00:00:00Z' }), rec(3, { url: 'https://boards.greenhouse.io/acme/jobs/3?utm_source=freehire.me' })]
    get.mockImplementation(async (url: string) => {
      if (url.includes('/data/jobs/')) return { data: { data: { url: 'https://jobs.ashbyhq.com/acme/1?utm_source=freehire.me' } } }
      return search(jobs)
    })
    const r = await withImmediateTimers(() => collectFreehireJobs({ since, withDescriptionPay: false }))
    const dataCalls = get.mock.calls.map((c) => c[0] as string).filter((u) => u.includes('/data/jobs/'))
    // Only job 1: job 2 is closed (not published) and job 3 still carries its link. Read once although every market returns it.
    expect(dataCalls).toEqual(['https://freehire.me/api/v1/data/jobs/slug-1'])
    const byId = new Map(r.inputs.map((i) => [i.externalId, i]))
    expect(byId.get('ext-1')?.applyUrl).toBe('https://jobs.ashbyhq.com/acme/1')
    expect(byId.get('ext-3')?.applyUrl).toBe('https://boards.greenhouse.io/acme/jobs/3')
    expect(byId.has('ext-2')).toBe(false)
  })

  it('never lists a job under the freehire redirect when /data/jobs has no link for it', async () => {
    get.mockImplementation(async (url: string) => {
      if (url.includes('/data/jobs/')) throw Object.assign(new Error('404'), { response: { status: 404 } })
      return search([rec(1, { apply_url: 'https://freehire.me/api/v1/go/slug-1?src=web' } as Partial<FreehireJob>)])
    })
    const r = await withImmediateTimers(() => collectFreehireJobs({ since, withDescriptionPay: false }))
    expect(r.inputs).toEqual([])
    expect(r.errors).toEqual([])
  })

  it('reports an error, not an empty run, when the key cannot read /data/jobs', async () => {
    get.mockImplementation(async (url: string) => {
      if (url.includes('/data/jobs/')) throw Object.assign(new Error('401'), { response: { status: 401 } })
      return search([rec(1)])
    })
    const r = await withImmediateTimers(() => collectFreehireJobs({ since, withDescriptionPay: false }))
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0]).toMatch(/FREEHIRE_API_KEY/)
  })
})

describe('job-board links on freehire jobs', () => {
  beforeEach(() => get.mockReset())

  it('lists the job under the employer link when another source has the same posting, and keeps the board link when none does', async () => {
    const jobs = [rec(1), rec(2)]
    get.mockImplementation(async (url: string) => {
      if (url.endsWith('/data/jobs/slug-1')) return { data: { data: { url: 'https://www.linkedin.com/jobs/view/1' } } }
      if (url.endsWith('/data/jobs/slug-2')) return { data: { data: { url: 'https://www.whatjobs.com/job/2' } } }
      if (url.endsWith('/jobs/slug-1/copies')) return { data: { data: [{ public_slug: 'copy-1' }] } }
      if (url.endsWith('/data/jobs/copy-1')) return { data: { data: { url: 'https://acme.wd5.myworkdayjobs.com/External/job/R1' } } }
      if (url.includes('/copies')) return { data: { data: [] } }
      return search(jobs)
    })
    const r = await withImmediateTimers(() => collectFreehireJobs({ since, withDescriptionPay: false }))
    const byId = new Map(r.inputs.map((i) => [i.externalId, i]))
    expect(byId.get('ext-1')?.applyUrl).toBe('https://acme.wd5.myworkdayjobs.com/External/job/R1')
    expect(byId.get('ext-2')?.applyUrl).toBe('https://www.whatjobs.com/job/2')
    expect(r.markets[0].directLinks).toBe(1)
  })
})
