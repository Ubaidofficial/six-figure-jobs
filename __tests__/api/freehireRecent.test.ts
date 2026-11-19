const collectFreehireJobs = jest.fn()
const ingestFreehireJobs = jest.fn()
jest.mock('@/lib/scrapers/freehire', () => ({
  collectFreehireJobs: (...a: unknown[]) => collectFreehireJobs(...a),
  ingestFreehireJobs: (...a: unknown[]) => ingestFreehireJobs(...a),
}))

import { GET } from '../../app/api/cron/freehire-recent/route'
import { freehireRecentEveryMs, runFreehireRecent } from '@/lib/scrapers/freehireRecent'

const req = (auth?: string) => new Request('https://www.6figjobs.com/api/cron/freehire-recent', { headers: auth ? { authorization: auth } : {} })

describe('GET /api/cron/freehire-recent', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 's3cret'
    collectFreehireJobs.mockReset().mockResolvedValue({
      inputs: [{ externalId: 'a' }, { externalId: 'b' }],
      markets: [{ fetched: 120 }, { fetched: 30 }],
      errors: [],
      unmappable: 4,
    })
    ingestFreehireJobs.mockReset().mockResolvedValue({ created: 1, updated: 0, skipped: 1 })
  })

  it('refuses a call without the secret and touches nothing', async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('Bearer wrong'))).status).toBe(401)
    expect(collectFreehireJobs).not.toHaveBeenCalled()
  })

  it('reads one page per market of the last 2 hours, without the description pass or website lookups', async () => {
    const before = Date.now()
    const res = await GET(req('Bearer s3cret'))
    expect(res.status).toBe(200)
    const opts = collectFreehireJobs.mock.calls[0][0]
    expect(opts).toMatchObject({ maxPagesPerMarket: 1, withDescriptionPay: false })
    expect(before - opts.since.getTime()).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 50)
    expect(ingestFreehireJobs).toHaveBeenCalledWith([{ externalId: 'a' }, { externalId: 'b' }], { lookUpWebsites: false })
    expect(await res.json()).toMatchObject({ ok: true, fetched: 150, mappable: 2, created: 1, updated: 0, skipped: 5 })
  })
})

describe('the app runs it on its own every 5 minutes', () => {
  it('every 5 minutes by default, FREEHIRE_RECENT_EVERY_MIN to change it (at least 5), 0 to turn it off', () => {
    expect(freehireRecentEveryMs({})).toBe(5 * 60_000)
    expect(freehireRecentEveryMs({ FREEHIRE_RECENT_EVERY_MIN: '30' })).toBe(30 * 60_000)
    expect(freehireRecentEveryMs({ FREEHIRE_RECENT_EVERY_MIN: '1' })).toBe(5 * 60_000)
    expect(freehireRecentEveryMs({ FREEHIRE_RECENT_EVERY_MIN: 'abc' })).toBe(5 * 60_000)
    expect(freehireRecentEveryMs({ FREEHIRE_RECENT_EVERY_MIN: '0' })).toBeNull()
  })

  it('a second run while one is going does nothing', async () => {
    let release: () => void = () => {}
    collectFreehireJobs.mockReset().mockReturnValue(new Promise((r) => { release = () => r({ inputs: [], markets: [], errors: [], unmappable: 0 }) }))
    ingestFreehireJobs.mockReset().mockResolvedValue({ created: 0, updated: 0, skipped: 0 })
    const first = runFreehireRecent()
    expect(await runFreehireRecent()).toEqual({ skipped: 'previous run still going' })
    release()
    expect(await first).toMatchObject({ ok: true })
    expect(collectFreehireJobs).toHaveBeenCalledTimes(1)
  })
})
