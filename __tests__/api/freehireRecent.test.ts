const collectFreehireJobs = jest.fn()
const ingestFreehireJobs = jest.fn()
jest.mock('@/lib/scrapers/freehire', () => ({
  collectFreehireJobs: (...a: unknown[]) => collectFreehireJobs(...a),
  ingestFreehireJobs: (...a: unknown[]) => ingestFreehireJobs(...a),
}))

import { GET } from '../../app/api/cron/freehire-recent/route'

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
