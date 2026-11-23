const jobs = Array.from({ length: 20 }, (_, i) => ({ id: `job-${i}`, title: `Job ${i}`, externalId: `ext-${i}`, source: 'board:freehire', shortId: null }))

jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      findMany: jest.fn(async () => jobs),
      updateMany: jest.fn(async () => ({ count: jobs.length })),
    },
  },
}))
jest.mock('../../lib/seo/sitemapRevalidate', () => ({ triggerSitemapRevalidation: jest.fn(async () => {}) }))

import { NOTIFY_CONCURRENCY, expireJobsByIds, runExpiryCycle } from '../../lib/jobs/expiry'
import { resetJobIndexingNotifierForTests, setJobIndexingNotifierForTests } from '../../lib/jobs/indexingNotifications'

/** A notifier that records how many notices were in flight at once. */
function trackingNotifier() {
  let inFlight = 0
  const state = { max: 0, calls: [] as string[] }
  setJobIndexingNotifierForTests(async (url, type) => {
    inFlight++
    state.max = Math.max(state.max, inFlight)
    state.calls.push(`${type} ${url}`)
    await new Promise((r) => setTimeout(r, 5))
    inFlight--
  })
  return state
}

afterEach(() => resetJobIndexingNotifierForTests())

describe('expiry: URL_DELETED notices', () => {
  // On 2026-11-23 a batch of 386 sent every notice at once and 177 failed on the 5-connection Prisma pool.
  it('expireJobsByIds notifies every expired job, at most NOTIFY_CONCURRENCY at a time', async () => {
    const state = trackingNotifier()
    const r = await expireJobsByIds(jobs.map((j) => j.id))
    expect(r.expired).toBe(20)
    expect(state.calls).toHaveLength(20)
    expect(state.calls.every((c) => c.startsWith('URL_DELETED '))).toBe(true)
    expect(state.max).toBeLessThanOrEqual(NOTIFY_CONCURRENCY)
    expect(NOTIFY_CONCURRENCY).toBeLessThan(5) // below the pool size, leaving connections for other work
  })

  it('the 7-day expiry cycle is paced the same way', async () => {
    const state = trackingNotifier()
    await runExpiryCycle()
    expect(state.calls).toHaveLength(20)
    expect(state.max).toBeLessThanOrEqual(NOTIFY_CONCURRENCY)
  })
})
