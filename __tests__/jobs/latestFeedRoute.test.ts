const mockLoad = jest.fn()
jest.mock('@/lib/jobs/latestFeed', () => ({ loadLatestFeed: () => mockLoad() }))

import { GET } from '@/app/api/jobs/latest/route'

const feed = {
  newestAt: '2026-11-06T12:00:00.000Z',
  items: [
    { id: 'new', addedAt: '2026-11-06T12:00:00.000Z' },
    { id: 'mid', addedAt: '2026-11-06T11:00:00.000Z' },
    { id: 'old', addedAt: '2026-11-06T10:00:00.000Z' },
  ],
}
const call = (q = '') => GET(new Request(`https://www.6figjobs.com/api/jobs/latest${q}`))

beforeEach(() => mockLoad.mockReset().mockResolvedValue(feed))

describe('GET /api/jobs/latest', () => {
  it('returns the whole feed without `since`, cacheable for a minute', async () => {
    const res = await call()
    const body = await res.json()
    expect(body.items.map((i: any) => i.id)).toEqual(['new', 'mid', 'old'])
    expect(body.newestAt).toBe(feed.newestAt)
    expect(Number.isNaN(Date.parse(body.checkedAt))).toBe(false)
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=60/)
  })

  it('returns only jobs added after `since`', async () => {
    const body = await (await call('?since=2026-11-06T10:30:00.000Z')).json()
    expect(body.items.map((i: any) => i.id)).toEqual(['new', 'mid'])
    expect((await (await call('?since=2026-11-06T12:00:00.000Z')).json()).items).toEqual([])
  })

  it('ignores a `since` that is not a date', async () => {
    expect((await (await call('?since=banana')).json()).items).toHaveLength(3)
  })

  it('answers 503, uncached, when the load fails', async () => {
    mockLoad.mockRejectedValue(new Error('db down'))
    const res = await call()
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ error: 'unavailable' })
  })
})
