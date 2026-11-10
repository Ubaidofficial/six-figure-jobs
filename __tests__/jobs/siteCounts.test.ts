const count = jest.fn()
const groupBy = jest.fn()

jest.mock('../../lib/prisma', () => ({
  prisma: { job: { count: (...a: unknown[]) => count(...a), groupBy: (...a: unknown[]) => groupBy(...a) } },
}))

import { __clearMemoForTests } from '../../lib/cache/memo'
import { SITE_COUNTS_TTL_MS, countInCountries, loadSiteCounts, summarizeCountryGroups } from '../../lib/jobs/siteCounts'

// where-clauses carry BigInt salary thresholds, which JSON.stringify cannot print
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))

const rows = (pairs: Array<[string | null, number]>) => pairs.map(([countryCode, n]) => ({ countryCode, _count: { _all: n } }))

beforeEach(() => {
  __clearMemoForTests()
  count.mockReset()
  groupBy.mockReset()
  // total, remote, hybrid, onsite, remote worldwide (in call order)
  count
    .mockResolvedValueOnce(3000)
    .mockResolvedValueOnce(973)
    .mockResolvedValueOnce(400)
    .mockResolvedValueOnce(1500)
    .mockResolvedValueOnce(41)
  groupBy
    .mockResolvedValueOnce(rows([['us', 1800], ['CA', 300], [null, 500], ['GB', 120]]))
    .mockResolvedValueOnce(rows([['US', 274], [null, 196], ['CA', 70]]))
})

describe('siteCounts', () => {
  it('refreshes at most every hour', () => {
    expect(SITE_COUNTS_TTL_MS).toBe(60 * 60 * 1000)
  })

  it('turns groupBy rows into sorted upper-case countries and a no-country count', () => {
    expect(summarizeCountryGroups(rows([['ca', 300], [null, 5], ['US', 1800], [null, 7]]))).toEqual({
      countries: [{ code: 'US', count: 1800 }, { code: 'CA', count: 300 }],
      withoutCountry: 12,
    })
    expect(countInCountries([{ code: 'DE', count: 3 }, { code: 'FR', count: 4 }, { code: 'US', count: 9 }], ['de', 'FR'])).toBe(7)
  })

  it('counts from the database once and serves the same numbers until the hour is up', async () => {
    const first = await loadSiteCounts()
    expect(first.total).toBe(3000)
    expect(first.byWorkType).toEqual({ remote: 973, hybrid: 400, onsite: 1500 })
    expect(first.byCountry[0]).toEqual({ code: 'US', count: 1800 })
    expect(first.remoteByCountry).toEqual([{ code: 'US', count: 274 }, { code: 'CA', count: 70 }])
    expect(first.remoteWorldwide).toBe(41) // its own count, not the 196 remote jobs with no country
    expect(Number.isNaN(new Date(first.computedAt).getTime())).toBe(false)

    const queriesAfterFirst = count.mock.calls.length + groupBy.mock.calls.length
    expect(queriesAfterFirst).toBe(7)
    const second = await loadSiteCounts()
    expect(second).toBe(first)
    expect(count.mock.calls.length + groupBy.mock.calls.length).toBe(queriesAfterFirst) // no new queries
  })

  it('counts hybrid and on-site jobs only when they are not remote, so the three never overlap', async () => {
    await loadSiteCounts()
    const hybridWhere = json(count.mock.calls[2][0])
    const onsiteWhere = json(count.mock.calls[3][0])
    expect(hybridWhere).toContain('"remoteMode":"hybrid"')
    expect(hybridWhere).toContain('"NOT"')
    expect(onsiteWhere).toContain('"remoteMode":{"in":["onsite","on-site"]}')
    expect(onsiteWhere).toContain('"NOT"')
  })
})
