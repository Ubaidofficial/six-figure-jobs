import axios from 'axios'

import {
  checkClosedFreehireJobs,
  lookupFreehireJob,
  resolveFreehireSlug,
  type ActiveJob,
  type Lookup,
} from '../../lib/scrapers/freehireClosedCheck'

const expireJobsByIds = jest.fn()
jest.mock('axios')
jest.mock('../../lib/prisma', () => ({ prisma: {} }))
jest.mock('../../lib/jobs/expiry', () => ({ expireJobsByIds: (...a: unknown[]) => expireJobsByIds(...a) }))

const get = axios.get as jest.Mock

const job = (n: number, sourceRef: string | null = `slug-${n}`): ActiveJob => ({
  id: `job-${n}`,
  title: `Job ${n}`,
  externalId: `ext-${n}`,
  sourceRef,
})

const run = (active: ActiveJob[], lookups: Record<string, Lookup>, extra: object = {}) =>
  checkClosedFreehireJobs({
    paceMs: 0,
    loadActive: async () => active,
    lookup: async (slug) => lookups[slug] ?? { state: 'open' },
    resolve: async () => null,
    saveSlug: async () => {},
    ...extra,
  })

describe('lookupFreehireJob', () => {
  beforeEach(() => get.mockReset())

  it('reports an error at once on a long rate limit instead of waiting hours (once Retry-After was 49611 s)', async () => {
    get.mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '49611' } } })
    const t0 = Date.now()
    expect(await lookupFreehireJob('a')).toEqual({ state: 'error', message: 'rate limited for 49611s' })
    expect(get).toHaveBeenCalledTimes(1)
    expect(Date.now() - t0).toBeLessThan(1000)
  })

  it('is closed only when freehire sets closed_at', async () => {
    get.mockResolvedValueOnce({ data: { data: { closed_at: '2026-11-04T10:00:00Z' } } })
    expect(await lookupFreehireJob('a')).toEqual({ state: 'closed', closedAt: '2026-11-04T10:00:00Z' })
    get.mockResolvedValueOnce({ data: { data: { closed_at: null } } })
    expect(await lookupFreehireJob('b')).toEqual({ state: 'open' })
  })

  it('treats 404 as "gone" (never as a closure) and other failures as errors', async () => {
    get.mockRejectedValueOnce({ response: { status: 404 } })
    expect(await lookupFreehireJob('c')).toEqual({ state: 'gone' })
    get.mockRejectedValueOnce(new Error('socket hang up'))
    expect((await lookupFreehireJob('d')).state).toBe('error')
  })

  it('url-encodes the slug', async () => {
    get.mockResolvedValueOnce({ data: { data: {} } })
    await lookupFreehireJob('a/b c')
    expect(get.mock.calls[0][0]).toContain('a%2Fb%20c')
  })
})

describe('resolveFreehireSlug', () => {
  beforeEach(() => get.mockReset())
  it('returns the slug of the result whose external_id matches, else null', async () => {
    get.mockResolvedValue({ data: { data: [{ public_slug: 'other', external_id: 'x' }, { public_slug: 'mine', external_id: 'ext-1' }] } })
    expect(await resolveFreehireSlug('Job 1', 'ext-1')).toBe('mine')
    expect(await resolveFreehireSlug('Job 1', 'ext-9')).toBeNull()
  })
  it('returns null when the search fails', async () => {
    get.mockRejectedValue(new Error('boom'))
    expect(await resolveFreehireSlug('Job 1', 'ext-1')).toBeNull()
  })
})

