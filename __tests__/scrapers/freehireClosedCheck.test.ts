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
    const r = await run(old, { 'found-1': { state: 'closed', closedAt: 'x' } }, {
      resolve: async (_t: string, ext: string) => (ext === 'ext-1' ? 'found-1' : null),
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
