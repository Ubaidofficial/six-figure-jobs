import { __clearMemoForTests } from '@/lib/cache/memo'
import { loadFreehireCatalog, parseFreehireCatalog } from '@/lib/jobs/freehireCatalog'

// The body of GET https://freehire.me/api/v1/stats/catalog on 2026-11-09.
const live = {
  data: {
    ats_platforms: 179,
    companies: 697981,
    computed_at: '2026-11-08T18:20:58.886039685Z',
    exact: true,
    open_jobs: 7242687,
    sources: 438,
    telegram_channels: 97,
    unique_open_jobs: 4871976,
  },
}

describe('parseFreehireCatalog', () => {
  it('reads unique open jobs (not all open jobs, which counts reposts), companies, sources and ATS platforms', () => {
    expect(parseFreehireCatalog(live)).toEqual({ jobs: 4871976, companies: 697981, sources: 438, atsPlatforms: 179 })
  })

  it('gives null when a number is missing, zero or not a number', () => {
    expect(parseFreehireCatalog(null)).toBeNull()
    expect(parseFreehireCatalog({})).toBeNull()
    expect(parseFreehireCatalog({ data: { ...live.data, companies: undefined } })).toBeNull()
    expect(parseFreehireCatalog({ data: { ...live.data, sources: 0 } })).toBeNull()
    expect(parseFreehireCatalog({ data: { ...live.data, ats_platforms: '179' } })).toBeNull()
  })
})

describe('loadFreehireCatalog', () => {
  const realFetch = global.fetch
  beforeEach(() => __clearMemoForTests())
  afterEach(() => {
    global.fetch = realFetch
  })

  it('reads the endpoint once and serves the cached numbers', async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify(live), { status: 200 }))
    global.fetch = fetchMock as never
    expect(await loadFreehireCatalog()).toEqual({ jobs: 4871976, companies: 697981, sources: 438, atsPlatforms: 179 })
    await loadFreehireCatalog()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // A `cache: 'no-store'` fetch turned the ISR homepage into a page rendered on every request (2026-11-09).
  it('asks for a cacheable fetch, so the homepage stays statically cached', async () => {
    const fetchMock = jest.fn(async (..._args: unknown[]) => new Response(JSON.stringify(live), { status: 200 }))
    global.fetch = fetchMock as never
    await loadFreehireCatalog()
    const init = fetchMock.mock.calls[0][1] as RequestInit & { next?: { revalidate?: number } }
    expect(init.cache).not.toBe('no-store')
    expect(init.next?.revalidate).toBe(3600)
  })

  it('gives null, not an error, when freehire is down or unreachable', async () => {
    global.fetch = jest.fn(async () => new Response('down', { status: 503 })) as never
    expect(await loadFreehireCatalog()).toBeNull()
    __clearMemoForTests()
    global.fetch = jest.fn(async () => {
      throw new Error('timeout')
    }) as never
    expect(await loadFreehireCatalog()).toBeNull()
  })
})
