const findMany = jest.fn()
const count = jest.fn()
jest.mock('../../lib/prisma', () => ({ prisma: { job: { findMany: (...a: unknown[]) => findMany(...a), count: (...a: unknown[]) => count(...a) } } }))

import { GET } from '../../app/api/company/[slug]/jobs/route'
import { __clearMemoForTests } from '../../lib/cache/memo'
import { buildJobSlugHref } from '../../lib/jobs/jobSlug'
import { publicJobId } from '../../lib/jobs/publicJob'
import { buildCompanyJobsWhere, COMPANY_JOBS_ORDER_BY } from '../../lib/companies/companyJobs'

const job = (id: string) => ({ id, title: `Job ${id}`, minAnnual: BigInt(150_000), maxAnnual: BigInt(190_000), createdAt: new Date('2026-11-01T00:00:00Z') })

const call = async (slug: string, query = '') => {
  const res = await GET(new Request(`https://www.6figjobs.com/api/company/${encodeURIComponent(slug)}/jobs${query}`), { params: Promise.resolve({ slug }) })
  return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json() }
}

describe('GET /api/company/[slug]/jobs', () => {
  // The freshness cut-off in the filter is "now minus 45 days", so freeze the clock (Date only) to compare filters.
  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date('2026-11-06T12:00:00Z'),
      doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    })
    __clearMemoForTests()
    findMany.mockReset()
    count.mockReset()
    count.mockResolvedValue(37)
    findMany.mockResolvedValue([job('a'), job('b')])
  })

  afterEach(() => jest.useRealTimers())

  it('uses the same filter and order as the company page, ten per page', async () => {
    await call('acme', '?page=3')
    const where = buildCompanyJobsWhere('acme')
    expect(count).toHaveBeenCalledWith({ where })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where, orderBy: COMPANY_JOBS_ORDER_BY, skip: 20, take: 10 }))
    // The filter is the shared public-job filter scoped to this company.
    expect(JSON.stringify(where, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))).toContain('"slug":"acme"')
  })

  it('defaults to page 1 and answers with jobs, total and paging, salary as numbers', async () => {
    const { status, body, cache } = await call('acme')
    expect(status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }))
    expect(body).toMatchObject({ total: 37, page: 1, pageSize: 10, totalPages: 4 })
    expect(body.jobs).toHaveLength(2)
    // Public id and link only (lib/jobs/publicJob.ts): the internal id never leaves the server.
    expect(body.jobs[0]).toMatchObject({ id: publicJobId('a'), href: buildJobSlugHref({ id: 'a', title: 'Job a' }), maxAnnual: 190000, minAnnual: 150000 })
    expect(cache).toContain('s-maxage=300')
  })

  it('ignores a page size in the query: the size cannot be raised', async () => {
    await call('acme', '?page=2&pageSize=500&limit=500&take=500')
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }))
  })

  it.each(['0', '-2', 'abc', '2.5', '1001', '', '2;drop'])('rejects page=%p with 400 and no query', async (page) => {
    const { status } = await call('acme', `?page=${encodeURIComponent(page)}`)
    expect(status).toBe(400)
    expect(findMany).not.toHaveBeenCalled()
  })

  it.each(['Acme Corp', 'acme/../x', 'ACME', '-acme', 'a'.repeat(151)])('rejects the slug %p', async (slug) => {
    const { status } = await call(slug, '')
    expect(status).toBe(400)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('caches an answer in process', async () => {
    await call('acme', '?page=2')
    await call('acme', '?page=2')
    expect(findMany).toHaveBeenCalledTimes(1)
  })

  it('answers 502 without caching when the database fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    findMany.mockRejectedValueOnce(new Error('db down'))
    const { status, cache } = await call('acme', '?page=2')
    expect(status).toBe(502)
    expect(cache).toBe('no-store')
    spy.mockRestore()
  })
})
