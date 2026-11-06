const groupBy = jest.fn()
jest.mock('../../lib/prisma', () => ({ prisma: { job: { groupBy: (...a: unknown[]) => groupBy(...a) } } }))
jest.mock('../../lib/jobs/queryJobs', () => ({ buildWhere: () => ({ isExpired: false }) }))

import { GET } from '../../app/api/jobs/suggest/route'

const call = async (q?: string) => {
  const res = await GET(new Request(`https://www.6figjobs.com/api/jobs/suggest${q === undefined ? '' : `?q=${encodeURIComponent(q)}`}`))
  return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json() }
}

describe('GET /api/jobs/suggest', () => {
  beforeEach(() => {
    groupBy.mockReset()
    groupBy.mockResolvedValue([
      { roleSlug: 'seo-specialist', _count: { _all: 4 } },
      { roleSlug: 'senior-seo-specialist', _count: { _all: 3 } },
      { roleSlug: 'seo-manager', _count: { _all: 11 } },
      { roleSlug: 'software-engineer', _count: { _all: 500 } },
      { roleSlug: 'other', _count: { _all: 900 } },
    ])
  })

  it('answers with matching roles and their live job counts, seniority variants counted onto the base role', async () => {
    const { status, body, cache } = await call('seo')
    expect(status).toBe(200)
    expect(body.suggestions).toEqual([
      { slug: 'seo-manager', label: 'SEO Manager', count: 11 },
      { slug: 'seo-specialist', label: 'SEO Specialist', count: 7 },
    ])
    expect(cache).toContain('s-maxage=300')
  })

  it('groups the live jobs once and reuses the answer for later keystrokes', async () => {
    await call('so')
    await call('soft')
    expect(groupBy.mock.calls.length).toBeLessThanOrEqual(1) // the first test may already have filled the cache
  })

  it('suggests nothing for a missing or one-character query', async () => {
    expect((await call()).body.suggestions).toEqual([])
    expect((await call('s')).body.suggestions).toEqual([])
  })

  it('stays a 200 with no suggestions when the database fails, so the search box keeps working', async () => {
    jest.resetModules()
    const failing = jest.fn().mockRejectedValue(new Error('db down'))
    jest.doMock('../../lib/prisma', () => ({ prisma: { job: { groupBy: failing } } }))
    jest.doMock('../../lib/jobs/queryJobs', () => ({ buildWhere: () => ({}) }))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { GET: freshGet } = await import('../../app/api/jobs/suggest/route')
    const res = await freshGet(new Request('https://www.6figjobs.com/api/jobs/suggest?q=seo'))
    expect(res.status).toBe(200)
    expect((await res.json()).suggestions).toEqual([])
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
