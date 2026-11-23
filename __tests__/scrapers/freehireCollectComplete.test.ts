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
    // Older than every market's window, including the 30-day worldwide one.
    const old = (offset: number) => Array.from({ length: 100 }, (_, i) => rec(offset + i, hoursAgo(24 * 40)))
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
    const r = await withImmediateTimers(() => collectFreehireJobs({ since, maxPagesPerMarket: 1 }))
    expect(r.markets.every((m) => !m.complete)).toBe(true)
  })

  it('is NOT complete when a market request fails', async () => {
    get.mockRejectedValue(new Error('boom'))
    const r = await collectFreehireJobs({ since })
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.markets.every((m) => !m.complete)).toBe(true)
  })
})

describe('worldwide-remote markets', () => {
  beforeEach(() => get.mockReset())

  it('read 30 days back while the regular markets keep the daily window', async () => {
    // Every query returns one job from 1 hour ago and one from 10 days ago (only the worldwide query should keep it).
    get.mockImplementation(async (_url: string, config: { params: { regions?: string; salary_currency: string } }) =>
      page([rec(1, hoursAgo(1)), rec(config.params.regions === 'global' ? 2 : 3, hoursAgo(240))], 2),
    )
    const r = await collectFreehireJobs({ since: hoursAgo(36) })
    const usd = r.markets.find((m) => m.currency === 'USD')!
    const usdWorldwide = r.markets.find((m) => m.currency === 'USD worldwide')!
    expect(usd.fetched).toBe(1)
    expect(usdWorldwide.fetched).toBe(2)
    expect(r.inputs.map((i) => i.externalId)).toContain('ext-2')
    expect(r.inputs.map((i) => i.externalId)).not.toContain('ext-3')
    const params = get.mock.calls.map((c) => c[1].params)
    expect(params).toContainEqual(expect.objectContaining({ regions: 'global', salary_currency: 'USD' }))
  })
})

describe('collectFreehireJobs: description-pay slices and dropped connections', () => {
  beforeEach(() => get.mockReset())
  const since = new Date(Date.now() - 48 * 3_600_000)
  const full = Array.from({ length: 100 }, (_, i) => rec(i, hoursAgo(1)))

  it('reads each description-pay slice up to its own page cap (100 each: US, CA/AU/UK, EU, rest, remote, worldwide)', async () => {
    const pagesBySlice: Record<string, number> = {}
    get.mockImplementation(async (_url: string, config: { params: Record<string, unknown> }) => {
      const p = config.params
      if (!('salary_currency' in p)) {
        const key = JSON.stringify({ c: p.countries, r: p.regions, ce: p.countries_exclude, re: p.regions_exclude })
        pagesBySlice[key] = (pagesBySlice[key] ?? 0) + 1
        return page(full, 1_000_000)
      }
      return page([], 0)
    })
    const r = await withImmediateTimers(() => collectFreehireJobs({ since }))
    expect(Object.values(pagesBySlice)).toEqual([100, 100, 100, 100, 100, 100])
    expect(r.markets.filter((m) => m.currency.startsWith('pay in description')).map((m) => m.complete)).toEqual([false, false, false, false, false, false])
  })

  it('reads no description-pay slice when withDescriptionPay is false (the 15-minute pull)', async () => {
    get.mockResolvedValue(page([], 0))
    const r = await collectFreehireJobs({ since, withDescriptionPay: false })
    expect(r.markets.some((m) => m.currency.startsWith('pay in description'))).toBe(false)
  })

  it('retries a dropped connection instead of failing the market (one ECONNRESET failed the 2026-11-19 sync)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    let calls = 0
    get.mockImplementation(async () => {
      calls++
      if (calls === 1) throw Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })
      return page([rec(1, hoursAgo(1))], 1)
    })
    const r = await withImmediateTimers(() => collectFreehireJobs({ since, withDescriptionPay: false }))
    expect(r.errors).toEqual([])
    expect(r.markets[0]).toMatchObject({ fetched: 1, complete: true })
    warn.mockRestore()
  })

  it('still gives up after a few dropped connections in a row, and reports the market', async () => {
    get.mockRejectedValue(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const err = jest.spyOn(console, 'error').mockImplementation(() => {})
    const r = await withImmediateTimers(() => collectFreehireJobs({ since, withDescriptionPay: false }))
    expect(r.errors[0]).toMatch(/ECONNRESET/)
    warn.mockRestore()
    err.mockRestore()
  })
})
