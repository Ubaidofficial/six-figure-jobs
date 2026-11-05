import {
  reconcileClosedFreehireJobs,
  selectClosedJobs,
  type ActiveJob,
} from '../../lib/scrapers/freehireReconcile'
import type { FreehireCollected } from '../../lib/scrapers/freehire'

const findMany = jest.fn()
const expireJobsByIds = jest.fn()

jest.mock('../../lib/prisma', () => ({ prisma: { job: { findMany: (...a: unknown[]) => findMany(...a) } } }))
jest.mock('../../lib/jobs/expiry', () => ({ expireJobsByIds: (...a: unknown[]) => expireJobsByIds(...a) }))
jest.mock('../../lib/scrapers/freehire', () => ({ collectFreehireJobs: jest.fn() }))

const NOW = new Date('2026-11-10T12:00:00.000Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000)
const job = (id: string, ext: string | null, postedDaysAgo: number | null): ActiveJob => ({
  id,
  title: `Job ${id}`,
  externalId: ext,
  postedAt: postedDaysAgo == null ? null : daysAgo(postedDaysAgo),
})

function collected(openIds: string[], overrides: Partial<FreehireCollected> = {}, complete = true): FreehireCollected {
  return {
    inputs: openIds.map((externalId) => ({ externalId }) as any),
    markets: [{ currency: 'USD', available: 0, fetched: 0, mappable: 0, gateRejected: 0, oldest: null, newest: null, sample: [], complete }],
    errors: [],
    unmappable: 0,
    ...overrides,
  }
}

describe('selectClosedJobs', () => {
  const judgeFrom = daysAgo(7)

  it('returns active jobs posted inside the window that are not in the open set', () => {
    const active = [job('a', 'x1', 2), job('b', 'x2', 3)]
    expect(selectClosedJobs(active, new Set(['x1']), judgeFrom).map((j) => j.id)).toEqual(['b'])
  })

  it('never judges jobs older than the window: their absence only means they fell out of the fetched range', () => {
    expect(selectClosedJobs([job('old', 'x9', 9)], new Set(), judgeFrom)).toEqual([])
  })

  it('never judges jobs without an external id or a posted date', () => {
    expect(selectClosedJobs([job('n1', null, 1), job('n2', 'x', null)], new Set(), judgeFrom)).toEqual([])
  })
})

describe('reconcileClosedFreehireJobs', () => {
  beforeEach(() => {
    findMany.mockReset()
    expireJobsByIds.mockReset()
    expireJobsByIds.mockImplementation(async (ids: string[]) => ({ expired: ids.length }))
  })

  const run = (c: FreehireCollected, active: ActiveJob[], extra: object = {}) => {
    findMany.mockResolvedValue(active)
    return reconcileClosedFreehireJobs({ now: NOW, collect: async () => c, ...extra })
  }

  // 10 judged jobs, ids x0..x9
  const ten = Array.from({ length: 10 }, (_, i) => job(`j${i}`, `x${i}`, 2))

  it('expires jobs freehire no longer lists', async () => {
    const r = await run(collected(['x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8']), ten)
    expect(r.status).toBe('ok')
    expect(r.closed.map((j) => j.id)).toEqual(['j9'])
    expect(expireJobsByIds).toHaveBeenCalledWith(['j9'])
    expect(r.expired).toBe(1)
  })

  it('dry run reports but writes nothing', async () => {
    const r = await run(collected(['x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8']), ten, { dryRun: true })
    expect(r.closed).toHaveLength(1)
    expect(expireJobsByIds).not.toHaveBeenCalled()
  })

  it('skips when a market failed', async () => {
    const r = await run(collected(['x0'], { errors: ['USD: 429'] }), ten)
    expect(r.status).toBe('skipped')
    expect(expireJobsByIds).not.toHaveBeenCalled()
  })

  it('skips when a market did not reach the end of the window (paging cap)', async () => {
    const r = await run(collected(['x0'], {}, false), ten)
    expect(r.status).toBe('skipped')
    expect(r.reason).toMatch(/USD/)
    expect(findMany).not.toHaveBeenCalled()
    expect(expireJobsByIds).not.toHaveBeenCalled()
  })

  it('skips when freehire returns no open jobs instead of expiring everything', async () => {
    const r = await run(collected([]), ten)
    expect(r.status).toBe('skipped')
    expect(expireJobsByIds).not.toHaveBeenCalled()
  })

  it('aborts when the share to expire is implausibly large', async () => {
    const r = await run(collected(['x0', 'x1', 'x2', 'x3']), ten) // 6 of 10 = 60% > 40%
    expect(r.status).toBe('aborted')
    expect(r.reason).toMatch(/60%/)
    expect(expireJobsByIds).not.toHaveBeenCalled()
  })

  it('does nothing when every judged job is still open', async () => {
    const r = await run(collected(ten.map((j) => j.externalId as string)), ten)
    expect(r.status).toBe('ok')
    expect(r.closed).toHaveLength(0)
    expect(expireJobsByIds).not.toHaveBeenCalled()
  })
})
