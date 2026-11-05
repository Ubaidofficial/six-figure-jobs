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
const page = (jobs: FreehireJob[]) => ({ data: { data: jobs, meta: { total: 999, limit: 100, offset: 0 } } })
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000)

describe('collectFreehireJobs completeness flag', () => {
  beforeEach(() => get.mockReset())
  const since = new Date(Date.now() - 48 * 3_600_000)

  it('is complete when a market ends on a short page (window exhausted)', async () => {
    get.mockResolvedValue(page([rec(1, hoursAgo(1)), rec(2, hoursAgo(2))]))
    const r = await collectFreehireJobs({ since })
    expect(r.errors).toEqual([])
    expect(r.markets.every((m) => m.complete)).toBe(true)
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
