import axios from 'axios'

import {
  checkClosedFreehireJobs,
  lookupFreehireJob,
  resolveFreehireSlug,
  upgradedDescription,
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

const applyRefresh = jest.fn()

const run = (active: ActiveJob[], lookups: Record<string, Lookup>, extra: object = {}) =>
  checkClosedFreehireJobs({
    paceMs: 0,
    applyRefresh,
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
    expect(await lookupFreehireJob('b')).toEqual({ state: 'open', description: null, reality: null })
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

describe('lookup cap (the daily freehire quota)', () => {
  beforeEach(() => {
    applyRefresh.mockReset()
    expireJobsByIds.mockReset()
    expireJobsByIds.mockImplementation(async (ids: string[]) => ({ expired: ids.length }))
  })
  const fresh = { class: 'fresh', age_days: 1, fake_freshness: false }
  const day = 24 * 3600 * 1000
  // job 0 refreshed 1 day ago, job 1 two days ago, ... job 9 ten days ago; listed newest first on purpose.
  const aged = Array.from({ length: 10 }, (_, n) => ({ ...job(n), updatedAt: new Date(Date.now() - (n + 1) * day) }))

  it('looks up only maxLookups jobs, the least recently refreshed first, and says how many wait', async () => {
    const looked: string[] = []
    const r = await run(aged, {}, { maxLookups: 3, lookup: async (slug: string) => (looked.push(slug), { state: 'open', reality: fresh }) })
    expect(looked.sort()).toEqual(['slug-7', 'slug-8', 'slug-9'])
    expect(r).toMatchObject({ checked: 3, deferred: 7, open: 3, status: 'ok' })
  })

  it('refreshes only the jobs it looked at, so the next run moves on to the next ones', async () => {
    await run(aged, {}, { maxLookups: 3, lookup: async () => ({ state: 'open', reality: fresh }) })
    expect(applyRefresh.mock.calls[0][0].keepAliveIds.sort()).toEqual(['job-7', 'job-8', 'job-9'])
  })

  it('treats a job with no updatedAt as the oldest', async () => {
    const withUnknown = [...aged, { ...job(10), updatedAt: null }]
    const looked: string[] = []
    await run(withUnknown, {}, { maxLookups: 1, lookup: async (slug: string) => (looked.push(slug), { state: 'open', reality: fresh }) })
    expect(looked).toEqual(['slug-10'])
  })

  it('looks up every job when there is no cap, or the cap is at least the number of jobs', async () => {
    expect(await run(aged, {})).toMatchObject({ checked: 10, deferred: 0 })
    expect(await run(aged, {}, { maxLookups: 10 })).toMatchObject({ checked: 10, deferred: 0 })
    expect(await run(aged, {}, { maxLookups: 500 })).toMatchObject({ checked: 10, deferred: 0 })
  })

  it('does not count jobs it cannot identify as deferred, and judges closures only among the jobs it looked at', async () => {
    const withUnidentified = [...aged, { ...job(11, null), externalId: null, updatedAt: new Date(0) }]
    const r = await run(withUnidentified, { 'slug-9': { state: 'closed', closedAt: 'x' } }, { maxLookups: 2 })
    expect(r).toMatchObject({ unresolved: 1, deferred: 8, checked: 2 })
    expect(r.closed.map((j) => j.id)).toEqual(['job-9'])
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

describe('keeping open jobs alive and upgrading truncated descriptions', () => {
  const full = `<p>${'Full description with the qualifications. '.repeat(40)}</p>`
  const preview = '<p>Short preview cut at about a thousand characters. The team are seeking an</p>'
  const fresh = { class: 'fresh', age_days: 3, fake_freshness: false }

  beforeEach(() => applyRefresh.mockReset())

  it('refreshes jobs freehire still lists as fresh, and replaces a truncated description with the full one', async () => {
    const active = [{ ...job(1), descriptionHtml: preview }, { ...job(2), descriptionHtml: full }]
    const r = await run(active, {
      'slug-1': { state: 'open', description: full, reality: fresh },
      'slug-2': { state: 'open', description: full, reality: fresh },
    })
    expect(applyRefresh).toHaveBeenCalledTimes(1)
    const arg = applyRefresh.mock.calls[0][0]
    expect(arg.keepAliveIds).toEqual(['job-1', 'job-2'])
    expect(arg.descriptions).toHaveLength(1) // job 2 already has the full text
    expect(arg.descriptions[0].id).toBe('job-1')
    expect(r).toMatchObject({ refreshed: 2, descriptionsUpgraded: 1, status: 'ok' })
  })

  it('lets jobs freehire flags as re-stamped, or stale beyond 30 days, run into the 7-day expiry', async () => {
    const r = await run([job(1), job(2), job(3), job(4)], {
      'slug-1': { state: 'open', reality: { class: 'stale', age_days: 120, fake_freshness: true } },
      'slug-2': { state: 'open', reality: { class: 'stale', age_days: 45, fake_freshness: false } },
      'slug-3': { state: 'open', reality: { class: 'stale', age_days: 20, fake_freshness: false } },
      'slug-4': { state: 'open', reality: null },
    })
    expect(applyRefresh.mock.calls[0][0].keepAliveIds).toEqual(['job-3', 'job-4'])
    expect(r.refreshed).toBe(2)
  })

  it('does not refresh closed or unreadable jobs', async () => {
    await run([job(1), job(2)], { 'slug-1': { state: 'closed', closedAt: '2026-11-04T00:00:00Z' }, 'slug-2': { state: 'error', message: 'x' } })
    expect(applyRefresh.mock.calls[0][0].keepAliveIds).toEqual([])
  })

  it('writes nothing in a dry run', async () => {
    const r = await run([{ ...job(1), descriptionHtml: preview }], { 'slug-1': { state: 'open', description: full, reality: fresh } }, { dryRun: true })
    expect(applyRefresh).not.toHaveBeenCalled()
    expect(r).toMatchObject({ refreshed: 0, descriptionsUpgraded: 0 })
  })

  it('upgradedDescription only accepts a clearly fuller, clean text', () => {
    expect(upgradedDescription(preview, full)).toContain('Full description')
    expect(upgradedDescription(full, preview)).toBeNull()
    expect(upgradedDescription(preview, null)).toBeNull()
    expect(upgradedDescription(preview, '<p>Meet JobCopilot. Stop applying. ' + 'x'.repeat(600) + '</p>')).toBeNull()
  })
})
