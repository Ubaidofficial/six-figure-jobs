const findMany = jest.fn()
const count = jest.fn()
jest.mock('../../lib/prisma', () => ({ prisma: { job: { findMany: (...a: unknown[]) => findMany(...a), count: (...a: unknown[]) => count(...a) } } }))

import { GET } from '../../app/api/company/[slug]/jobs/route'
import { __clearMemoForTests } from '../../lib/cache/memo'
import { buildJobSlugHref } from '../../lib/jobs/jobSlug'
import { publicJobId } from '../../lib/jobs/publicJob'
import { buildCompanyJobsWhere, newestFirst } from '../../lib/companies/companyJobs'

const job = (id: string, postedAt: string | null = '2026-11-01T00:00:00Z', createdAt = '2026-11-01T00:00:00Z') => ({
  id, title: `Job ${id}`, minAnnual: BigInt(150_000), maxAnnual: BigInt(190_000), postedAt: postedAt ? new Date(postedAt) : null, createdAt: new Date(createdAt),
})
/** The ids-and-dates read answers with `jobs`; the rows read answers with the jobs whose ids it asks for. */
const answerWith = (jobs: ReturnType<typeof job>[]) =>
  findMany.mockImplementation(async (args: { where?: { id?: { in: string[] } } }) =>
    args.where?.id?.in ? jobs.filter((j) => args.where!.id!.in.includes(j.id)) : jobs,
  )
const rowsCalls = () => findMany.mock.calls.filter(([a]) => (a as { where?: { id?: unknown } }).where?.id)

const call = async (slug: string, query = '') => {
  const res = await GET(new Request(`https://www.6figjobs.com/api/company/${encodeURIComponent(slug)}/jobs${query}`, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/130.0 Safari/537.36', 'sec-fetch-site': 'same-origin' } }), { params: Promise.resolve({ slug }) })
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
    answerWith([job('a'), job('b')])
  })

  afterEach(() => jest.useRealTimers())

  it('uses the company page filter, newest first, ten per page', async () => {
    // 37 jobs; job j00 is the newest. Page 3 is jobs 21-30 in that order.
    const jobs = Array.from({ length: 37 }, (_, i) => job(`j${String(i).padStart(2, '0')}`, new Date(Date.UTC(2026, 10, 5) - i * 3_600_000).toISOString()))
    answerWith([...jobs].reverse())
    const { body } = await call('acme', '?page=3')
    const where = buildCompanyJobsWhere('acme')
    expect(findMany.mock.calls[0][0]).toEqual({ where, select: { id: true, postedAt: true, createdAt: true } })
    expect(body).toMatchObject({ total: 37, page: 3, totalPages: 4 })
    expect(body.jobs.map((j: { title: string }) => j.title)).toEqual(Array.from({ length: 10 }, (_, i) => `Job j${20 + i}`))
    // The filter is the shared public-job filter scoped to this company.
    expect(JSON.stringify(where, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))).toContain('"slug":"acme"')
  })

  it('defaults to page 1 and answers with jobs, total and paging, salary as numbers', async () => {
    const { status, body, cache } = await call('acme')
    expect(status).toBe(200)
    expect(body).toMatchObject({ total: 2, page: 1, pageSize: 10, totalPages: 1 })
    expect(body.jobs).toHaveLength(2)
    // Public id and link only (lib/jobs/publicJob.ts): the internal id never leaves the server.
    expect(body.jobs[0]).toMatchObject({ id: publicJobId('a'), href: buildJobSlugHref({ id: 'a', title: 'Job a' }), maxAnnual: 190000, minAnnual: 150000 })
    expect(cache).toContain('s-maxage=300')
  })

  it('ignores a page size in the query: the size cannot be raised', async () => {
    answerWith(Array.from({ length: 30 }, (_, i) => job(`j${i}`)))
    const { body } = await call('acme', '?page=2&pageSize=500&limit=500&take=500')
    expect(body.jobs).toHaveLength(10)
    expect((rowsCalls()[0][0] as { where: { id: { in: string[] } } }).where.id.in).toHaveLength(10)
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
    await call('acme', '?page=1')
    const calls = findMany.mock.calls.length
    await call('acme', '?page=1')
    expect(findMany).toHaveBeenCalledTimes(calls)
  })

  it('answers 502 without caching when the database fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    findMany.mockRejectedValueOnce(new Error('db down'))
    const { status, cache } = await call('acme', '?page=2')
    expect(status).toBe(502)
    expect(cache).toBe('no-store')
    spy.mockRestore()
  })

  it('newestFirst: by posting date, else the date added, then id', () => {
    const order = newestFirst([
      job('old', '2026-10-28T00:00:00Z'),
      job('undated-new', null, '2026-11-05T00:00:00Z'),
      job('b', '2026-11-04T00:00:00Z'),
      job('a', '2026-11-04T00:00:00Z'),
      job('posted-old-added-new', '2026-10-30T00:00:00Z', '2026-11-05T12:00:00Z'),
    ]).map((j) => j.id)
    expect(order).toEqual(['undated-new', 'a', 'b', 'posted-old-added-new', 'old'])
  })
})
