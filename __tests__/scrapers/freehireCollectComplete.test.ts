import axios from 'axios'
import { collectFreehireJobs, type FreehireJob } from '../../lib/scrapers/freehire'

jest.mock('axios')
const get = axios.get as jest.Mock

const rec = (i: number, postedAt: Date): FreehireJob => ({
  public_slug: `slug-${i}`,
  external_id: `ext-${i}`,
  url: `https://example.com/job/${i}`,
  title: `Job ${i}`,
  posted_at: postedAt.toISOString(),
  closed_at: null,
  reality: { class: 'fresh', fake_freshness: false },
  enrichment: { salary_min: 200000, salary_currency: 'USD', salary_period: 'year' },
})
const page = (jobs: FreehireJob[], total = 999) => ({ data: { data: jobs, meta: { total, limit: 100, offset: 0 } } })
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000)

/** The collector waits 700 ms between pages; run `fn` with those waits skipped. */
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

describe('collectFreehireJobs completeness flag', () => {
  beforeEach(() => get.mockReset())
  const since = new Date(Date.now() - 48 * 3_600_000)

  it('is complete when it reaches the total freehire reports', async () => {
    get.mockResolvedValue(page([rec(1, hoursAgo(1)), rec(2, hoursAgo(2))], 2))
    const r = await collectFreehireJobs({ since })
    expect(r.errors).toEqual([])
    expect(r.markets.every((m) => m.complete)).toBe(true)
  })

  it('keeps paging past a short page, because freehire returns 95-99 rows with more pages still to come', async () => {
    const sizes: Record<number, number> = { 0: 99, 100: 95, 200: 100, 300: 40 }
    const offsets: number[] = []
    get.mockImplementation(async (_url: string, config: { params: { offset: number } }) => {
      const { offset } = config.params
      offsets.push(offset)
      const rows = Array.from({ length: sizes[offset] ?? 0 }, (_, i) => rec(offset + i, hoursAgo(1 + offset / 100)))
      return page(rows, 334)
    })
    const r = await withImmediateTimers(() => collectFreehireJobs({ since }))
    // First market: every page was read (the old rule stopped after the 99-row first page) and the run reports done.
    expect(offsets.slice(0, 4)).toEqual([0, 100, 200, 300])
    expect(r.markets[0].fetched).toBe(99 + 95 + 100 + 40)
    expect(r.markets[0].complete).toBe(true)
  })

  it('stops, complete, after two pages made up only of jobs older than the window', async () => {
    const old = (offset: number) => Array.from({ length: 100 }, (_, i) => rec(offset + i, hoursAgo(24 * 30)))
    get.mockImplementation(async (_url: string, config: { params: { offset: number } }) => page(old(config.params.offset), 99_999))
    const r = await withImmediateTimers(() => collectFreehireJobs({ since }))
    expect(r.markets[0].fetched).toBe(0)
    expect(r.markets.every((m) => m.complete)).toBe(true)
    expect(get.mock.calls.length).toBeLessThanOrEqual(2 * r.markets.length)
  })

  it('is complete when a market is empty', async () => {
    get.mockResolvedValue(page([]))
    const r = await collectFreehireJobs({ since })
    expect(r.markets.every((m) => m.complete)).toBe(true)
  })

  it('is NOT complete when the page limit stops paging while jobs inside the window remain', async () => {
    const full = Array.from({ length: 100 }, (_, i) => rec(i, hoursAgo(1)))
    get.mockResolvedValue(page(full))
    const r = await collectFreehireJobs({ since, maxPagesPerMarket: 1 })
    expect(r.markets.every((m) => !m.complete)).toBe(true)
  })

  it('is NOT complete when a market request fails', async () => {
    get.mockRejectedValue(new Error('boom'))
    const r = await collectFreehireJobs({ since })
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.markets.every((m) => !m.complete)).toBe(true)
  })
})
