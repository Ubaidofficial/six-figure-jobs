const queryJobs = jest.fn()
jest.mock('../../lib/jobs/queryJobs', () => ({ queryJobs: (...a: unknown[]) => queryJobs(...a) }))

import { GET } from '../../app/api/jobs/suggest/route'

const job = (id: string, title: string, company: string, min: number, max: number) => ({
  id,
  title,
  company,
  currency: 'USD',
  minAnnual: BigInt(min),
  maxAnnual: BigInt(max),
  salaryPeriod: 'year',
})

const call = async (query: string) => {
  const res = await GET(new Request(`https://www.6figjobs.com/api/jobs/suggest?${query}`))
  return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json() }
}

describe('GET /api/jobs/suggest', () => {
  beforeEach(() => {
    queryJobs.mockReset()
    queryJobs.mockResolvedValue({
      total: 10,
      jobs: [job('board:freehire:a1', 'SEO/AEO Marketing Lead', 'Acme', 150_000, 190_000), job('board:freehire:a2', 'Staff Data Scientist, SEO & AEO', 'Globex', 200_000, 260_000)],
    })
  })

  it('answers with the best matches (title, company, pay, link) and the total', async () => {
    const { status, body, cache } = await call('q=seo-lead')
    expect(status).toBe(200)
    expect(body.total).toBe(10)
    expect(body.jobs).toHaveLength(2)
    expect(body.jobs[0]).toMatchObject({ title: 'SEO/AEO Marketing Lead', company: 'Acme' })
    expect(body.jobs[0].href).toMatch(/^\/job\/seo-aeo-marketing-lead-j-/)
    expect(body.jobs[0].pay).toMatch(/\$150/)
    expect(cache).toContain('s-maxage=300')
  })

  it('runs the same relevance-ranked keyword search the listing page uses, with a handful of results', async () => {
    await call('q=seo+manager')
    expect(queryJobs).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'seo manager', sortBy: 'relevant', page: 1, pageSize: 5 }))
  })

  it('passes along the salary and work arrangement chosen in the form, so the total matches the Search button', async () => {
    await call('q=devops&minSalary=200000&remoteMode=remote')
    expect(queryJobs).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'devops', minAnnual: 200000, remoteMode: 'remote' }))
  })

  it('ignores a salary or work arrangement it does not recognise', async () => {
    await call('q=sre&minSalary=banana&remoteMode=anywhere')
    const arg = queryJobs.mock.calls[0][0]
    expect(arg).not.toHaveProperty('minAnnual')
    expect(arg).not.toHaveProperty('remoteMode')
    queryJobs.mockClear()
    await call('q=sre2&minSalary=5&remoteMode=hybrid')
    expect(queryJobs.mock.calls[0][0]).not.toHaveProperty('minAnnual')
  })

  it('does not search for under two characters, and caps a very long query', async () => {
    expect((await call('q=s')).body).toEqual({ total: 0, jobs: [] })
    expect((await call('')).body).toEqual({ total: 0, jobs: [] })
    expect(queryJobs).not.toHaveBeenCalled()
    await call(`q=${'x'.repeat(200)}`)
    expect(queryJobs.mock.calls[0][0].keyword).toHaveLength(60)
  })

  it('answers the same question once for a while (visitors type the same prefixes)', async () => {
    await call('q=cachedquery')
    await call('q=CachedQuery')
    expect(queryJobs).toHaveBeenCalledTimes(1)
  })

  it('stays a 200 with no results when the search fails, so the box keeps working', async () => {
    queryJobs.mockRejectedValue(new Error('db down'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { status, body } = await call('q=failingquery')
    expect(status).toBe(200)
    expect(body).toEqual({ total: 0, jobs: [] })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