describe('checkClosedFreehireJobs', () => {
  beforeEach(() => {
    expireJobsByIds.mockReset()
    expireJobsByIds.mockImplementation(async (ids: string[]) => ({ expired: ids.length }))
  })
  const many = Array.from({ length: 20 }, (_, i) => job(i))

  it('expires exactly the jobs freehire marks closed', async () => {
    const r = await run(many, { 'slug-3': { state: 'closed', closedAt: 'x' } })
    expect(r.status).toBe('ok')
    expect(r.closed.map((j) => j.id)).toEqual(['job-3'])
    expect(expireJobsByIds).toHaveBeenCalledWith(['job-3'])
    expect(r.open).toBe(19)
  })

  it('keeps a job freehire reports closed if the open search still lists it', async () => {
    const r = await run(many, { 'slug-3': { state: 'closed', closedAt: 'x' }, 'slug-4': { state: 'closed', closedAt: 'x' } }, {
      resolve: async (_t: string, ext: string) => (ext === 'ext-3' ? 'slug-3-open' : null),
    })
    expect(r.conflicts.map((j) => j.id)).toEqual(['job-3'])
    expect(r.closed.map((j) => j.id)).toEqual(['job-4'])
    expect(expireJobsByIds).toHaveBeenCalledWith(['job-4'])
  })

  it('a dry run reports but expires nothing', async () => {
    const r = await run(many, { 'slug-3': { state: 'closed', closedAt: 'x' } }, { dryRun: true })
    expect(r.closed).toHaveLength(1)
    expect(expireJobsByIds).not.toHaveBeenCalled()
  })

  it('never expires because of a 404 or a failed lookup', async () => {
    const r = await run(many, { 'slug-1': { state: 'gone' }, 'slug-2': { state: 'error', message: 'x' } })
    expect(r.gone).toBe(1)
    expect(r.errors).toBe(1)
    expect(r.closed).toHaveLength(0)
    expect(expireJobsByIds).not.toHaveBeenCalled()
  })

  it('skips the whole run when too many lookups fail', async () => {
    const failing: Record<string, Lookup> = {}
    for (let i = 0; i < 5; i++) failing[`slug-${i}`] = { state: 'error', message: 'x' } // 25% > 5%
    failing['slug-9'] = { state: 'closed', closedAt: 'x' }
    const r = await run(many, failing)
    expect(r.status).toBe('skipped')
    expect(expireJobsByIds).not.toHaveBeenCalled()
  })

  it('aborts when the share to expire is implausibly large', async () => {
    const closed: Record<string, Lookup> = {}
    for (let i = 0; i < 10; i++) closed[`slug-${i}`] = { state: 'closed', closedAt: 'x' } // 50% > 40%
    const r = await run(many, closed)
    expect(r.status).toBe('aborted')
    expect(expireJobsByIds).not.toHaveBeenCalled()
  })

  it('looks up slugs for jobs imported before slugs were stored, saves them, and checks them', async () => {
    const saved: Array<[string, string]> = []
    const old = [job(1, null), job(2, null)]
    // First lookup (finding the slug) matches job-1 in the open search; the later "is it still listed?" check does not.
    let calls = 0
    const r = await run(old, { 'found-1': { state: 'closed', closedAt: 'x' } }, {
      resolve: async (_t: string, ext: string) => (ext === 'ext-1' && calls++ === 0 ? 'found-1' : null),
      saveSlug: async (id: string, slug: string) => void saved.push([id, slug]),
    })
    expect(saved).toEqual([['job-1', 'found-1']])
    expect(r.resolved).toBe(1)
    expect(r.unresolved).toBe(1) // job-2 has no slug and is simply not judged
    expect(r.closed.map((j) => j.id)).toEqual(['job-1'])
  })

  it('does not judge jobs it cannot identify at freehire', async () => {
    const r = await run([job(1, null)], {})
    expect(r.checked).toBe(0)
    expect(r.closed).toHaveLength(0)
  })
})

describe('time budget and progress', () => {
  beforeEach(() => expireJobsByIds.mockReset())
  const slow = (ms: number) => async () => {
    await new Promise((r) => setTimeout(r, ms))
    return { state: 'closed', closedAt: '2026-11-04T10:00:00Z' } as Lookup
  }

  it('stops when the budget is exceeded and expires nothing, even if jobs were reported closed', async () => {
    const active = Array.from({ length: 6 }, (_, i) => job(i + 1))
    const r = await checkClosedFreehireJobs({
      paceMs: 0,
      concurrency: 1,
      deadlineMs: 15,
      loadActive: async () => active,
      lookup: slow(10),
      resolve: async () => null,
      saveSlug: async () => {},
    })
    expect(r.status).toBe('skipped')
    expect(r.reason).toMatch(/time budget/)
    expect(r.expired).toBe(0)
    expect(expireJobsByIds).not.toHaveBeenCalled()
    expect(r.checked).toBe(6) // the whole list was due, but not all of it was looked at
  })

  it('reports progress so a stall is visible', async () => {
    const lines: string[] = []
    await run([job(1), job(2)], {}, { onProgress: (m: string) => lines.push(m) })
    expect(lines[0]).toMatch(/loaded 2 active freehire jobs/)
    expect(lines.some((l) => /checking 2 jobs/.test(l))).toBe(true)
    expect(lines.at(-1)).toMatch(/done: open 2/)
  })

  it('still runs normally with no budget', async () => {
    const r = await run([job(1), job(2), job(3), job(4), job(5)], { 'slug-1': { state: 'closed', closedAt: 'x' } }, { dryRun: true })
    expect(r.status).toBe('ok')
    expect(r.closed.map((j) => j.id)).toEqual(['job-1'])
  })
})
