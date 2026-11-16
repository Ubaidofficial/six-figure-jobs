// The "6figjobs today" band follows the database while a visitor has the page open: /api/stats/live sends the numbers, the
// band checks them before showing them.
const loadLiveSiteStats = jest.fn()
jest.mock('@/lib/jobs/liveSiteStats', () => ({ loadLiveSiteStats: (...a: unknown[]) => loadLiveSiteStats(...a) }))

import { GET } from '../../app/api/stats/live/route'
import { parseLiveSiteStats } from '../../lib/jobs/siteStatsShape'

const body = {
  jobs: 13054,
  companies: 3207,
  newThisWeek: 7200,
  countries: 25,
  catalog: { jobs: 4873473, companies: 698000, sources: 441, atsPlatforms: 180 },
  refreshedAt: '2026-11-16T21:04:00.000Z',
}

describe('parseLiveSiteStats', () => {
  it('accepts what the endpoint sends', () => {
    expect(parseLiveSiteStats({ ...body, checkedAt: '2026-11-16T22:00:00.000Z' })).toEqual(body)
  })

  it('refuses a body whose job count is missing, zero, fractional or not a number, so the band never shows 0 or NaN', () => {
    for (const jobs of [undefined, 0, -3, 12.5, '13054', null, Number.NaN]) expect(parseLiveSiteStats({ ...body, jobs })).toBeNull()
    expect(parseLiveSiteStats(null)).toBeNull()
    expect(parseLiveSiteStats('13054')).toBeNull()
  })

  it('refuses a body whose companies or new-this-week count is not a whole number', () => {
    expect(parseLiveSiteStats({ ...body, companies: -1 })).toBeNull()
    expect(parseLiveSiteStats({ ...body, newThisWeek: 'many' })).toBeNull()
    expect(parseLiveSiteStats({ ...body, newThisWeek: 0 })).not.toBeNull() // a quiet week is a real answer
  })

  it('drops a part that is unusable and keeps the rest', () => {
    const parsed = parseLiveSiteStats({ ...body, catalog: { jobs: 0, companies: 1, sources: 1, atsPlatforms: 1 }, countries: 0, refreshedAt: 'soon' })
    expect(parsed).toMatchObject({ jobs: 13054, catalog: null, countries: null, refreshedAt: null })
  })
})

describe('GET /api/stats/live', () => {
  it('sends the numbers with a short shared cache, and the time they were taken', async () => {
    loadLiveSiteStats.mockResolvedValueOnce(body)
    const res = await GET()
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=30, stale-while-revalidate=60')
    expect(json).toMatchObject(body)
    expect(Number.isNaN(Date.parse(json.checkedAt))).toBe(false)
    expect(parseLiveSiteStats(json)).toEqual(body)
  })

  it('answers 503, uncached, when the job count cannot be read', async () => {
    loadLiveSiteStats.mockResolvedValueOnce(null)
    const res = await GET()
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
